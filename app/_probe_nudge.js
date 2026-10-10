/* 一次性探针：满 3 天赞赏提醒真值验证（伪造 4 天前 onboarded），用完可删 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'cm_nudge_probe_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    try {
      // 预置：4 天前完成向导 + 已过提醒阈值 + 未弹过
      await win.webContents.executeJavaScript(
        'localStorage.setItem("cm_onboarded", String(Date.now() - 4*86400000));' +
        'localStorage.setItem("cm_nopwd","1");' +
        'localStorage.removeItem("cmDonateNudge");localStorage.removeItem("cmDonateNudgeAt");location.reload();1');
      await new Promise(r => setTimeout(r, 1200));
      const click = await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?(b.click(),1):0;');
      console.log('[NUDGE] enter=' + click);
      // 8 秒延迟 + 轮询间隔，给足 10.5 秒
      await new Promise(r => setTimeout(r, 10500));
      const r1 = await win.webContents.executeJavaScript(
        'JSON.stringify({nudgeShown:!!document.getElementById("cmDeskNudge"),lastAt:localStorage.getItem("cmDonateNudgeAt")})');
      console.log('[NUDGE] shown=' + r1);
      // 点「请作者喝一杯」→ 提醒关 + 双码弹窗开
      await win.webContents.executeJavaScript('var b=document.getElementById("cmNudgeYes");b?(b.click(),1):0;');
      await new Promise(r => setTimeout(r, 400));
      const r2 = await win.webContents.executeJavaScript(
        'JSON.stringify({nudgeGone:!document.getElementById("cmDeskNudge"),chooserOpen:!!document.getElementById("cmDeskDonateModal"),lastAt:localStorage.getItem("cmDonateNudgeAt")})');
      console.log('[NUDGE] yes=' + r2);
      // 关闭 → 重载 → 不再弹
      await win.webContents.executeJavaScript('document.getElementById("cmDeskDonateModal").remove();1');
      await win.webContents.executeJavaScript('location.reload();1');
      await new Promise(r => setTimeout(r, 1500));
      const r3 = await win.webContents.executeJavaScript(
        'JSON.stringify({reloadNudge:!!document.getElementById("cmDeskNudge"),lastAt:localStorage.getItem("cmDonateNudgeAt")})');
      console.log('[NUDGE] reload=' + r3);
      app.exit(0);
    } catch (e) { console.log('[NUDGE] fatal ' + (e && e.message)); app.exit(1); }
  });
});
