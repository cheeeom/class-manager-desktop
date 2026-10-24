/* 商店截图探针：真实界面 + 示例数据 + 测试钥激活 Pro → 三页 1600×900 PNG
   页面：①工作台首页（KPI+学分分布）②数据分析（4 图）③学分公示（海报）
   运行：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_store_shot.js */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const proCore = require('./src/pro.core.cjs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_store_shot_' + Date.now()));
app.whenReady().then(async function () {
  const ed = proCore.ed;
  const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const priv = hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain: require('electron').ipcMain, app, fs: require('fs'), path, net: require('electron').net, pub: () => pub, claimApi: '' });

  // 内容区 1536x864 逻辑 px × DPR 1.25 = 1920x1080 物理 px（商店标准 16:9）
  const win = new BrowserWindow({
    width: 1536, height: 864, useContentSize: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.webContents.on('console-message', function (_e, level, msg, line, src) {
    if (level >= 2) console.log('[RENDERER]', level, String(msg).slice(0, 220), '@' + src + ':' + line);
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const jsx = (s) => win.webContents.executeJavaScript(s);
  // 强设内容区：1536x864 逻辑 px × DPR 1.25 = 1920x1080 物理 px（精确 16:9）
  win.setContentSize(1536, 864);
  console.log('[SHOT] contentSize after set =', JSON.stringify(win.getContentSize()));
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await wait(1200);

  // 跳过向导 → 零密码进主界面
  await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");location.reload();1');
  await wait(1500);
  await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
  await wait(1200);

  // 测试钥激活 Pro（经考勤页弹窗走正规 activate 链）
  await jsx('window.navigateTo("credits");1');
  await wait(800);
  await jsx('document.getElementById("cmProGo") ? 0 : (document.getElementById("cmDeskPagePill") ? document.getElementById("cmDeskPagePill").click() : 0);1');
  await wait(600);
  const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
  if (!req) { console.log('[SHOT] ERR: no req code'); app.exit(1); }
  const ro = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const lic = { v: 1, tier: 'std', sn: 1, eh: ro.eh, dev: ro.dev, ts: Math.floor(Date.now() / 1000) };
  lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
  await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
  await jsx('document.getElementById("cmProGo").click();1');
  await wait(1200);
  console.log('[SHOT] activated');

  // 注入示例数据（v1.3.0 升级版：18 流水 + 期中考试）并压掉指引弹窗
  // cmSampleInject 是注入层 IIFE 私有函数，经 __CM_DESK_TEST 导出口调用
  // 先铺一份示例课表（8 节 × 周一~周五，科目全在 TS_SUBJECT_GROUP 内 ⇒ 自动配色），
  // 否则首页「课程表」卡是空态，商店截图减分
  const timetableJs = '(function(){' +
    'var TS=[["08:00-08:45","上午"],["08:55-09:40","上午"],["09:50-10:35","上午"],["10:45-11:30","上午"],["14:00-14:45","下午"],["14:55-15:40","下午"],["15:50-16:35","下午"],["16:45-17:30","下午"]];' +
    'state.schedule={name:"高2026级一班 · 秋季课表",updatedAt:Date.now(),periods:TS.map(function(x){return {t:x[0],p:x[1]};}),cells:{}};' +
    'var W=[' +
    '[["语文","李铭"],["数学","王建国"],["英语","张丽华"],["物理","刘志强"],["体育","陈国栋"],["化学","赵芳"],["生物","钱明"],["信息技术","孙晓燕"]],' +
    '[["数学","王建国"],["语文","李铭"],["英语","张丽华"],["化学","赵芳"],["物理","刘志强"],["历史","周文彬"],["体育","陈国栋"],["音乐","吴悦"]],' +
    '[["英语","张丽华"],["数学","王建国"],["语文","李铭"],["生物","钱明"],["化学","赵芳"],["政治","郑红梅"],["信息技术","孙晓燕"],["美术","冯婧"]],' +
    '[["物理","刘志强"],["英语","张丽华"],["数学","王建国"],["语文","李铭"],["历史","周文彬"],["地理","许志远"],["体育","陈国栋"],["劳动","蒋小军"]],' +
    '[["语文","李铭"],["化学","赵芳"],["英语","张丽华"],["数学","王建国"],["政治","郑红梅"],["物理","刘志强"],["心理健康","林芳"],["班会","淳晏铭"]]' +
    '];' +
    'for(var d=0;d<W.length;d++)for(var i=0;i<W[d].length;i++)state.schedule.cells[(d+1)+"-"+(i+1)]={s:W[d][i][0],t:W[d][i][1]};' +
    'return Object.keys(state.schedule.cells).length;})()';
  const cellCount = await jsx(timetableJs);
  console.log('[SHOT] timetable cells =', cellCount);
  await jsx('var f=(window.__CM_DESK_TEST||{}).cmSampleInject;if(typeof f!=="function"){throw new Error("cmSampleInject not exported")}f();localStorage.removeItem("cmSampleTour");sessionStorage.removeItem("cmSampleSnap");1');
  await wait(1500);
  // 关掉可能残留的指引/弹窗层
  await jsx('document.querySelectorAll(".cmDesk-modal-overlay").forEach(function(m){m.remove();});1');
  // 隐藏窗口里 CSS 入场动画时钟不走（.stagger/.page 停在 opacity:0）→ 截图前强制显形；
  // 顺手压掉「有未导出的数据变更」红点（示例注入触发 saveData 必亮，截图里像渲染瑕疵）
  await jsx('var s=document.createElement("style");s.textContent=".page,.stagger,.cmGx-card{opacity:1 !important;animation:none !important}#exportBadge{display:none !important}";document.head.appendChild(s);1');
  await wait(300);

  const pages = [
    ['dashboard', 'store_shot_1_dashboard.png', 2600],
    ['analytics', 'store_shot_2_analytics.png', 2600],
    ['publicity', 'store_shot_3_publicity.png', 1800]
  ];
  console.log('[SHOT] env', await jsx('JSON.stringify({dpr:window.devicePixelRatio,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,iw:window.innerWidth,ih:window.innerHeight})'), 'contentSize=' + JSON.stringify(win.getContentSize()));
  for (const [pg, file, ms] of pages) {
    await jsx('window.navigateTo("' + pg + '");1');
    await wait(ms);
    const diag = await jsx('(function(){var el=document.getElementById("page-' + pg + '");var act=document.querySelector(".page.active");var cs=document.querySelectorAll("#page-' + pg + ' canvas");var hs=[];for(var i=0;i<cs.length;i++){var r=cs[i].getBoundingClientRect();hs.push(r.width+"x"+r.height)}var faint=[];if(cs.length){var n=cs[0];while(n&&n.id!=="content"){var st=getComputedStyle(n);if(parseFloat(st.opacity)<1)faint.push(n.className+"="+st.opacity);n=n.parentElement}}return JSON.stringify({exists:!!el,len:el?el.innerHTML.length:-1,active:act?act.id:null,op:el?getComputedStyle(el).opacity:null,canvases:hs,faint:faint});})()');
    console.log('[DIAG]', pg, diag);
    const img = await win.webContents.capturePage();
    const buf = img.toPNG();
    const out = path.join(__dirname, 'out', file);
    require('fs').writeFileSync(out, buf);
    console.log('[SHOT]', file, img.getSize().width + 'x' + img.getSize().height, Math.round(buf.length / 1024) + 'KB');
  }
  console.log('[SHOT] verdict=PASS');
  app.exit(0);
}).catch(function (e) {
  console.log('[SHOT] verdict=FAIL ' + String(e && (e.message || e)).slice(0, 200));
  app.exit(1);
});
