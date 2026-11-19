'use strict';

/**
 * "Launch at login" for Linux.
 *
 * Electron's app.setLoginItemSettings does nothing on Linux, so this writes the
 * XDG autostart entry everyone's desktop session reads: a .desktop file in
 * ~/.config/autostart (PLAN.md Faz 4). Enabling writes it, disabling removes it.
 *
 * The Exec line relaunches the app exactly as it is running now: the Electron
 * binary, plus the app directory when running unpackaged (electron <dir>).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const DIR = path.join(os.homedir(), '.config', 'autostart');
const FILE = path.join(DIR, 'weyv.desktop');

function execCommand() {
  const exe = process.execPath;
  if (app.isPackaged) return quote(exe);
  // Dev / from-source: electron needs the app directory as its argument.
  const appDir = path.join(__dirname, '..', '..');
  return `${quote(exe)} ${quote(appDir)}`;
}

function quote(value) {
  return /[\s"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function set(enabled) {
  try {
    if (enabled) {
      fs.mkdirSync(DIR, { recursive: true });
      const contents = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Weyv',
        'Comment=Canlı müzik görselleştirici masaüstü widget',
        `Exec=${execCommand()}`,
        'X-GNOME-Autostart-enabled=true',
        'Terminal=false',
        '',
      ].join('\n');
      fs.writeFileSync(FILE, contents, 'utf8');
    } else if (fs.existsSync(FILE)) {
      fs.unlinkSync(FILE);
    }
    return true;
  } catch (error) {
    console.warn('[autostart]', error.message);
    return false;
  }
}

function isEnabled() {
  try {
    return fs.existsSync(FILE);
  } catch {
    return false;
  }
}

module.exports = { set, isEnabled, FILE };
