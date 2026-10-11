/* 数据分析图表引擎端到端探针（v1.3.0）：
   真码激活（一次性密钥对）→ 注入 3 场考试示例数据 → 进成绩 tab → 断言 ECharts 6 图实例 +
   KPI/预警/排名骨架 + 暗色 MutationObserver 重渲染 + console-error 计零 → 截图。
   运行：先卸 ELECTRON_RUN_AS_NODE，再 node_modules\electron\dist\electron.exe _probe_dataviz.js */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const proCore = require('./src/pro.core.cjs');

const ed = proCore.ed;
const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

app.setPath('userData', path.join(os.tmpdir(), 'cm_dataviz_probe_' + Date.now()));
app.whenReady().then(async function () {
  const priv = process.env.CM_PRO_PRIV || hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain: require('electron').ipcMain, app, fs, path, net: require('electron').net, pub: () => pub, claimApi: '' });
  console.log('[DV] keypair ready pub=' + pub.slice(0, 8) + '…');

  const win = new BrowserWindow({
    width: 1280, height: 860, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  let consoleErrors = 0;
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) { consoleErrors++; console.log('[DV][console-err] ' + String(message).slice(0, 200)); }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    let STEP = 'init';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const jsx = async (s) => {
      try { return await win.webContents.executeJavaScript(s); }
      catch (e) { console.log('[DV] renderer-err @' + STEP + ' = ' + String(e && (e.message || e)).slice(0, 200)); throw e; }
    };
    try {
      STEP = '准备';
      await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1500);
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);

      STEP = '激活 Pro（一次性密钥真码）';
      const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
      let reqObj = null;
      if (req) {
        reqObj = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      } else {
        await jsx('window.navigateTo("settings");1'); await wait(600);
        await jsx('window.seatExportImage();1'); await wait(500);
        const req2 = await jsx('document.getElementById("cmProReq").value');
        reqObj = JSON.parse(Buffer.from(req2.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      }
      const lic = { v: 1, tier: 'early', sn: 11, eh: reqObj.eh, dev: reqObj.dev, ts: Math.floor(Date.now() / 1000) };
      lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
      await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
      await jsx('document.getElementById("cmProGo").click();1');
      await wait(900);
      const act = await jsx('(JSON.parse(localStorage.getItem("cmProCache")||"{}").active===true)');
      console.log('[DV] 激活 =', act);
      if (!act) throw new Error('激活失败');

      STEP = '注入示例考试数据';
      const inj = await jsx(`(function(){
        var subs=['语文','数学','英语','物理','化学','生物','政治','历史'];
        var names=['王梓涵','李思远','张若曦','刘宇轩','陈雨桐','杨浩然','赵欣怡','黄子墨','周诗琪','吴俊杰','徐静姝','孙志远','马嘉禾','朱思睿','胡欣然','郭明轩','林清越','何紫萱','高子涵','罗一鸣','郑晓萌','梁宇航','谢雨欣','宋知远','唐书瑶','许博文','韩冰玉','冯天翼','邓芷晴','曹俊驰','彭雅雯','曾子航','肖沐辰','田雨澄','董思成','潘奕辰','袁明哲','蔡文静','蒋亦菲','余承泽','杜若飞','叶知秋','程雪宁','苏子瞻','吕星辰'];
        state.students = names.map(function(n,i){ return {id:990001+i, name:n}; });
        state.nextStudentId = 990100;
        state.nextExamId = 990004;
        function mkExam(id,name,date,shift,ex){
          var scores={};
          state.students.forEach(function(s,i){
            var row={};
            var abil = 0.46 + ((i*37)%50)/100;
            subs.forEach(function(sj,ki){
              row[sj] = Math.max(28, Math.min(100, Math.round(abil*100 + ((i*7+ki*11)%13) - 6 + ex*((i*31)%9-4))));
            });
            scores[s.id]=row;
          });
          return {id:id,name:name,date:date,subjects:subs.slice(),scores:scores};
        }
        state.exams=[mkExam(990001,'月考一','2026-09-20',0,0),mkExam(990002,'月考二','2026-10-18',2,1),mkExam(990003,'期中考试','2026-11-15',4,2)];
        return 'exams='+state.exams.length;
      })()`);
      console.log('[DV] 数据 =', inj);

      STEP = '进数据分析 → 成绩 tab';
      await jsx('window.navigateTo("analytics");1');
      await wait(800);
      await jsx('window.switchAnalyticsTab("grade");1');
      await wait(3000);                         // echarts 按需加载 + 首次渲染

      STEP = '断言引擎接管与图表实例';
      const r = await jsx(`(function(){
        var ids=['cmGxHist','cmGxDist','cmGxSubj','cmGxRadar','cmGxTrend','cmGxSlope'];
        var live=0, w=0;
        ids.forEach(function(id){ var d=document.getElementById(id); if(d&&window.echarts.getInstanceByDom(d)){live++; if(window.echarts.getInstanceByDom(d).getWidth()>50)w++;} });
        var old = document.querySelector('.grade-comparison-chart');
        return JSON.stringify({
          echarts: window.echarts ? window.echarts.version : null,
          wrapped: !!window.renderGradeAnalyticsDetail.__cmGradeEng,
          kpis: document.querySelectorAll('.cmGx-kpi').length,
          live: live, sized: w,
          legacyLeft: !!old,
          warnEl: !!document.getElementById('cmGxWarn'),
          topRows: document.querySelectorAll('.cmGx-rank').length
        });
      })()`);
      console.log('[DV] 引擎 =', r);
      const rr = JSON.parse(r);
      if (!rr.wrapped) throw new Error('renderGradeAnalyticsDetail 未被接管');
      if (rr.live < 5 || rr.sized < 5) throw new Error('图表实例不足 live=' + rr.live + ' sized=' + rr.sized);
      if (rr.kpis !== 5) throw new Error('KPI 卡数量异常=' + rr.kpis);
      if (rr.legacyLeft) throw new Error('仍残留旧版 CSS 图表');
      if (rr.topRows < 10) throw new Error('排名行不足');

      STEP = '截图（亮色）';
      const img1 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_light.png'), img1.toPNG());

      STEP = '暗色重渲染（MutationObserver）';
      await jsx('document.documentElement.classList.add("dark");1');
      await wait(1500);
      const r2 = await jsx(`(function(){
        var ids=['cmGxHist','cmGxDist','cmGxSubj','cmGxRadar','cmGxTrend','cmGxSlope'];
        var live=0;
        ids.forEach(function(id){ var d=document.getElementById(id); if(d&&window.echarts.getInstanceByDom(d))live++; });
        return JSON.stringify({live:live, dark:document.documentElement.classList.contains('dark'),
          title: (document.querySelector('#cmGxHist')||{}).offsetHeight});
      })()`);
      console.log('[DV] 暗色 =', r2);
      const rr2 = JSON.parse(r2);
      if (rr2.live < 5) throw new Error('暗色重渲染后实例不足=' + rr2.live);
      const img2 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_dark.png'), img2.toPNG());

      STEP = '切到期中考试（斜率图应真渲染）';
      await jsx('document.documentElement.classList.remove("dark");var s=document.getElementById("gradeAnalyticsExamSelect");s.value="990003";s.onchange?s.onchange():window.renderGradeAnalyticsDetail();1');
      await wait(2200);
      const r3 = await jsx(`(function(){
        var d=document.getElementById('cmGxSlope');
        var inst=d&&window.echarts.getInstanceByDom(d);
        var s=document.getElementById('gradeAnalyticsExamSelect');
        return JSON.stringify({sel:s?s.value:null, kpi1:(document.querySelector(".cmGx-kvalue")||{}).textContent,
          slope: inst ? ('live:'+inst.getWidth()+'x'+inst.getHeight()) : (d?d.textContent.slice(0,30):'missing')});
      })()`);
      console.log('[DV] 期中 =', r3);
      if (String(r3).indexOf('live:') < 0) throw new Error('斜率图未渲染: ' + r3);
      const kpiAfterShot = await jsx('document.querySelector(".cmGx-kvalue").textContent');
      const img3 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_final.png'), img3.toPNG());
      console.log('[DV] 截图后 KPI =', kpiAfterShot);

      console.log('[DV] consoleErrors=' + consoleErrors);
      if (consoleErrors > 0) throw new Error('console-error 计数 ' + consoleErrors);
      console.log('[DV] VERDICT=PASS shots=out/_probe_dataviz_light.png + out/_probe_dataviz_dark.png');
      app.exit(0);
    } catch (e) {
      console.log('[DV] fatal at ' + STEP + ' = ' + (e && (e.message || e)));
      if (e && e.stack) console.log('[DV] stack ' + String(e.stack).split('\n').slice(0, 4).join(' | '));
      try {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_fatal.png'), img.toPNG());
      } catch (e2) {}
      app.exit(1);
    }
  });
});
