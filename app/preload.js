/* 预加载：仅暴露只读桌面标识（contextIsolation 开启，页面拿不到 Node） */
const { contextBridge } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('__CM_DESKTOP', {
  version: pkg.version,
  baseWeb: pkg.baseWeb || '',
  platform: process.platform,
  copyright: pkg.copyright || ''
});
