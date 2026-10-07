/* 预加载：只读桌面标识 + 更新器受控桥（contextIsolation 开启，页面拿不到 Node） */
const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('__CM_DESKTOP', {
  version: pkg.version,
  baseWeb: pkg.baseWeb || '',
  platform: process.platform,
  copyright: pkg.copyright || ''
});

/* 更新器：页面侧只能发起检查/安装、订阅事件，无其它能力 */
contextBridge.exposeInMainWorld('__CM_UPDATER', {
  check: function () { return ipcRenderer.invoke('cm-upd-check'); },
  install: function () { return ipcRenderer.invoke('cm-upd-install'); },
  onEvent: function (cb) {
    ipcRenderer.on('cm-upd-event', function (e, payload) { try { cb(payload); } catch (err) {} });
  }
});
