/* 商店版分支探针（v1.4.2）：CM_FORCE_STORE=1 → 关于卡 Store 标识 / 更新 stub 商店口径 / 购买链接指官网 / 侧栏无 NSIS 更新残留
   运行：先卸 ELECTRON_RUN_AS_NODE，CM_FORCE_STORE=1 electron _probe_store.js */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_store_probe_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  let consoleErrors = 0;
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) {
      /* cm-pro-status = 探针环境噪音（自建窗口不注册 Pro IPC，主程序含 main.js 无此问题） */
      if (String(message).indexOf('cm-pro-status') >= 0) return;
      consoleErrors++; console.log('[STORE][console-err] ' + String(message).slice(0, 160));
    }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await win.webContents.executeJavaScript('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1600);
      await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      await win.webContents.executeJavaScript('window.navigateTo("settings");1');
      await wait(1000);
      const r = await win.webContents.executeJavaScript(`(function(){
        var badge = document.querySelector('.cmDeskStoreBadge');
        var updRow = document.querySelector('.cmDeskUpd');
        var store = window.__CM_DESKTOP.store === true;
        return JSON.stringify({
          storeFlag: store,
          badge: badge ? badge.textContent : 'missing',
          updRowHasBtn: updRow ? !!updRow.querySelector('.btn') : null,
          updRowText: updRow ? updRow.textContent.slice(0, 60) : 'missing'
        });
      })()`);
      console.log('[STORE] about ' + r);
      const rr = JSON.parse(r);
      if (!rr.storeFlag) throw new Error('store 标志位未生效');
      if (String(rr.badge).indexOf('Microsoft Store') < 0) throw new Error('关于卡 Store 徽标缺失');
      if (rr.updRowHasBtn) throw new Error('商店版不应渲染检查更新按钮');
      if (String(rr.updRowText).indexOf('Store') < 0) throw new Error('更新说明非商店口径');

      /* 购买链接：打开一个 Pro 闸（座次表导出）看弹窗里的购买链接指向 */
      await win.webContents.executeJavaScript('window.navigateTo("seating");1');
      await wait(600);
      await win.webContents.executeJavaScript('window.seatExportImage();1');
      await wait(700);
      const r2 = await win.webContents.executeJavaScript(`(function(){
        var a = document.getElementById('cmProBuy');
        return JSON.stringify({ modal: !!a, href: a ? a.href : null });
      })()`);
      console.log('[STORE] buy ' + r2);
      const rr2 = JSON.parse(r2);
      if (String(rr2.href).indexOf('cheeeom.github.io') < 0) throw new Error('商店版购买链接未指官网: ' + rr2.href);

      console.log('[STORE] consoleErrors=' + consoleErrors);
      if (consoleErrors > 0) throw new Error('console-error 计数 ' + consoleErrors);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_store.png'), img.toPNG());
      console.log('[STORE] VERDICT=PASS shot=out/_probe_store.png');
      app.exit(0);
    } catch (e) {
      console.log('[STORE] fatal ' + (e && (e.message || e)));
      app.exit(1);
    }
  });
});
