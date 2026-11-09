/* v1.7.7 桌面版「请假分析」回归：移植同源 + Pro 闸顺序 + 构建产物
   运行：node _v_desktop_leave_test.js（dist 相关断言需先 node build.js）
   版本无关：不写死 v1.7.7，版本号从 package.json 反推。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const WEB = path.join(HERE, '..', '..', 'class-manager');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0, failures = [];
function ok(c, name) { if (c) { pass++; console.log('  ✅ ' + name); } else { fail++; failures.push(name); console.log('  ❌ ' + name); } }
function has(s, n, name) { ok(s.indexOf(n) >= 0, name); }
function notHas(s, n, name) { ok(s.indexOf(n) < 0, name); }
function grab(marker, src) {
  const s = src.indexOf(marker);
  if (s < 0) return '';
  const i = src.indexOf('{', s);
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) { j++; break; }
  }
  return src.slice(s, j);
}

const p = read(path.join(HERE, 'src', 'app.patch.js'));
const css = read(path.join(HERE, 'src', 'wizard.css'));
const webCmgx = read(path.join(WEB, 'cmgx.js'));
const webHtml = read(path.join(WEB, 'index.html'));
const build = read(path.join(HERE, 'build.js'));
const pkg = JSON.parse(read(path.join(HERE, 'package.json')));

console.log('\n=== ① 移植完整性（注入层） ===');
for (const fn of ['cmLvPal', 'cmLvAgg', 'cmLvInject', 'cmLvDispose', 'cmLvRender',
                  'cmLvOverdueHtml', 'cmLvLongHtml', 'cmLvDraw', 'cmWrapLvRender', 'cmWrapLvTab']) {
  has(p, 'function ' + fn + '(', '注入层带 ' + fn + '()');
}
for (const id of ['cmGxLvType', 'cmGxLvMonth', 'cmGxLvWeek', 'cmGxLvDur', 'cmGxLvTop', 'cmGxLvPeriod']) {
  has(p, "'" + id + "'", '六图之一 ' + id + ' 有绘制接线');
}
has(p, "t.id = 'tab-leave'", '运行时注入请假分析页签');
has(p, "p.id = 'analyticsLeavePanel'", '运行时注入请假分析面板');
has(p, "switchAnalyticsTab('leave')", '页签点击走统一切页入口');
has(p, 'if (!agg.total)', '空数据态');
has(p, 'cmLvDispose()', '重绘前释放旧图表实例');
has(css, '.cmLvChip{', 'wizard.css 带高频画像胶囊样式');
has(css, '.cmLvChip b{', 'wizard.css 带胶囊加粗样式');

/* 插入 266 行代码后，整份注入层必须仍能被 JS 引擎编译（语法错会让整个桌面层失效） */
function compiles(src) { try { new Function(src); return true; } catch (e) { return false; } }
ok(compiles(p), 'app.patch.js 整文件语法可编译（插入段没破坏注入层）');

console.log('\n=== ② 口径同源（与网页版逐字比对） ===');
const A = webCmgx.slice(webCmgx.indexOf('  var CM_LV_COLORS = null;'), webCmgx.indexOf('  /* ---------- 切页补播 KPI 滚动数字'));
const B = p.slice(p.indexOf('  var CM_LV_COLORS = null;'), p.indexOf('  /* ---------- v1.3.0 P2：首页学分分布'));
ok(A.trim() === B.trim(), '请假分析实现代码与网页版 cmgx.js 逐字同源（不许两版口径分叉）');
has(p, 'lvAggregate(st.leaves || [], st.students || [])', '数据只走主应用 lvAggregate 纯函数');
notHas(p, 'function lvAggregate(', '注入层没有自己算一套聚合');

console.log('\n=== ③ 桌面版独有：Pro 闸顺序与换肤 ===');
const iLv = p.indexOf('    cmWrapLvTab();');
const iPro = p.indexOf("    cmWrapPro('switchAnalyticsTab', '数据分析');");
const iInject = p.indexOf('    cmLvInject();');
ok(iLv > 0 && iPro > iLv && iInject < iPro, '页签包装在 Pro 闸之内（未激活不得渲染面板）');
const iRender = p.indexOf('    cmWrapLvRender();');
const iCredit = p.indexOf('    cmWrapCreditTabSwitch();');
ok(iRender > iCredit && iRender > 0, 'renderAnalytics 接管在 credit 两层包装之后（最外层）');
has(p, "var lvTab = document.getElementById('tab-leave')", '换肤钩子检测 leave 页签');
has(p, "lvTab.classList.contains('active')", '换肤仅重绘当前停留页签');
has(p, 'try { cmLvRender(); } catch (e) {}', '换肤补画有异常兜底');
/* 移植完整性补刀：网页版注入 CSS 里的 cmGx 选择器桌面版一个都不能少 */
const webSels = Array.from(new Set((webCmgx.match(/\.(cmGx[A-Za-z0-9_-]*)/g) || []).map(s => s.slice(1))));
const missSels = webSels.filter(s => css.indexOf('.' + s) < 0);
ok(webSels.length >= 20 && missSels.length === 0, 'wizard.css 覆盖网页版全部图表样式选择器（缺：' + missSels.join(',') + '）');
/* 真跑包装链：Pro 闸在最外层时，未激活点 leave 不得渲染面板 */
const tabSrc = grab('function cmWrapLvTab()', p);
function makeChain(proActive) {
  const rec = { base: [], render: 0, modal: 0 };
  const panel = { style: { display: 'none' } };
  const tabEl = { active: false, classList: { toggle: function (c, on) { tabEl.active = !!on; } } };
  const win = { switchAnalyticsTab: function (tab) { rec.base.push(tab); } };
  const sb = {
    window: win,
    document: { getElementById: function (id) { return id === 'analyticsLeavePanel' ? panel : (id === 'tab-leave' ? tabEl : null); } },
    cmLvRender: function () { rec.render++; }
  };
  vm.createContext(sb);
  vm.runInContext(tabSrc + '; cmWrapLvTab();', sb);
  const lv = win.switchAnalyticsTab;
  win.switchAnalyticsTab = function () {
    if (proActive) return lv.apply(this, arguments);
    rec.modal++;
  };
  const pro = win.switchAnalyticsTab;
  win.switchAnalyticsTab = function () { return pro.apply(this, arguments); };
  win.switchAnalyticsTab('leave');
  return { rec: rec, panel: panel, tabEl: tabEl };
}
ok(tabSrc.length > 50, '能从源码抓到 cmWrapLvTab 函数体');
const free = makeChain(false);
ok(free.rec.modal === 1 && free.rec.base.length === 0, 'Pro 未激活：弹窗且底层切页未被调用');
ok(free.rec.render === 0 && free.panel.style.display === 'none', 'Pro 未激活：请假面板不显示、不渲染');
const paid = makeChain(true);
ok(paid.rec.modal === 0 && paid.rec.base.length === 1, 'Pro 激活：放行到底层切页');
ok(paid.rec.render === 1 && paid.panel.style.display === '', 'Pro 激活：面板显示并触发整块渲染');
ok(paid.tabEl.active === true, 'Pro 激活：页签高亮');

console.log('\n=== ④ 真跑：cmLvAgg 传参与返回值 ===');
const aggSrc = grab('function cmLvAgg()', p);
ok(aggSrc.length > 50, '能从源码抓到 cmLvAgg 函数体');
const calls = [];
const sb = {
  lvAggregate: function (leaves, students) { calls.push([leaves, students]); return { total: 7, people: 2 }; },
  cmGxState: function () { return { leaves: [{ id: 'l1' }], students: [{ id: 's1', name: '甲' }] }; },
  console: { warn: function () {} }
};
vm.createContext(sb);
vm.runInContext(aggSrc + '\nvar _r = cmLvAgg();', sb);
ok(calls.length === 1, 'lvAggregate 只被调用一次');
ok(calls[0] && calls[0][0].length === 1 && calls[0][0][0].id === 'l1', '实参 ① 就是 state.leaves 原数组');
ok(calls[0] && calls[0][1].length === 1 && calls[0][1][0].name === '甲', '实参 ② 就是 state.students 原数组');
ok(sb._r && sb._r.total === 7, '返回值原样透传聚合结果（不自己加工）');

console.log('\n=== ⑤ 真跑：cmLvInject 幂等注入 ===');
const injSrc = grab('function cmLvInject()', p);
function mkEl() {
  return {
    id: '', className: '', innerHTML: '', style: {}, children: [], handlers: [],
    appendChild: function (c) { this.children.push(c); if (c.id) IDS[c.id] = c; },
    addEventListener: function (ev, fn) { this.handlers.push([ev, fn]); },
    classList: { contains: function () { return false; }, toggle: function () {} }
  };
}
let IDS = {};
const tabs = mkEl(), page = mkEl();
IDS['page-analytics'] = page;
const doc = {
  querySelector: function (s) { return s === '.analytics-tabs' ? tabs : null; },
  getElementById: function (id) { return IDS[id] || null; }
};
const sb2 = {
  el: function (tag, cls) { const e = mkEl(); e.className = cls || ''; return e; },
  document: doc, switchAnalyticsTab: function () {}, IDS: IDS
};
vm.createContext(sb2);
vm.runInContext(injSrc + '\ncmLvInject(); cmLvInject();', sb2);
ok(tabs.children.length === 1, '页签只注入一次（重复调用幂等）');
ok(page.children.length === 1, '面板只注入一次（重复调用幂等）');
ok(tabs.children[0] && tabs.children[0].id === 'tab-leave', '注入的是 tab-leave');
ok(tabs.children[0] && tabs.children[0].innerHTML.indexOf('i-chart-cal') >= 0, '页签复用主应用日历图标符号');
ok(tabs.children[0] && tabs.children[0].className === 'analytics-tab', '页签沿用主应用样式类');
ok(page.children[0] && page.children[0].id === 'analyticsLeavePanel', '注入的是 analyticsLeavePanel');
ok(page.children[0] && page.children[0].style.display === 'none', '面板默认隐藏，由切页包装控制');

console.log('\n=== ⑥ 网页版零改动 / 构建契约 ===');
notHas(webHtml, 'id="tab-leave"', '网页版 index.html 没有被写死死页签');
has(webCmgx, 'function cmLvInject()', '网页版 cmgx.js 保留原注入实现');
has(build, '摘cmgx标签', 'build.js 仍摘 cmgx.js 防双挂载');
has(build, "['src/app.patch.js'", 'build.js 仍拷贝注入层到 dist');

console.log('\n=== ⑦ dist 同步（构建后） ===');
const distPatch = path.join(HERE, 'dist', 'app.patch.js');
const distHtml = path.join(HERE, 'dist', 'index.html');
const distCss = path.join(HERE, 'dist', 'wizard.css');
if (fs.existsSync(distPatch) && fs.existsSync(distHtml) && fs.existsSync(distCss)) {
  const dp = read(distPatch), dh = read(distHtml), dc = read(distCss);
  has(dp, "t.id = 'tab-leave'", 'dist 注入层带请假分析页签');
  has(dp, 'function cmLvDraw(', 'dist 注入层带六图绘制');
  has(dc, '.cmLvChip{', 'dist 样式带请假画像胶囊');
  notHas(dh, 'id="tab-leave"', 'dist 主应用 HTML 不带死页签（靠注入层）');
  has(dh, 'function lvAggregate(', 'dist 主应用带请假聚合纯函数');
  has(dh, 'id="i-chart-cal"', 'dist 主应用带日历图标符号');
  has(dh, 'v' + pkg.version + ' 桌面版', 'dist 登录版本标跟到 v' + pkg.version);
} else {
  console.log('  ⊘ dist 未构建，跳过（先跑 node build.js）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) { console.log('\n失败项：'); failures.forEach(f => console.log('  · ' + f)); process.exit(1); }
