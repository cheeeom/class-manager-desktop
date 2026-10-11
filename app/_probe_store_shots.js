/* 商店上架截图探针（1920×1080）：注入示例数据 → 五页截图（dashboard/analytics-成绩/留痕/荣誉/证书预览） */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_store_shots_' + Date.now()));
app.whenReady().then(function () {
  const win = new BrowserWindow({
    width: 1920, height: 1080, show: false, useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const OUT = path.join(__dirname, 'out', 'store-shots');
    try {
      fs.mkdirSync(OUT, { recursive: true });
      await win.webContents.executeJavaScript('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1600);
      await win.webContents.executeJavaScript('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1300);
      /* 示例数据：6 生 + 18 流水 + 3 场考试 + 荣誉 */
      await win.webContents.executeJavaScript(`(function(){
        var subs=['语文','数学','英语','物理','化学','生物','政治','历史'];
        var names=['陈曦','林浩然','苏雨桐','王一鸣','赵可欣','周子墨','李云舒','孟晚舟','沈星河','陆知行','顾清源','江晚晴','叶修远','程锦时','许星辞','秦子衿','方鹤鸣','温言溪','宋清欢','钟意迟'];
        state.students = names.map(function(n,i){ var s={id:990001+i,sid:'S2026'+('0'+(i+1)).slice(-2),name:n,credit:0,tags:[]};
          s.credit = [122,118,158,73,200,55,141,132,176,98,164,127,109,183,91,150,116,69,207,84][i]||100; return s; });
        state.nextStudentId = 990100; state.nextExamId = 990004; state.nextOpId = 990019;
        var subs3=['语文','数学','英语'];
        state.exams=[{id:990001,name:'月考一',date:'2026-09-20',subjects:subs.slice(),scores:{}},{id:990002,name:'期中考试',date:'2026-10-15',subjects:subs.slice(),scores:{}}];
        state.exams.forEach(function(e,ei){ state.students.forEach(function(s,i){ var row={}; var abil=0.5+((i*37)%45)/100;
          subs.forEach(function(sj,ki){ row[sj]=Math.max(30,Math.min(100,Math.round(abil*100+((i*7+ki*11+ei*9)%13)-4))); }); e.scores[s.id]=row; }); });
        var cats=['常规','班会','谈话','活动','事务'];
        var now=Date.now();
        for(var i=0;i<26;i++){ var si=i%20;
          state.operations.unshift({id:990001+i,studentId:990001+si,studentName:names[si],amount:(i%3===0?-2:3)+(i%4),coin:(i%3===0?0:5),
            reason:(i%2?'课堂表现':'作业完成'),time:now-(i%6)*86400000-i*60000}); }
        state.workLogs=[{id:990301,date:'2026-10-11',category:'班会',title:'期中动员班会',content:'强调了下周期中考试的复习安排与心态调整，同学们状态不错。',images:[]},
          {id:990302,date:'2026-10-10',category:'谈话',title:'与周子墨谈心',content:'了解近期学习状态，约定每天放学后完成作业再离校。',images:[]}];
        state.honors=[{id:990401,title:'期末测评',date:'2026-10-08',scope:'个人',level:'市级',persons:['苏雨桐'],desc:'市级三好学生'},
          {id:990402,title:'校运会 4×100 接力',date:'2026-10-06',scope:'集体',level:'校级',persons:[],desc:'班级接力赛全校第一'}];
        return 'ready';
      })()`);
      await wait(600);
      const shot = async (name) => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(OUT, name), img.toPNG());
        console.log('[SHOTS] ' + name);
      };
      await win.webContents.executeJavaScript('window.navigateTo("dashboard");1');
      await wait(2200);
      await shot('01-dashboard.png');
      await win.webContents.executeJavaScript('window.navigateTo("worklogs");1');
      await wait(1500);
      await shot('02-worklogs.png');
      await win.webContents.executeJavaScript('window.navigateTo("analytics");1');
      await wait(900);
      await win.webContents.executeJavaScript('window.switchAnalyticsTab("grade");1');
      await wait(2600);
      await shot('03-analytics.png');
      await win.webContents.executeJavaScript('window.navigateTo("honors");1');
      await wait(1400);
      await shot('04-honors.png');
      await win.webContents.executeJavaScript('window.gxHonorPreview(990401);1');
      await wait(1200);
      await shot('05-cert.png');
      console.log('[SHOTS] ALL-DONE -> ' + OUT);
      app.exit(0);
    } catch (e) {
      console.log('[SHOTS] fatal ' + (e && (e.message || e)));
      app.exit(1);
    }
  });
});
