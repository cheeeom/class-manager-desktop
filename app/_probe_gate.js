/* v1.2.0 页面级 Pro 锁全链探针：
   角标 → 进 Pro 页模糊+弹窗 → 剪贴板粘贴激活码 → 关弹窗保模糊+悬浮按钮 → 真码激活解锁 → Pro 页直通
   运行：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_gate.js */
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const proCore = require('./src/pro.core.cjs');

const ed = proCore.ed;
const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

app.setPath('userData', path.join(os.tmpdir(), 'cm_gate_probe_' + Date.now()));
app.whenReady().then(async function () {
  const priv = process.env.CM_PRO_PRIV || hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain, app, fs, path, net: require('electron').net, pub: () => pub, claimApi: '' });
  console.log('[GATE] keypair ready pub=' + pub.slice(0, 8) + '…');

  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) console.log('[GATE][console-err] ' + String(message).slice(0, 160));
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    let STEP = 'init';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const jsx = async (s) => {
      try { return await win.webContents.executeJavaScript(s); }
      catch (e) {
        console.log('[GATE] renderer-err @' + STEP + ' = ' + String(e && (e.message || e)).slice(0, 200));
        throw e;
      }
    };
    try {
      STEP = '准备';
      await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1500);
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);

      STEP = '①导航角标';
      let r = await jsx('JSON.stringify({badges:document.querySelectorAll("#nav .cmDesk-navbadge").length,report:!!document.getElementById("cmNavReport")})');
      console.log('[GATE] ①角标 =', r);
      if (JSON.parse(r).badges < 12) throw new Error('PRO 角标数量不足');

      STEP = '②进学分记录页模糊+弹窗';
      await jsx('window.navigateTo("credits");1');
      await wait(600);
      r = await jsx('(function(){var c=document.getElementById("content");var m=document.getElementById("cmDeskProModal");' +
        'return JSON.stringify({blur:c?c.classList.contains("cmDesk-blurtarget"):false,modal:!!m,h3:m?(m.querySelector("h3")||{}).textContent:null,intro:!!document.querySelector(".cmDesk-pro-intro")});})()');
      console.log('[GATE] ②页面锁 =', r);
      if (!JSON.parse(r).blur || !JSON.parse(r).modal) throw new Error('页面锁未生效');

      STEP = '③剪贴板粘贴激活码';
      clipboard.writeText('CMPRO1.fakepaste');
      await jsx('document.getElementById("cmProPaste").click();1');
      await wait(600);
      r = await jsx('(function(){var i=document.getElementById("cmProLic");var m=document.getElementById("cmProMsg");return JSON.stringify({lic:i?i.value:null,msg:m?m.textContent.slice(0,40):null});})()');
      console.log('[GATE] ③粘贴 =', r);
      if (JSON.parse(r).lic !== 'CMPRO1.fakepaste') throw new Error('剪贴板粘贴未生效');
      clipboard.writeText('not-a-code');
      await jsx('document.getElementById("cmProPaste").click();1');
      await wait(400);
      r = await jsx('document.getElementById("cmProMsg").textContent');
      console.log('[GATE] ③b垃圾码提示 =', String(r).slice(0, 50));

      STEP = '④关弹窗保模糊+悬浮按钮';
      await jsx('document.getElementById("cmProLater").click();1');
      await wait(300);
      r = await jsx('(function(){var c=document.getElementById("content");return JSON.stringify({blur:c?c.classList.contains("cmDesk-blurtarget"):false,pill:!!document.getElementById("cmDeskPagePill")});})()');
      console.log('[GATE] ④关弹窗 =', r);
      if (!JSON.parse(r).blur || !JSON.parse(r).pill) throw new Error('关闭后模糊/悬浮按钮丢失');

      STEP = '⑤悬浮按钮重开+真码激活';
      await jsx('document.getElementById("cmDeskPagePill").click();1');
      await wait(400);
      const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
      const reqObj = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      const lic = { v: 1, tier: 'early', sn: 9, eh: reqObj.eh, dev: reqObj.dev, ts: Math.floor(Date.now() / 1000) };
      lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
      await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
      await jsx('document.getElementById("cmProGo").click();1');
      await wait(1000);
      r = await jsx('(function(){var c=document.getElementById("content");return JSON.stringify({active:(JSON.parse(localStorage.getItem("cmProCache")||"{}").active===true),blur:c?c.classList.contains("cmDesk-blurtarget"):false,pill:!!document.getElementById("cmDeskPagePill")});})()');
      console.log('[GATE] ⑤激活解锁 =', r);
      const st = JSON.parse(r);
      if (!st.active || st.blur || st.pill) throw new Error('激活后未解锁');

      STEP = '⑥激活后 Pro 页直通';
      await jsx('window.navigateTo("attendance");1');
      await wait(500);
      r = await jsx('(function(){var c=document.getElementById("content");var a=document.querySelector(".page.active");return JSON.stringify({blur:c?c.classList.contains("cmDesk-blurtarget"):false,modal:!!document.getElementById("cmDeskProModal"),activePage:a?a.id:null,title:(document.getElementById("pageTitle")||{}).textContent});})()');
      console.log('[GATE] ⑥直通 =', r);

      win.webContents.invalidate();
      await wait(600);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_gate.png'), img.toPNG());
      console.log('[GATE] shot=out/_probe_gate.png');
      console.log('[GATE] verdict=PASS');
      app.exit(0);
    } catch (e) {
      console.log('[GATE] fatal at ' + STEP + ' = ' + (e && (e.message || e)));
      if (e && e.stack) console.log('[GATE] stack ' + String(e.stack).split('\n').slice(0, 4).join(' | '));
      app.exit(1);
    }
  });
});
