/* Pro 全链端到端探针（v1.1.0）：
   未激活点导出 → 弹引导框 → 读申请码 → 篡改码被拒 → 真码激活 → 再点直通 → reload 状态保持
   运行：env -u ELECTRON_RUN_AS_NODE CM_PRO_PRIV=<私钥hex> ./node_modules/electron/dist/electron.exe _probe_pro.js
   （不传 CM_PRO_PRIV 则自动生成一次性密钥对） */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const proCore = require('./src/pro.core.cjs');

const ed = proCore.ed;
const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

app.setPath('userData', path.join(os.tmpdir(), 'cm_pro_probe_' + Date.now()));
app.whenReady().then(async function () {
  const priv = process.env.CM_PRO_PRIV || hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain, app, fs, path, net: require('electron').net, pub: () => pub, claimApi: '' });
  console.log('[PRO] keypair ready pub=' + pub.slice(0, 8) + '…');

  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) console.log('[PRO][console-err] ' + String(message).slice(0, 160));
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    let STEP = 'init';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const jsx = async (s) => {
      try { return await win.webContents.executeJavaScript(s); }
      catch (e) {
        console.log('[PRO] renderer-err @' + STEP + ' = ' + String(e && (e.message || e)).slice(0, 200));
        throw e;
      }
    };
    try {
      STEP = '准备';
      await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1500);
      STEP = '进工作台';
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      await jsx('window.navigateTo("settings");1');
      await wait(800);

      STEP = '①未激活点导出';
      await jsx('window.seatExportImage();1');
      await wait(400);
      let r = await jsx('(function(){var m=document.getElementById("cmDeskProModal");var rq=document.getElementById("cmProReq");return JSON.stringify({modal:!!m,reqLen:rq?rq.value.length:0,reqHead:rq?rq.value.slice(0,10):null});})()');
      console.log('[PRO] ①未激活点导出 =', r);
      const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
      const reqObj = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

      STEP = '②换机码被拒';
      const bad = { v: 1, tier: 'early', sn: 1, eh: reqObj.eh, dev: 'ffffffffffffffff', ts: Math.floor(Date.now() / 1000) };
      bad.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + bad.tier + '|' + bad.sn + '|' + bad.eh + '|' + bad.dev + '|' + bad.ts), priv));
      await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(bad)) + ';1');
      await jsx('document.getElementById("cmProGo").click();1');
      await wait(600);
      r = await jsx('document.getElementById("cmProMsg").textContent');
      console.log('[PRO] ②换机码被拒 =', String(r).slice(0, 60));

      STEP = '③真码激活';
      const lic = { v: 1, tier: 'early', sn: 7, eh: reqObj.eh, dev: reqObj.dev, ts: Math.floor(Date.now() / 1000) };
      lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
      await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
      await jsx('document.getElementById("cmProGo").click();1');
      await wait(900);
      r = await jsx('(function(){var c=JSON.parse(localStorage.getItem("cmProCache")||"{}");var sec=document.getElementById("cmDeskDonateSec");var h3=sec?(sec.querySelector("h3")||{}).textContent:null;return JSON.stringify({active:c.active===true,tier:c.tier,proCard:h3});})()');
      console.log('[PRO] ③真码激活 =', r);

      STEP = '④激活后直通';
      await jsx('window.seatExportImage();1');
      await wait(400);
      r = await jsx('!!document.getElementById("cmDeskProModal")');
      console.log('[PRO] ④激活后再点导出弹窗（false=直通） =', r);

      STEP = '⑤reload 保持';
      await jsx('location.reload();1');
      await wait(1800);
      r = await jsx('JSON.stringify({active:(JSON.parse(localStorage.getItem("cmProCache")||"{}").active===true),badge:document.body.textContent.indexOf("早鸟纪念")>=0})');
      console.log('[PRO] ⑤reload 后 =', r);

      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_pro.png'), img.toPNG());
      console.log('[PRO] shot=out/_probe_pro.png');
      app.exit(0);
    } catch (e) {
      console.log('[PRO] fatal at ' + STEP + ' = ' + (e && (e.message || e)));
      if (e && e.stack) console.log('[PRO] stack ' + String(e.stack).split('\n').slice(0, 4).join(' | '));
      app.exit(1);
    }
  });
});
