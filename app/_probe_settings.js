/* 一次性视觉探针：隔离 userData → 进设置页 → 截图（含 toast 样品渲染）
   运行：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_settings.js
   用完可删。绝不写真实数据（userData 指向系统临时目录）。 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_desk_probe_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) console.log('[PROBE][console-err] ' + String(message).slice(0, 160));
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    const steps = [
      ['prep', 'localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1'],
      ['wait1', null],
      ['desk', 'JSON.stringify({desk:!!window.__CM_DESKTOP,layer:!!window.__CM_DESK_LAYER__,ver:(window.__CM_DESKTOP||{}).version,loginCard:!!document.querySelector(".cmDesk-login-card"),enterBtn:!!document.getElementById("cmDeskEnter")})'],
      ['enter', 'typeof enterApp==="function" ? (enterApp("探针"),1) : 0'],
      ['wait', null],
      ['nav', 'typeof navigateTo==="function" ? (navigateTo("settings"),1) : (window.navigateTo?(window.navigateTo("settings"),1):0)'],
      ['wait', null],
      ['inspect', '(function(){var r={};var secs=document.querySelectorAll(".settings-section");r.total=secs.length;r.hidden=0;r.shown=[];for(var i=0;i<secs.length;i++){var h=secs[i].querySelector("h3");var vis=getComputedStyle(secs[i]).display!=="none";if(!vis)r.hidden++;else if(h)r.shown.push(h.textContent.trim().slice(0,10));}r.aboutIntro=!!document.querySelector("#settingsAbout .cmDeskAbout");r.secCard=!!document.getElementById("cmDeskSecurity");var cb=document.querySelector(\'button[onclick*="restoreFromCloud"]\');r.cloudBtn=cb?getComputedStyle(cb).display:"none-el";return JSON.stringify(r);})()'],
      ['scroll', 'var c=document.querySelector(".content");if(c)c.scrollTop=c.scrollHeight;1'],
      ['toast', '(function(){var rep=document.createElement("div");rep.className="cmDeskUpdToast";rep.setAttribute("data-state","available");rep.innerHTML=\'<div class="t">🚀 发现新版本 v9.9.9（样式样品）</div><div class="d">新版约 78MB，下载完成后重启应用即可完成安装。<br>你也可以继续使用当前版本。</div><div class="r"><button class="btn btn-outline">暂不更新</button><button class="btn btn-primary">立即更新</button></div>\';document.body.appendChild(rep);var cs=getComputedStyle(rep);var rc=rep.getBoundingClientRect();return JSON.stringify({pos:cs.position,left:cs.left,bottom:cs.bottom,z:cs.zIndex,w:rc.width,h:rc.height,top:rc.top,display:cs.display,cssLoaded:!!document.querySelector(\'link[href*="wizard.css"]\')});})()'],
      ['wait', null]
    ];
    try {
      win.show();
      await new Promise(r => setTimeout(r, 600));
      for (const [name, js] of steps) {
        if (js === null) {
          await new Promise(r => setTimeout(r, 1200));
          console.log('[PROBE] ' + name + ' ok');
          if (name === 'wait1') {
            const img0 = await win.webContents.capturePage();
            fs.writeFileSync(path.join(__dirname, 'out', '_probe_login.png'), img0.toPNG());
            console.log('[PROBE] login-shot=out/_probe_login.png');
          }
          continue;
        }
        try {
          const out = await win.webContents.executeJavaScript(js);
          console.log('[PROBE] ' + name + ' = ' + String(out).slice(0, 220));
        } catch (e) {
          console.log('[PROBE] ' + name + ' FAIL: ' + String(e && (e.message || e)).slice(0, 200));
        }
        if (name === 'wait1') {
          const img0b = await win.webContents.capturePage();
          fs.writeFileSync(path.join(__dirname, 'out', '_probe_login2.png'), img0b.toPNG());
        }
      }
      win.show();
      await new Promise(r => setTimeout(r, 800));
      const img = await win.webContents.capturePage();
      const shot = path.join(__dirname, 'out', '_probe_settings.png');
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      fs.writeFileSync(shot, img.toPNG());
      console.log('[PROBE] shot=' + shot);
      app.exit(0);
    } catch (e) {
      console.log('[PROBE] fatal=' + (e && (e.message || e)));
      app.exit(1);
    }
  });
});