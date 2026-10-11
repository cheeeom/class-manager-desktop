/* 预加载：只读桌面标识 + 更新器受控桥（contextIsolation 开启，页面拿不到 Node） */
const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('__CM_DESKTOP', {
  version: pkg.version,
  baseWeb: pkg.baseWeb || '',
  platform: process.platform,
  copyright: pkg.copyright || '',
  /* v1.4.2：Microsoft Store 版标志（MSIX 容器内 exe 位于 WindowsApps 目录；本地调试 CM_FORCE_STORE=1） */
  store: /WindowsApps/i.test(process.execPath) || process.env.CM_FORCE_STORE === '1'
});

/* 更新器：页面侧只能发起检查/下载/安装、订阅事件，无其它能力 */
contextBridge.exposeInMainWorld('__CM_UPDATER', {
  check: function () { return ipcRenderer.invoke('cm-upd-check'); },
  download: function () { return ipcRenderer.invoke('cm-upd-download'); },
  install: function () { return ipcRenderer.invoke('cm-upd-install'); },
  onEvent: function (cb) {
    ipcRenderer.on('cm-upd-event', function (e, payload) { try { cb(payload); } catch (err) {} });
  }
});

/* 反馈邮件：页面侧只能唤起系统邮件客户端（收件人与主题在主进程定死） */
contextBridge.exposeInMainWorld('__CM_FEEDBACK', {
  mail: function () { return ipcRenderer.invoke('cm-feedback-mail'); }
});

/* Pro 授权（v1.1.0）：验签在主进程，页面侧只能发起状态/激活/取码 */
contextBridge.exposeInMainWorld('__CM_PRO', {
  status: function () { return ipcRenderer.invoke('cm-pro-status'); },
  activate: function (payload) { return ipcRenderer.invoke('cm-pro-activate', payload); },
  claim: function (reqCode) { return ipcRenderer.invoke('cm-pro-claim', reqCode); },
  heartbeat: function () { return ipcRenderer.invoke('cm-pro-heartbeat'); },
  reportPdf: function (html, name) { return ipcRenderer.invoke('cm-pro-report-pdf', { html: html, name: name }); }
});

/* 剪贴板（v1.2.0）：主进程直写直读，file:// 下比 navigator.clipboard 可靠 */
/* 开发者密钥校验（v1.2.5）：SHA-256 在主进程比对 */
contextBridge.exposeInMainWorld('__CM_DEV', {
  checkKey: function (k) { return ipcRenderer.invoke('cm-dev-checkkey', k); }
});

contextBridge.exposeInMainWorld('__CM_CLIP', {
  write: function (text) { return ipcRenderer.invoke('cm-clip-write', text); },
  read: function () { return ipcRenderer.invoke('cm-clip-read'); }
});
