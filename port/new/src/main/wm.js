'use strict';

/**
 * Window-manager backend selector.
 *
 * The desktop-widget plumbing is platform-specific: Win32/WorkerW on Windows,
 * Hyprland/Wayland on Linux. Both modules export the same contract, so the rest
 * of the app requires this and never branches on platform itself.
 */

module.exports = process.platform === 'win32'
  ? require('./win32')
  : require('./linuxwm');
