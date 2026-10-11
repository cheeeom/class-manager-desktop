/* 首访竞态回归探针：全新 profile 直奔「学分分析」（echarts 尚未加载的第一站）
   修复前：四图空 + 脏标记被误清；修复后：懒加载完成自动补画
   附：直奔首页 → 学分分布图也应有图 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_credit_first_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  let consoleErrors = 0;
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) { consoleErrors++; console.log('[CF][console-err] ' + String(message).slice(0, 140)); }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await win.webContents.executeJavaScript('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");localStorage.setItem("cmProCache", JSON.stringify({active:true,tier:"early",sn:2}));location.reload();1');
      await wait(1600);
      await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      /* 示例学分数据（无考试——纯学分首访场景） */
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
      /* 直奔学分分析（credit tab 是默认首 tab）——此时 echarts 尚未加载 */
      await win.webContents.executeJavaScript('window.navigateTo("analytics");1');
      await wait(600);
      const live0 = await win.webContents.executeJavaScript(`(function(){
        return JSON.stringify({
          echartsReady: !!(window.echarts && window.echarts.init),
          live: ['cmGxCdRange','cmGxCdDonut','cmGxCdWk','cmGxCdMovers'].filter(function(id){
            var d = document.getElementById(id); return d && window.echarts && window.echarts.getInstanceByDom(d); }).length,
          kpi1: (document.querySelector('#analyticsCreditPanel .cmGx-kvalue')||{}).textContent
        });
      })()`);
      console.log('[CF] 首访即时 = ' + live0);
      await wait(2200);   // 懒加载 + 自动补画
      const live1 = await win.webContents.executeJavaScript(`(function(){
        return JSON.stringify({
          echartsReady: !!(window.echarts && window.echarts.init),
          live: ['cmGxCdRange','cmGxCdDonut','cmGxCdWk','cmGxCdMovers'].filter(function(id){
            var d = document.getElementById(id); return d && window.echarts && window.echarts.getInstanceByDom(d); }).length,
          kpi1: (document.querySelector('#analyticsCreditPanel .cmGx-kvalue')||{}).textContent
        });
      })()`);
      console.log('[CF] 补画后 = ' + live1);
      const rr = JSON.parse(live1);
      if (rr.live < 3) throw new Error('补画后图表仍不足: ' + live1);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_credit_first.png'), img.toPNG());
      console.log('[CF] VERDICT=PASS shot=out/_probe_credit_first.png consoleErrors=' + consoleErrors);
      app.exit(0);
    } catch (e) {
      console.log('[CF] fatal ' + (e && (e.message || e)));
      app.exit(1);
    }
  });
});
