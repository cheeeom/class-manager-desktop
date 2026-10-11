/* 一次性诊断/视觉探针：登录页取证 + 设置页卡片一致性截图
   全新 profile → 截登录页 → 进工作台 → 设置页滚到反馈卡截图（v1.4.1 卡片样式统一验证） */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_login_bug_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1552, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await wait(2500);   // 向导/登录层渲染完成
      const info = await win.webContents.executeJavaScript(`(function(){
        var out = { pts: [] };
        [[16,16],[60,30],[120,46],[16,46]].forEach(function(pt){
          var els = document.elementsFromPoint(pt[0], pt[1]).slice(0, 6).map(function(e){
            return e.tagName + (e.id ? '#'+e.id : '') + (e.className && typeof e.className === 'string' ? '.'+e.className.split(' ').join('.') : '') + '「' + String(e.textContent||'').slice(0,24).replace(/\\s+/g,' ') + '」';
          });
          out.pts.push({ at: pt.join(','), stack: els });
        });
        var b = document.getElementById('eolBanner');
        out.eolBanner = b ? ('exists「' + String(b.textContent).slice(0,40) + '」') : 'removed';
        out.loginOverlayOffset = (function(){ var l = document.getElementById('loginOverlay'); return l ? getComputedStyle(l).top + '/' + getComputedStyle(l).transform : 'none'; })();
        return JSON.stringify(out);
      })()`);
      console.log('[BUG] ' + info);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_login_bug.png'), img.toPNG());
      console.log('[BUG] shot=out/_probe_login_bug.png');

      // v1.4.1：设置页卡片一致性（反馈卡应与关于本系统同为实心卡）
      await win.webContents.executeJavaScript('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1800);
      await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      await win.webContents.executeJavaScript('window.navigateTo("settings");1');
      await wait(900);
      const fb = await win.webContents.executeJavaScript(`(function(){
        var f = document.querySelector('.cmDeskFeedback');
        var a = document.getElementById('settingsAbout');
        function styleOf(e){ if(!e) return null; var s = getComputedStyle(e); return { bg: s.backgroundColor, border: s.borderStyle + ' ' + s.borderWidth }; }
        if (f) f.scrollIntoView({ block: 'center' });
        return JSON.stringify({ feedback: styleOf(f), about: styleOf(a) });
      })()`);
      console.log('[BUG] cards ' + fb);
      await wait(600);
      const img2 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_settings_cards.png'), img2.toPNG());
      console.log('[BUG] shot=out/_probe_settings_cards.png');
      app.exit(0);
    } catch (e) {
      console.log('[BUG] fatal ' + (e && e.message));
      app.exit(1);
    }
  });
});

