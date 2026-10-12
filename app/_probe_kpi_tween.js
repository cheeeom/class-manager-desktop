/* KPI 数字滚动抓帧探针：三阶段采样 .cmGx-kvalue 文本时间线
   ①隐藏期（模拟启动 show:false）→ ②show() 瞬间逐帧采样 → ③切页回归采样
   预期：隐藏期=最终值（不起播）；show 后=0→目标 渐进帧；切页=重新渐进
   附 rAF 计数器：区分「rAF 冻结」与「播放未触发」 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_kpi_tween_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    try {
      await win.webContents.executeJavaScript('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");localStorage.setItem("cmProCache", JSON.stringify({active:true,tier:"early",sn:2}));location.reload();1');
      await wait(1600);
      await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1000);
      await win.webContents.executeJavaScript(`(function(){
        var names=['陈曦','林浩然','苏雨桐','王一鸣','赵可欣','周子墨','李云舒','孟晚舟'];
        state.students = names.map(function(n,i){ var s={id:990001+i,name:n,credit:0,tags:[]};
          s.credit=[122,118,158,73,200,55,141,132][i]; return s; });
        state.nextStudentId = 990100;
        var now = Date.now();
        for (var i = 0; i < 16; i++) {
          state.operations.unshift({id:990001+i, studentId:990001+(i%8), studentName:'x', amount:(i%3===0?-2:4), coin:4,
            reason:'课堂表现', time: now - (i%6)*86400000 - i*60000});
        }
        state.nextOpId = 990019;
        return 'ok';
      })()`);
      win.show();   // 贴合真实用户：可见窗口内操作
      await wait(300);
      /* rAF 计数器 */
      await win.webContents.executeJavaScript(`window.__raf=0;(function(){var o=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){window.__raf++;return o.call(window,cb);};})();1`);
      /* ①隐藏期：进学分分析 */
      await win.webContents.executeJavaScript('window.navigateTo("analytics");1');
      await wait(700);
      const hidden = await win.webContents.executeJavaScript(`(function(){
        var els=[].slice.call(document.querySelectorAll('#analyticsCreditPanel .cmGx-kvalue'));
        return JSON.stringify({ hidden: document.hidden, raf: window.__raf,
          vals: els.slice(0,3).map(function(e){return e.textContent;}),
          played: els.slice(0,3).map(function(e){return e.getAttribute('data-gx-played');}) });
      })()`);
      console.log('[T1-隐藏期] ' + hidden);
      /* ①b 首访路径逐帧采样：dashboard → analytics 首帧开抓 */
      await win.webContents.executeJavaScript(`(function(){
        window.__samples1=[];
        window.navigateTo("dashboard");
        setTimeout(function(){
          window.navigateTo("analytics");
          (function poll(){
            var el=document.querySelector('#analyticsCreditPanel .cmGx-kvalue');
            window.__samples1.push(el?el.textContent:'-');
            if(window.__samples1.length<16) setTimeout(poll,80);
          })();
        }, 100);
      })();1`);
      await wait(1600);
      const s1b = await win.webContents.executeJavaScript('JSON.stringify({raf:window.__raf, samples:window.__samples1})');
      console.log('[T1b-首访] ' + s1b);
      /* ②show 瞬间逐帧采样 */
      await win.webContents.executeJavaScript(`(function(){
        window.__samples=[]; window.__marks=[];
        (function poll(){
          var el=document.querySelector('#analyticsCreditPanel .cmGx-kvalue');
          window.__samples.push(el?el.textContent:'-');
          window.__marks.push(document.hidden?'h':'v');
          if(window.__samples.length<16) setTimeout(poll,90);
        })();
      })();1`);
      const t0 = Date.now();
      await wait(1700);
      const s1 = await win.webContents.executeJavaScript('JSON.stringify({raf:window.__raf, marks:window.__marks.join(""), samples:window.__samples})');
      console.log('[T2-show后] ' + s1);
      /* ③切页回归：dashboard → analytics */
      await win.webContents.executeJavaScript(`(function(){
        window.__samples2=[];
        window.navigateTo("dashboard");
        setTimeout(function(){ window.navigateTo("analytics");
          (function poll(){
            var el=document.querySelector('#analyticsCreditPanel .cmGx-kvalue');
            window.__samples2.push(el?el.textContent:'-');
            if(window.__samples2.length<14) setTimeout(poll,90);
          })();
        }, 120);1`);
      await wait(1600);
      const s2 = await win.webContents.executeJavaScript('JSON.stringify({raf:window.__raf, samples:window.__samples2})');
      console.log('[T3-切页] ' + s2);
      /* 判定 */
      const j2 = JSON.parse(s2);
      const nums = j2.samples.map(Number).filter(x => !isNaN(x));
      const uniq = Array.from(new Set(nums));
      const frames = uniq.length >= 4;
      console.log('[判定] 切页采样唯一值数=' + uniq.length + ' → ' + (frames ? 'SMOOTH(有渐进帧)' : 'JUMP(无渐进帧)'));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_kpi_tween.png'), img.toPNG());
      app.exit(0);
    } catch (e) {
      console.log('[T] fatal ' + (e && (e.message || e)));
      app.exit(1);
    }
  });
});
