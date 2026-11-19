'use strict';

/**
 * Linux / Hyprland backend — the exact `win32.js` contract, implemented for
 * Wayland. Loaded in place of win32.js by wm.js on non-Windows platforms.
 *
 * Windows glues the widget into Explorer's WorkerW with SetParent so it lives
 * on the wallpaper. Wayland has no equivalent re-parent for a normal window
 * (the true background layer needs wlr-layer-shell, which Electron does not
 * speak — see PLAN.md Faz 5). This backend uses the guaranteed-to-work path
 * (PLAN.md "Kademe 3"): Hyprland window properties applied per-window through
 * `hyprctl dispatch setprop`, plus Electron's own window APIs.
 *
 *   - no re-parent: a "desktop" window is made nofocus + no-anim + no-border
 *     and dropped to the bottom of its workspace z-order.
 *   - queries (covered?, foreground frame, fullscreen app, open apps) come from
 *     `hyprctl -j`, which reports XWayland and Wayland windows alike.
 *   - per-window actions (bounds, click-through, taskbar) use the Electron
 *     BrowserWindow, found from the opaque handle.
 *
 * Every function degrades to a safe default instead of throwing: hyprctl may be
 * absent (another compositor) and the widget must still run.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const { BrowserWindow } = require('electron');

const DEV = process.argv.includes('--dev');

/* ------------------------------------------------------------------ hyprctl */

/** Run `hyprctl -j <args>` and parse the JSON, or null on any failure. */
function hypr(args) {
  try {
    const out = execFileSync('hyprctl', ['-j', ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500,
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/** Fire a `hyprctl dispatch`/keyword command; true on success. */
function hyprCtl(args) {
  try {
    execFileSync('hyprctl', args, { stdio: 'ignore', timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

function setprop(address, prop, value) {
  if (!address) return;
  hyprCtl(['dispatch', 'setprop', `address:${address}`, prop, String(value)]);
}

/* ------------------------------------------------------- handle <-> window */

/**
 * A stable integer id for a native window handle. On XWayland the handle is the
 * XID; under Wayland it is an opaque buffer. Either way the same buffer hashes
 * to the same number for the life of the window, which is all the callers need
 * (the number is only ever used as a map key and in logs).
 */
function toHwnd(buffer) {
  if (typeof buffer === 'number') return buffer;
  if (!buffer || !buffer.length) return 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < buffer.length; i++) {
    h ^= buffer[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** The BrowserWindow whose native handle hashes to `hwnd`, or null. */
function windowFor(hwnd) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed() && toHwnd(win.getNativeWindowHandle()) === hwnd) return win;
    } catch {}
  }
  return null;
}

/** The hyprctl client record for our own window `hwnd`, matched by title+pid. */
function clientFor(hwnd) {
  const win = windowFor(hwnd);
  if (!win) return null;
  let title;
  try {
    title = win.getTitle();
  } catch {
    return null;
  }
  const clients = hypr(['clients']);
  if (!Array.isArray(clients)) return null;
  return clients.find((c) => c.pid === process.pid && c.title === title) || null;
}

function rectOf(client) {
  if (!client || !Array.isArray(client.at) || !Array.isArray(client.size)) return null;
  const [x, y] = client.at;
  const [w, h] = client.size;
  return { left: x, top: y, right: x + w, bottom: y + h };
}

/* --------------------------------------------------------- desktop "layer" */

// Hyprland window props that make a normal window behave like wallpaper chrome.
const DESKTOP_PROPS = ['nofocus', 'noblur', 'noanim', 'noshadow', 'norounding', 'nodim'];

/**
 * Make `hwnd` a desktop widget: no focus, no effects, pinned to the bottom of
 * the workspace z-order. Returns the window's hyprctl address (truthy) on
 * success, 0 when the window isn't known to Hyprland yet.
 */
function attachToDesktop(hwnd) {
  const client = clientFor(hwnd);
  if (!client || !client.address) return 0;
  for (const prop of DESKTOP_PROPS) setprop(client.address, prop, 1);
  hyprCtl(['dispatch', 'alterzorder', `bottom,address:${client.address}`]);
  if (DEV) console.log(`[linuxwm] attachToDesktop ${client.title} @ ${client.address}`);
  return client.address;
}

// No desktop icons on Hyprland, so "behind the icons" is just the desktop.
const attachBehindIcons = attachToDesktop;

/** Re-drop the window to the bottom of its workspace (after it was shown). */
function restackBehindIcons(hwnd) {
  const client = clientFor(hwnd);
  if (client && client.address) {
    hyprCtl(['dispatch', 'alterzorder', `bottom,address:${client.address}`]);
  }
}

/** Still a desktop widget Hyprland knows about? */
function isOnDesktop(hwnd) {
  return !!clientFor(hwnd);
}

/** The window's "parent" — its hyprctl address while attached, else 0. */
function getParent(hwnd) {
  const client = clientFor(hwnd);
  return client && client.address ? client.address : 0;
}

/** Undo attachToDesktop: give focus and effects back. */
function detachFromDesktop(hwnd) {
  const client = clientFor(hwnd);
  if (!client || !client.address) return;
  for (const prop of DESKTOP_PROPS) setprop(client.address, prop, 0);
}

/** The desktop host sentinel — always truthy on Hyprland (no icon host). */
function desktopHost() {
  return 1;
}

/** No WorkerW on Linux; the sentinel keeps callers' truthiness checks happy. */
function findWallpaperWorkerW() {
  return 1;
}

/* ----------------------------------------------------------- window actions */

function isWindow(hwnd) {
  return !!windowFor(hwnd);
}

/** Move/resize through Electron — no re-parent, so its own bounds are right. */
function setBounds(hwnd, x, y, width, height) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
    } catch {}
  }
}

function sendToBottom(hwnd) {
  const client = clientFor(hwnd);
  if (client && client.address) hyprCtl(['dispatch', 'alterzorder', `bottom,address:${client.address}`]);
}

function sendToTopMost(hwnd) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
    } catch {}
  }
  const client = clientFor(hwnd);
  if (client && client.address) hyprCtl(['dispatch', 'alterzorder', `top,address:${client.address}`]);
}

function clearTopMost(hwnd) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      win.setAlwaysOnTop(false);
    } catch {}
  }
}

function show(hwnd) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      if (!win.isVisible()) win.showInactive();
    } catch {}
  }
}

/** Keep the widget out of the taskbar; nofocus keeps it out of focus cycling. */
function makeToolWindow(hwnd) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      win.setSkipTaskbar(true);
    } catch {}
  }
}

/**
 * Stop the widget stealing focus. `nofocus` is applied through Hyprland rather
 * than Electron's setFocusable, which would also swallow the clicks the widget
 * needs while unlocked.
 */
function setNoActivate(hwnd, enabled) {
  const client = clientFor(hwnd);
  if (client && client.address) setprop(client.address, 'nofocus', enabled ? 1 : 0);
}

/** Let clicks fall through to whatever is underneath. */
function setClickThrough(hwnd, enabled) {
  const win = windowFor(hwnd);
  if (win) {
    try {
      win.setIgnoreMouseEvents(!!enabled, { forward: true });
    } catch {}
  }
}

function windowRect(hwnd) {
  return rectOf(clientFor(hwnd));
}

function classNameOf(hwnd) {
  const client = clientFor(hwnd);
  return client ? client.class || '' : '';
}

function isCloaked() {
  // Wayland has no DWM cloaking; hidden windows are handled via `hidden`.
  return false;
}

/* ------------------------------------------------------------------ queries */

function sameWorkspace(a, b) {
  return a && b && a.workspace && b.workspace && a.workspace.id === b.workspace.id;
}

/**
 * Is every pixel of `hwnd` hidden behind another window on the same workspace?
 * Mirrors win32.isCovered: any single visible window whose rectangle fully
 * contains the widget's hides it (the widget lives at the bottom).
 */
function isCovered(hwnd, rect) {
  if (!rect) return false;
  const self = clientFor(hwnd);
  const clients = hypr(['clients']);
  if (!self || !Array.isArray(clients)) return false;

  for (const other of clients) {
    if (!other || other.address === self.address) continue;
    if (other.pid === process.pid) continue;         // another Weyv window
    if (other.hidden || !other.mapped) continue;
    if (!sameWorkspace(self, other)) continue;
    const box = rectOf(other);
    if (!box) continue;
    if (box.right - box.left < 8 || box.bottom - box.top < 8) continue;
    if (box.left > rect.left || box.top > rect.top) continue;
    if (box.right < rect.right || box.bottom < rect.bottom) continue;
    return other.class || other.title || true;
  }
  return false;
}

/**
 * The window the user is working in, as its frame, or null for the desktop and
 * our own windows. Coordinates are Hyprland's global layout pixels — the same
 * space windowRect() reports, which is all the one caller needs.
 */
function foregroundFrame() {
  const active = hypr(['activewindow']);
  if (!active || !active.address || active.pid === process.pid) return null;
  if (active.hidden || active.mapped === false) return null;
  const box = rectOf(active);
  if (!box) return null;
  return {
    hwnd: active.address,
    maximized: active.fullscreen === 2 || !!active.fullscreen,
    x: box.left,
    y: box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
  };
}

/**
 * The class of the app in front when it is fullscreen, or '' otherwise / when
 * it is one of our own windows. gaming.js lower-cases and filters this.
 */
function fullscreenApp() {
  const active = hypr(['activewindow']);
  if (!active || !active.class || active.pid === process.pid) return '';
  if (!active.fullscreen) return '';
  return active.class;
}

/** The class behind an arbitrary foreground frame, if fullscreen. */
function fullscreenExe() {
  return fullscreenApp();
}

/** Lower-cased comm names of every running process, for "is this app open?". */
function processNames() {
  const names = new Set();
  let pids;
  try {
    pids = fs.readdirSync('/proc');
  } catch {
    return names;
  }
  for (const pid of pids) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
      if (comm) names.add(comm.toLowerCase());
    } catch {}
  }
  return names;
}

/** The classes of every app with a visible, titled window, sorted, no repeats. */
function windowedApps() {
  const clients = hypr(['clients']);
  if (!Array.isArray(clients)) return [];
  const names = new Map();
  for (const c of clients) {
    if (!c || c.pid === process.pid) continue;
    if (c.hidden || !c.mapped || !c.title || !c.class) continue;
    names.set(c.class.toLowerCase(), c.class);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// Z-order sentinels, kept for export parity with win32.js.
const HWND_TOP = 0;
const HWND_BOTTOM = 1;

module.exports = {
  fullscreenApp,
  fullscreenExe,
  processNames,
  windowedApps,
  toHwnd,
  windowRect,
  isCovered,
  classNameOf,
  isCloaked,
  attachToDesktop,
  setClickThrough,
  isOnDesktop,
  desktopHost,
  attachBehindIcons,
  restackBehindIcons,
  foregroundFrame,
  detachFromDesktop,
  findWallpaperWorkerW,
  getParent,
  isWindow,
  setBounds,
  sendToBottom,
  sendToTopMost,
  clearTopMost,
  show,
  makeToolWindow,
  setNoActivate,
  HWND_TOP,
  HWND_BOTTOM,
};
