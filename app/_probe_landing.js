/* 一次性视觉探针：落地页改版截图（hero + 下载区），隔离 userData，用完可删 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_landing_probe_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    try {
      win.show();
      await new Promise(r => setTimeout(r, 900));
      // hero
      try { await win.webContents.executeJavaScript('window.scrollTo(0,0);1'); } catch (e) { console.log('[LANDING] scroll1-err ' + e.message); }
      await new Promise(r => setTimeout(r, 500));
      fs.writeFileSync(path.join(__dirname, 'out', '_landing_hero.png'),
        (await win.webContents.capturePage()).toPNG());
      // 下载区
      try { await win.webContents.executeJavaScript('var d=document.querySelector(".dl");d?d.scrollIntoView():window.scrollTo(0,99999);1'); } catch (e) { console.log('[LANDING] scroll2-err ' + e.message); }
      await new Promise(r => setTimeout(r, 700));
      fs.writeFileSync(path.join(__dirname, 'out', '_landing_dl.png'),
        (await win.webContents.capturePage()).toPNG());
      console.log('[LANDING] shots ok');
      app.exit(0);
    } catch (e) { console.log('[LANDING] fatal ' + (e && e.message)); app.exit(1); }
  });
});
