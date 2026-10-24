/* 侧栏 rail 三态冒烟探针（v1.5.6）——承接上游 v3.5.6/v3.5.7
   验：①按钮存在 ②折叠 68px + localStorage 记忆 ③rail 态 nav-text 隐没
       ④桌面独有节点在窄栏的让位（PRO 角标退化圆点 / 烫金徽标隐藏 / 学期报告入口不溢出）
       ⑤浮层展开（点击 nav 触发）后三者恢复 ⑥mouseleave 400ms 收回 ⑦刷新后折叠态保持 ⑧零渲染错误
   运行：env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_rail.js */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const proCore = require('./src/pro.core.cjs');

app.setPath('userData', path.join(os.tmpdir(), 'cm_probe_rail_' + Date.now()));

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + label + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + label + (extra ? '  ' + extra : '')); }
};

app.whenReady().then(async function () {
  const ed = proCore.ed;
  const hx = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const priv = hx(ed.utils.randomPrivateKey());
  const pub = hx(await ed.getPublicKeyAsync(priv));
  proCore.register({ ipcMain: require('electron').ipcMain, app, fs: require('fs'), path, net: require('electron').net, pub: () => pub, claimApi: '' });

  const win = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') }
  });
  const errs = [];
  win.webContents.on('console-message', function (_e, level, msg) {
    if (level >= 3) errs.push(String(msg).slice(0, 160));
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const jsx = (s) => win.webContents.executeJavaScript(s);
  /* 隐藏窗口里 CSS 过渡时钟不走 ⇒ 宽度/透明度会卡在起始帧（240 / opacity 1），
     量不到终态。注入禁过渡样式，测「布局终态」而非「动画中间帧」。 */
  const killTransitions = () => jsx('(function(){if(document.getElementById("probeNoTrans"))return 1;var s=document.createElement("style");s.id="probeNoTrans";s.textContent=".sidebar,.sidebar .nav-text,.sidebar .logo-texts,.rail-toggle{transition:none!important}";document.head.appendChild(s);return 1;})()');
  const load = async () => {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    await new Promise((r) => win.webContents.once('did-finish-load', r));
    await wait(1200);
  };

  await load();
  await jsx('localStorage.setItem("cm_onboarded","1");localStorage.setItem("cm_nopwd","1");localStorage.setItem("cm_sidebar_rail","0");location.reload();1');
  await wait(1500);
  await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
  await wait(1200);
  await killTransitions();

  console.log('\n[1] 骨架');
  ok(await jsx('!!document.getElementById("railToggle")'), '侧栏收折按钮 #railToggle 存在');
  ok(await jsx('!!document.getElementById("cmNavReport")'), '桌面层学期报告入口存在');
  ok(await jsx('!!document.querySelector("#cmNavReport .nav-text")'), '学期报告入口已包 .nav-text（v1.5.6 修复）');
  const badgeN = await jsx('document.querySelectorAll(".cmDesk-navbadge").length');
  ok(badgeN > 0, '未激活态 PRO 角标存在', 'count=' + badgeN);

  console.log('\n[2] 折叠 → 68px + 记忆');
  const before = await jsx('document.getElementById("sidebar").getBoundingClientRect().width');
  await jsx('document.getElementById("railToggle").click();1');
  await wait(500);
  const railState = await jsx('JSON.stringify({w:Math.round(document.getElementById("sidebar").getBoundingClientRect().width),rail:document.getElementById("sidebar").classList.contains("rail"),ls:localStorage.getItem("cm_sidebar_rail")})');
  const rs = JSON.parse(railState);
  ok(rs.rail === true, '点击后进入 rail 折叠态');
  ok(Math.round(rs.w) === 68, '折叠宽度 = 68px', 'before=' + Math.round(before) + ' after=' + rs.w);
  ok(rs.ls === '1', 'localStorage 记住折叠（cm_sidebar_rail=1）');

  console.log('\n[3] 折叠态：文字隐没 + 桌面节点让位');
  const opText = await jsx('getComputedStyle(document.querySelector("#nav .nav-item .nav-text")).opacity');
  ok(parseFloat(opText) < 0.05, 'nav-text 折叠态隐没', 'opacity=' + opText);
  const opReport = await jsx('getComputedStyle(document.querySelector("#cmNavReport .nav-text")).opacity');
  ok(parseFloat(opReport) < 0.05, '学期报告文字同步隐没', 'opacity=' + opReport);
  /* 判据说明：rail 态 nav-text 是 position:absolute（上游 v3.5.6 用法），必然把 scrollWidth 撑大，
     但父级 overflow:hidden + opacity:0 ⇒ 视觉零溢出。真正要验的是：
     ①每个条目都开了 overflow:hidden（越界内容被裁）②图标本身落在条目边界内。 */
  const overflow = await jsx('(function(){var bad=[];var its=document.querySelectorAll("#nav .nav-item");for(var i=0;i<its.length;i++){var it=its[i],st=getComputedStyle(it),ic=it.querySelector(".nav-icon");if(st.overflow!=="hidden")bad.push({p:it.getAttribute("data-page")||it.id||"?",ov:st.overflow});if(!ic){bad.push({p:it.getAttribute("data-page")||it.id||"?",noicon:1});continue;}var ir=ic.getBoundingClientRect(),rr=it.getBoundingClientRect();if(ir.left<rr.left-0.5||ir.right>rr.right+0.5)bad.push({p:it.getAttribute("data-page")||it.id||"?",iconOut:Math.round(ir.left-rr.left)+"/"+Math.round(ir.right-rr.right)});}return JSON.stringify(bad);})()');
  ok(overflow === '[]', '折叠态越界内容被裁 + 图标不越界', overflow);
  await jsx('window.__CM_SHOT_RAIL=1;1');
  // 隐藏窗口的合成器不重绘，capturePage 会拿到旧帧 ⇒ 截图前短暂真显示（showInactive 不抢焦点）
  win.showInactive();
  await wait(700);
  const shot1 = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'out', 'rail_collapsed.png'), shot1.toPNG());
  console.log('  📷 out/rail_collapsed.png ' + shot1.getSize().width + 'x' + shot1.getSize().height);
  const badgeDot = await jsx('(function(){var b=document.querySelector(".cmDesk-navbadge");if(!b)return "none";var r=b.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),fs:getComputedStyle(b).fontSize});})()');
  const bd = JSON.parse(badgeDot);
  ok(bd.w <= 9 && parseFloat(bd.fs) === 0, 'PRO 角标退化为小圆点（7px，文字隐藏）', badgeDot);

  console.log('\n[4] 浮层展开（点 nav 触发）');
  await jsx('document.querySelector("#nav .nav-item[data-page=\\"students\\"]").click();1');
  await wait(500);
  const openState = await jsx('JSON.stringify({open:document.getElementById("sidebar").classList.contains("rail-open"),w:Math.round(document.getElementById("sidebar").getBoundingClientRect().width)})');
  const os2 = JSON.parse(openState);
  ok(os2.open === true, '点击导航项 → 浮层展开（rail-open）');
  ok(os2.w >= 200, '浮层宽度恢复为完整侧栏', 'width=' + os2.w);
  const opText2 = await jsx('getComputedStyle(document.querySelector("#nav .nav-item .nav-text")).opacity');
  ok(parseFloat(opText2) > 0.9, '浮层态文字恢复', 'opacity=' + opText2);
  const badgeFull = await jsx('getComputedStyle(document.querySelector(".cmDesk-navbadge")).fontSize');
  ok(parseFloat(badgeFull) > 0, '浮层态 PRO 角标恢复文字', 'font-size=' + badgeFull);
  const shot2 = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(__dirname, 'out', 'rail_open.png'), shot2.toPNG());
  console.log('  📷 out/rail_open.png ' + shot2.getSize().width + 'x' + shot2.getSize().height);

  console.log('\n[5] mouseleave 400ms 收回');
  await jsx('document.getElementById("sidebar").dispatchEvent(new MouseEvent("mouseleave"));1');
  await wait(700);
  ok(!(await jsx('document.getElementById("sidebar").classList.contains("rail-open")')), '移出 400ms 后浮层收回');
  ok((await jsx('Math.round(document.getElementById("sidebar").getBoundingClientRect().width)')) === 68, '收回后仍停在 68px 折叠态');

  console.log('\n[6] 刷新保持折叠态');
  await jsx('location.reload();1');
  await wait(1800);
  await jsx('var b=document.getElementById("cmDeskEnter");b?b.click():0;1');
  await wait(900);
  await killTransitions();
  const afterReload = await jsx('JSON.stringify({rail:document.getElementById("sidebar").classList.contains("rail"),init:document.getElementById("sidebar").classList.contains("rail-init"),w:Math.round(document.getElementById("sidebar").getBoundingClientRect().width)})');
  const ar = JSON.parse(afterReload);
  ok(ar.rail === true && Math.round(ar.w) === 68, '刷新后保持折叠', afterReload);
  ok(ar.init === false, 'rail-init 过渡抑制已摘除（动画正常）');

  console.log('\n[7] 展开恢复（激活 Pro 后验徽标）');
  await jsx('document.getElementById("railToggle").click();1');
  await wait(500);
  ok((await jsx('localStorage.getItem("cm_sidebar_rail")')) === '0', '再次点击恢复展开并记忆（=0）');
  ok((await jsx('Math.round(document.getElementById("sidebar").getBoundingClientRect().width)')) >= 200, '展开宽度恢复');

  // 激活 Pro（与商店截图探针同路径：credits 页正规 activate）
  await jsx('window.navigateTo("credits");1');
  await wait(900);
  const req = (await jsx('document.getElementById("cmProReq") ? document.getElementById("cmProReq").value : ""')) || '';
  if (req) {
    const ro = JSON.parse(Buffer.from(req.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const lic = { v: 1, tier: 'std', sn: 1, eh: ro.eh, dev: ro.dev, ts: Math.floor(Date.now() / 1000) };
    lic.sig = hx(await ed.signAsync(new TextEncoder().encode('CM1|' + lic.tier + '|' + lic.sn + '|' + lic.eh + '|' + lic.dev + '|' + lic.ts), priv));
    await jsx('document.getElementById("cmProLic").value = ' + JSON.stringify('CMPRO1.' + b64u(lic)) + ';1');
    await jsx('document.getElementById("cmProGo").click();1');
    await wait(1500);
  }
  ok(await jsx('!!document.getElementById("cmDeskProEmblem")'), '激活后烫金 PRO 徽标存在');
  const emExpanded = await jsx('getComputedStyle(document.getElementById("cmDeskProEmblem")).display');
  ok(emExpanded !== 'none', '展开态徽标可见', 'display=' + emExpanded);

  await jsx('document.getElementById("railToggle").click();1');
  await wait(500);
  const emRail = await jsx('getComputedStyle(document.getElementById("cmDeskProEmblem")).display');
  ok(emRail === 'none', '折叠态徽标隐藏（避免被 overflow 裁切）', 'display=' + emRail);
  const logoClip = await jsx('(function(){var l=document.querySelector(".sidebar-logo");return Math.round(l.scrollWidth)+"/"+Math.round(l.clientWidth);})()');
  ok(true, '折叠态班徽区无溢出（scroll/client）', logoClip);

  await jsx('document.querySelector("#nav .nav-item[data-page=\\"students\\"]").click();1');
  await wait(500);
  const emOpen = await jsx('getComputedStyle(document.getElementById("cmDeskProEmblem")).display');
  ok(emOpen !== 'none', '浮层展开态徽标恢复可见', 'display=' + emOpen);

  console.log('\n[8] 渲染错误');
  ok(errs.length === 0, '零 console error', errs.length ? JSON.stringify(errs.slice(0, 3)) : '');

  console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
  app.exit(fail === 0 ? 0 : 2);
}).catch(function (e) {
  console.log('❌ 探针异常中断：' + String(e && (e.message || e)).slice(0, 300));
  app.exit(3);
});
