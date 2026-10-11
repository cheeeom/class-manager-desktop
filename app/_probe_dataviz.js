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
          kpis: document.querySelectorAll('#analyticsGradePanel .cmGx-kpi').length,
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

      STEP = '学分 tab（P1）：注入学分字段与流水';
      const rOp = await jsx(`(function(){
        state.students.forEach(function(s,i){ s.credit = 40 + (i*53)%230; });
        var now = Date.now();
        state.operations = [];
        for (var i = 0; i < 42; i++) {
          state.operations.push({id: 880001+i, studentId: 990001 + ((i*17) % state.students.length), studentName: 'x',
            amount: (i%3===0?-1:1)*(2+(i%5)), coin: 0, reason: (i%2?'学习':'纪律'),
            time: now - (i%7)*86400000 - i*60000, by:'cm', byName:'班主任', byPost:'班主任'});
        }
        state.nextOpId = 890000;
        return 'ops='+state.operations.length;
      })()`);
      console.log('[DV] 流水 =', rOp);
      await jsx('window.switchAnalyticsTab("credit");1');   // 切回学分 tab（链式补渲染路径）
      await wait(600);
      await jsx('window.renderAnalytics();1');              // 数据已变 → 全量重渲染（模拟 refreshCreditViews）
      await wait(1800);
      const r4 = await jsx(`(function(){
        var ids=['cmGxCdRange','cmGxCdDonut','cmGxCdWk','cmGxCdMovers'];
        var live=0;
        ids.forEach(function(id){ var d=document.getElementById(id); if(d&&window.echarts.getInstanceByDom(d))live++; });
        return JSON.stringify({
          kpis: document.querySelectorAll('#analyticsCreditPanel .cmGx-kpi').length,
          live: live,
          legacyCanvas: !!document.getElementById('rangeChart'),
          movers: (function(){ var d=document.getElementById('cmGxCdMovers'); if(!d) return 'missing';
            var inst=window.echarts.getInstanceByDom(d); return inst?('live:'+inst.getWidth()+'x'+inst.getHeight()):d.textContent.slice(0,20); })()
        });
      })()`);
      console.log('[DV] 学分 =', r4);
      const rr4 = JSON.parse(r4);
      if (rr4.kpis !== 6) throw new Error('学分 KPI 卡数量异常=' + rr4.kpis);
      if (rr4.live < 4) throw new Error('学分图表实例不足=' + rr4.live);
      if (rr4.legacyCanvas) throw new Error('旧 canvas 仍存在');
      const mh = /live:\d+x(\d+)/.exec(rr4.movers);
      if (mh && parseInt(mh[1], 10) < 100) throw new Error('进退步榜容器高度异常: ' + rr4.movers);
      const img4 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_credit.png'), img4.toPNG());

      STEP = '首页（P2）：学分分布接管';
      await jsx('window.navigateTo("dashboard");1');
      await wait(1600);
      const r5 = await jsx(`(function(){
        var d=document.getElementById('cmGxDashDist');
        var inst=d&&window.echarts.getInstanceByDom(d);
        return JSON.stringify({dash: inst?('live:'+inst.getWidth()+'x'+inst.getHeight()):(d?'box-noinst':'missing'),
          canvasHidden: (document.getElementById('distChart')||{}).style.display==='none'});
      })()`);
      console.log('[DV] 首页 =', r5);
      if (String(r5).indexOf('live:') < 0) throw new Error('首页分布图未渲染: ' + r5);

      STEP = '公示页（P2）：四图接管';
      await jsx('window.navigateTo("publicity");1');
      await wait(2000);
      const r6 = await jsx(`(function(){
        var ids=['pubTrendChart__gx','pubDailyChart__gx','pubDistChart__gx','pubReasonChart__gx'];
        var live=0, sized=0;
        ids.forEach(function(id){ var d=document.getElementById(id); var inst=d&&window.echarts.getInstanceByDom(d); if(inst){live++; if(inst.getHeight()>50)sized++;} });
        return JSON.stringify({pub: live, sized: sized, canvasHidden: (document.getElementById('pubTrendChart')||{}).style.display==='none'});
      })()`);
      console.log('[DV] 公示 =', r6);
      const rr6 = JSON.parse(r6);
      if (rr6.pub < 4 || rr6.sized < 4) throw new Error('公示图表不足: ' + r6);
      if (!rr6.canvasHidden) throw new Error('原 canvas 未隐藏');
      await jsx('(() => { var d = document.getElementById("pubTrendChart__gx"); if (d) d.scrollIntoView({block: "center"}); })()');
      await new Promise(r => setTimeout(r, 600));
      const img5 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_publicity.png'), img5.toPNG());

      STEP = '工作留痕重设计（v1.4.0）';
      await jsx(`(function(){
        state.workLogs = state.workLogs || [];
        var today = new Date(); var ds = today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
        var px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        if (!state.workLogs.some(function(w){return w.id===990501;})) {
          state.workLogs.push({id:990501, date:ds, category:'常规', title:'探针留痕（带图）', content:'图表引擎探针注入', images:[px]});
        }
        return 'wl='+state.workLogs.length;
      })()`);
      await jsx('window.navigateTo("worklogs");1');
      await wait(1400);
      const r7 = await jsx(`(function(){
        var h2 = document.querySelector('#page-worklogs h2');
        var left = 0;
        document.querySelectorAll('#page-worklogs h2, #page-worklogs .btn').forEach(function(e){ if(/^\s*(📋|📥|＋|🔍)/.test(e.textContent)) left++; });
        return JSON.stringify({
          periods: document.querySelectorAll('#gxWlPeriods button').length,
          dateHidden: (document.getElementById('wlDate')||{}).style.display==='none',
          cards: document.querySelectorAll('#wlList .wl-card').length,
          stats: (document.getElementById('wlStats')||{}).textContent,
          h2EmojiLeft: /^\s*📋/.test(h2 ? h2.textContent : 'x'),
          btnEmojiLeft: left,
          sprite: !!document.getElementById('gxSprite'),
          gxIcons: document.querySelectorAll('svg.gx-ic').length
        });
      })()`);
      console.log('[DV] 留痕 =', r7);
      const rr7 = JSON.parse(r7);
      if (rr7.periods !== 4 || !rr7.dateHidden) throw new Error('周期筛选未就位: ' + r7);
      if (rr7.cards < 1) throw new Error('留痕卡片未渲染');
      if (rr7.h2EmojiLeft) throw new Error('页头 emoji 未替换');
      if (!rr7.sprite || rr7.gxIcons < 5) throw new Error('图标体系未生效: ' + rr7.gxIcons);
      const img6 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_worklogs.png'), img6.toPNG());

      STEP = '荣誉墙重设计（v1.4.0）';
      await jsx(`(function(){
        state.honors = state.honors || [];
        if (!state.honors.some(function(h){return h.id===990601;})) {
          state.honors.push({id:990601, title:'期末测评', date:'2026-10-08', scope:'个人', level:'市级', persons:['陈曦'], desc:'市级三好学生'});
        }
        localStorage.setItem('cm_school_name','XX市第一中学');
        return 'hn='+state.honors.length;
      })()`);
      await jsx('window.navigateTo("honors");1');
      await wait(1400);
      const r8 = await jsx(`(function(){
        var navUse = document.querySelector('.nav-item[data-page="honors"] .ic use');
        return JSON.stringify({
          cards: document.querySelectorAll('#honorList .gxH-card').length,
          navAward: navUse ? navUse.getAttribute('href') : null,
          schoolCard: !!document.getElementById('cmDeskSchool')
        });
      })()`);
      console.log('[DV] 荣誉墙 =', r8);
      const rr8 = JSON.parse(r8);
      if (rr8.cards < 1) throw new Error('荣誉卡片未渲染');
      if (rr8.navAward !== '#gx-award') throw new Error('荣誉墙导航图标未区分: ' + rr8.navAward);
      if (!rr8.schoolCard) throw new Error('学校信息卡未注入');
      await jsx('window.gxHonorPreview(990601);1');
      await wait(900);
      const r9 = await jsx(`(function(){
        var cv = document.getElementById('gxHonorCertCv');
        if (!cv) return JSON.stringify({overlay:false});
        var d = cv.getContext('2d').getImageData(0, 170, 1500, 110).data;   // 荣誉证书标题字带（y≈170-280）
        var red = 0;
        for (var i = 0; i < d.length; i += 40) { if (d[i] > 120 && d[i+1] < 90 && d[i+2] < 90) red++; }
        return JSON.stringify({overlay:true, titleRedPx: red, dlBtn: !!document.getElementById('gxHonorDl')});
      })()`);
      console.log('[DV] 证书预览 =', r9);
      const rr9 = JSON.parse(r9);
      if (!rr9.overlay) throw new Error('证书预览弹窗未打开');
      if ((rr9.titleRedPx || 0) < 8) throw new Error('证书标题区未检出红色字（重绘未生效）');
      const img7 = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_dataviz_honor.png'), img7.toPNG());

      STEP = '登录页横幅摘除（v1.4.1）';
      await jsx('location.reload();1');
      await wait(2200);
      const r10 = await jsx(`(function(){
        var lo = document.getElementById('loginOverlay');
        return JSON.stringify({
          banner: document.getElementById('eolBanner') ? 'exists' : 'removed',
          overlayTop: lo ? getComputedStyle(lo).top : 'none',
          drawerLeak: (function(){ var top = document.elementsFromPoint(16, 16)[0]; var c = top ? (String(top.className) + ' ' + top.id) : ''; return c.indexOf('more-drawer') >= 0 || c.indexOf('more-item') >= 0; })()
        });
      })()`);
      console.log('[DV] 登录页 =', r10);
      const rr10 = JSON.parse(r10);
      if (rr10.banner !== 'removed') throw new Error('停更横幅未摘除');
      if (rr10.overlayTop !== '0px') throw new Error('登录层未回到顶部: ' + rr10.overlayTop);
      if (rr10.drawerLeak) throw new Error('顶部缝隙仍漏出抽屉');

      STEP = '安全卡 v2 + 单机清空（v1.4.1）';
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);
      await jsx('window.navigateTo("settings");1');
      await wait(800);
      const r11 = await jsx(`(function(){
        return JSON.stringify({
          loginEdit: !!document.getElementById('gxSecLoginEdit'),
          loginOff: !!document.getElementById('gxSecLoginOff'),
          adminOff: !!document.getElementById('gxSecAdminOff'),
          loginState: (document.getElementById('gxSecLoginState')||{}).textContent,
          adminState: (document.getElementById('gxSecAdminState')||{}).textContent
        });
      })()`);
      console.log('[DV] 安全卡 =', r11);
      const rr11 = JSON.parse(r11);
      if (!rr11.loginEdit || !rr11.loginOff || !rr11.adminOff) throw new Error('安全卡 v2 操作按钮缺失: ' + r11);
      await jsx('window.clearData();1');
      await wait(600);
      const gateOpen = await jsx('!!document.querySelector(".cmDesk-mask")');
      if (!gateOpen) throw new Error('清空闸（纸墨风弹窗）未弹出');
      await jsx('var m=document.querySelector(".cmDesk-mask input"); m.value="清空";1');
      await jsx('document.querySelector(".cmDesk-mask .btn-primary").click();1');
      await wait(900);
      const r12 = await jsx(`(function(){
        var st = state;
        return JSON.stringify({
          students: (st.students||[]).length, ops: (st.operations||[]).length,
          toast: (document.querySelector('.toast')||{}).textContent || '',
          maskLeft: !!document.querySelector('.cmDesk-mask'),
          nativeConfirm: window.confirm.toString().indexOf('[native code]') >= 0
        });
      })()`);
      console.log('[DV] 清空 =', r12);
      const rr12 = JSON.parse(r12);
      if (rr12.students !== 0 || rr12.ops !== 0) throw new Error('清空未生效: ' + r12);
      if (String(rr12.toast).indexOf('单机') < 0) throw new Error('清空 toast 非单机口径: ' + rr12.toast);
      if (rr12.maskLeft) throw new Error('弹窗未关闭');

      console.log('[DV] consoleErrors=' + consoleErrors);
      if (consoleErrors > 0) throw new Error('console-error 计数 ' + consoleErrors);
      console.log('[DV] VERDICT=PASS shots=out/_probe_dataviz_{light,dark,final,credit}.png');
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
