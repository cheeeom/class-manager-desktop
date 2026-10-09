/* v1.2.0 页面锁视觉截图探针：未激活环境，拍「模糊+弹窗」与「关弹窗后模糊+悬浮按钮」两帧 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_gate_shot_' + Date.now()));
app.whenReady().then(async function () {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    win.show();   // 隐藏窗口里 CSS 入场动画不跑（opacity 卡在 0），必须真窗口拍
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const jsx = (s) => win.webContents.executeJavaScript(s);
    const shot = async (name) => {
      win.webContents.invalidate();
      await wait(700);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', name), img.toPNG());
      console.log('[SHOT]', name);
    };
    try {
      await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1500);
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      // 造点数据让页面有内容
      await jsx('(function(){state.students.push({id:901,sid:"2024001",name:"张三",credit:106,creditBase:100,tags:[],profile:{}});state.nextId=902;' +
        'var t=Date.now();state.operations.push({id:5001,studentId:901,studentName:"张三",amount:5,coin:5,reason:"课堂发言",time:t-86400000*2});' +
        'state.operations.push({id:5002,studentId:901,studentName:"张三",amount:-2,coin:-1,reason:"迟到早退",time:t-86400000});state.nextOpId=5003;return 1;})()');
      await jsx('window.navigateTo("credits");1');
      await wait(1200);
      const diag = await jsx('(function(){var m=document.getElementById("cmDeskProModal");if(!m)return "NO-MODAL";var cs=getComputedStyle(m);return JSON.stringify({display:cs.display,opacity:cs.opacity,z:cs.zIndex,rect:JSON.stringify(m.getBoundingClientRect())});})()');
      console.log('[SHOT] modal diag =', diag);
      await shot('_shot_lock_modal.png');                       // 帧1：模糊 + PRO 弹窗
      await jsx('document.getElementById("cmProLater").click();1');
      await wait(600);
      await shot('_shot_lock_pill.png');                        // 帧2：模糊 + 悬浮解锁按钮
      app.exit(0);
    } catch (e) {
      console.log('[SHOT] fatal', e && (e.message || e));
      app.exit(1);
    }
  });
});
