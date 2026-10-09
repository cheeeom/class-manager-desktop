/* M3 学期报告引擎全链探针（v1.1.0 Pro 核心）：
   未激活点入口弹引导框 → 真码激活 → 生成个人报告（寄语保存）→ 班级报告 → PDF 落盘
   运行：env -u ELECTRON_RUN_AS_NODE CM_PROBE_PDF=1 ./node_modules/electron/dist/electron.exe _probe_report.js
   （不传 CM_PRO_PRIV 则自动生成一次性密钥对） */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const proCore = require('./src/pro.core.cjs');

const ed = proCore.ed;
const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

app.setPath('userData', path.join(os.tmpdir(), 'cm_rpt_probe_' + Date.now()));
app.whenReady().then(async function () {
  const priv = process.env.CM_PRO_PRIV || hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain, app, fs, path, net: require('electron').net, pub: () => pub, claimApi: '' });
  console.log('[RPT] keypair ready pub=' + pub.slice(0, 8) + '…');

  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (e, level, message) {
    if (level >= 3) console.log('[RPT][console-err] ' + String(message).slice(0, 160));
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.once('did-finish-load', async function () {
    let STEP = 'init';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const jsx = async (s) => {
      try { return await win.webContents.executeJavaScript(s); }
      catch (e) {
        console.log('[RPT] renderer-err @' + STEP + ' = ' + String(e && (e.message || e)).slice(0, 200));
        throw e;
      }
    };
    try {
      STEP = '准备';
      await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
      await wait(1500);
      await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
      await wait(1200);

      STEP = '造测试数据';
      const seeded = await jsx('(function(){' +
        'state.students.push({id:901,sid:"2024001",name:"张三",credit:106,creditBase:100,tags:["1栋-101室"],profile:{}});' +
        'state.students.push({id:902,sid:"2024002",name:"李四",credit:104,creditBase:100,tags:[],profile:{}});' +
        'state.nextId=903;' +
        'var t=Date.now();' +
        'state.operations.push({id:5001,studentId:901,studentName:"张三",amount:5,coin:5,reason:"课堂发言",time:t-86400000*3});' +
        'state.operations.push({id:5002,studentId:901,studentName:"张三",amount:3,coin:3,reason:"作业优秀",time:t-86400000*2});' +
        'state.operations.push({id:5003,studentId:901,studentName:"张三",amount:-2,coin:-1,reason:"迟到早退",time:t-86400000});' +
        'state.operations.push({id:5004,studentId:902,studentName:"李四",amount:4,coin:4,reason:"课堂发言",time:t-86400000});' +
        'state.nextOpId=5005;' +
        'state.leaves.push({id:301,studentId:901,type:"sick",startDate:"2026-09-20",startPeriod:"am",endDate:"2026-09-21",endPeriod:"pm",duration:2,reason:"感冒",status:"returned",createdAt:"2026-09-20T08:00:00",history:[]});' +
        'state.nextLeaveId=302;' +
        'state.exams.push({id:41,name:"月考一",date:"2026-10-05",subjects:["语文","数学"],scores:{901:{"语文":88,"数学":95},902:{"语文":76,"数学":82}}});' +
        'state.nextExamId=42;' +
        'return state.students.length;})()');
      console.log('[RPT] 种子学生数 =', seeded);

      STEP = '①未激活点入口';
      await jsx('window.navigateTo("settings");1');
      await wait(600);
      await jsx('var e=document.getElementById("cmNavReport");e?e.click():0;1');
      await wait(400);
      let r = await jsx('(function(){var m=document.getElementById("cmDeskProModal");return JSON.stringify({modal:!!m,h3:m?(m.querySelector("h3")||{}).textContent:null});})()');
      console.log('[RPT] ①未激活点报告入口 =', r);

      STEP = '②真码激活';
      const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
      const reqObj = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      const lic = { v: 1, tier: 'early', sn: 8, eh: reqObj.eh, dev: reqObj.dev, ts: Math.floor(Date.now() / 1000) };
      lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
      await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
      await jsx('document.getElementById("cmProGo").click();1');
      await wait(900);

      STEP = '③激活后开面板+个人报告';
      await jsx('var e=document.getElementById("cmNavReport");e?e.click():0;1');
      await wait(400);
      await jsx('var t=document.getElementById("cmRptCmt");if(t)t.value="继续保持，期末冲一波！";1');
      await jsx('var g=document.getElementById("cmRptGen");g?g.click():0;1');
      await wait(500);
      r = await jsx('(function(){var p=document.getElementById("cmRptPrev");var c=p?p.querySelector("canvas"):null;' +
        'var ink=0;if(c){var d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(var i=0;i<d.length;i+=4){if(d[i+3]!==0&&(Math.abs(d[i]-253)>18||Math.abs(d[i+1]-251)>18||Math.abs(d[i+2]-247)>18))ink++;}}' +
        'return JSON.stringify({canvas:!!c,w:c?c.width:0,h:c?c.height:0,inkPx:ink});})()');
      console.log('[RPT] ③个人报告画布 =', r);
      if (!(typeof r === 'string' && r.indexOf('"inkPx":') > 0 && JSON.parse(r).inkPx > 3000)) throw new Error('个人报告画布疑似空白');

      STEP = '④班级报告';
      await jsx('var t=document.getElementById("cmRptTabCls");t?t.click():0;1');
      await jsx('var g=document.getElementById("cmRptGen");g?g.click():0;1');
      await wait(500);
      r = await jsx('(function(){var p=document.getElementById("cmRptPrev");var c=p?p.querySelector("canvas"):null;' +
        'var ink=0;if(c){var d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(var i=0;i<d.length;i+=4){if(d[i+3]!==0&&(Math.abs(d[i]-253)>18||Math.abs(d[i+1]-251)>18||Math.abs(d[i+2]-247)>18))ink++;}}' +
        'return JSON.stringify({canvas:!!c,w:c?c.width:0,h:c?c.height:0,inkPx:ink});})()');
      console.log('[RPT] ④班级报告画布 =', r);
      if (!(typeof r === 'string' && JSON.parse(r).inkPx > 3000)) throw new Error('班级报告画布疑似空白');

      STEP = '⑤PDF 落盘';
      await jsx('var b=document.getElementById("cmRptPdf");b?b.click():0;1');
      await wait(2500);
      r = await jsx('document.getElementById("cmRptMsg").textContent');
      console.log('[RPT] ⑤PDF 消息 =', String(r).slice(0, 120));
      let pdfOk = false, pdfSize = 0;
      const mm = String(r).match(/已保存：(.+\.pdf)/);
      if (mm) { try { pdfSize = fs.statSync(mm[1]).size; pdfOk = pdfSize > 1000; } catch (e) {} }
      console.log('[RPT] ⑤PDF 文件 =', JSON.stringify({ ok: pdfOk, size: pdfSize }));

      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'out', '_probe_report.png'), img.toPNG());
      console.log('[RPT] shot=out/_probe_report.png');
      const fail = !(r && String(r).indexOf('已保存') >= 0) || !pdfOk;
      console.log('[RPT] verdict=' + (fail ? 'FAIL' : 'PASS'));
      app.exit(fail ? 1 : 0);
    } catch (e) {
      console.log('[RPT] fatal at ' + STEP + ' = ' + (e && (e.message || e)));
      if (e && e.stack) console.log('[RPT] stack ' + String(e.stack).split('\n').slice(0, 4).join(' | '));
      app.exit(1);
    }
  });
});
