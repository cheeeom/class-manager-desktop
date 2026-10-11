/* 一次性诊断探针：登录页左上角乱码取证（v1.4.0 老板实机截图复现）
   全新 profile → 不进工作台 → 截登录页 → elementsFromPoint 探查左上角元素栈 */
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
        var sp = document.querySelector('.side-panel');
        out.sidePanel = sp ? 'exists' : 'none';
        out.appOffset = (function(){ var a = document.querySelector('.app'); return a ? getComputedStyle(a).paddingTop || getComputedStyle(a).top : 'none'; })();
        out.loginOverlayOffset = (function(){ var l = document.getElementById('loginOverlay'); return l ? getComputedStyle(l).top + '/' + getComputedStyle(l).transform : 'none'; })();
        out.bodyFirst = document.body.firstChild ? (document.body.firstChild.nodeName + '#' + (document.body.firstChild.id||'') + '.' + (document.body.firstChild.className||'')) : 'none';
        return JSON.stringify(out);
      })()`);
      console.log('[BUG] ' + info);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_login_bug.png'), img.toPNG());
      console.log('[BUG] shot=out/_probe_login_bug.png');
      app.exit(0);
    } catch (e) {
      console.log('[BUG] fatal ' + (e && e.message));
      app.exit(1);
    }
  });
});
