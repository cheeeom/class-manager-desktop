const fs = require('fs');
const t = fs.readFileSync('src/app.patch.js', 'utf8');
const lines = t.split('\n');
// 目标段（行号从盘点来，1-based，含头不含尾）
const SECTIONS = [
  ['M3report', 1535, 1964],
  ['P0grade', 2075, 2550],
  ['P1credit', 2550, 2758],
  ['P2home', 2758, 2966],
];
// cmMotion 段里 KPI ticker 部分（v1.5.0 动效：只取 gxCount/KPI 相关，不含全站动效）
const MOTION = [3000, 3200];

function grab(a, b) { return lines.slice(a - 1, b - 1).join('\n'); }
let all = '';
for (const [name, a, b] of SECTIONS) { const s = grab(a, b); all += s; console.log(name, s.length, 'chars'); }
const motion = grab(MOTION[0], MOTION[1]);

// 本段内定义的符号（粗提取：function X / var X / let X / const X / X = function）
const defined = new Set();
for (const m of all.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*)|let\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*=\s*function)/g)) {
  const n = m[1] || m[2] || m[3] || m[4] || m[5]; if (n) defined.add(n);
}
console.log('\n段内定义符号数:', defined.size);

// 候选外部引用：cm 开头/大写开头驼峰 + 已知全局
const KNOWN_APP = ['state','students','operations','exams','saveData','showToast','renderAll','renderAnalytics','renderGradeAnalyticsDetail','pngExport','cmPrompt','document','window','localStorage','sessionStorage','Math','Date','JSON','Object','Array','String','Number','Promise','setTimeout','setInterval','requestAnimationFrame','performance','console','isNaN','parseFloat','parseInt','encodeURIComponent','decodeURIComponent','navigator','location','history','CB_ALERT_MIN','TS_GROUPS'];
const refs = {};
for (const m of all.matchAll(/\b(cm[A-Z]\w*|gx\w+)\b/g)) {
  const n = m[1];
  if (!defined.has(n)) refs[n] = (refs[n] || 0) + 1;
}
console.log('\n== 段内未本地定义的 cm/gx 符号（外部依赖候选）==');
Object.entries(refs).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(4), k));

// motion 段里的 KPI 相关定义
console.log('\n== cmMotion 段 KPI/ticker 相关行 ==');
motion.split('\n').forEach(l => { if (/gx|Kpi|ticker|Ticker|count/i.test(l) && /function|var|const|let/.test(l)) console.log('  ' + l.trim().slice(0, 110)); });

// echarts 加载器位置
console.log('\n== echarts 加载器 ==');
lines.forEach((l, i) => { if (/cmEchartsLoad|echarts\.min\.js|window\.echarts/.test(l) && i + 1 < 3000) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });

// 段内对桌面专属 API 的引用
console.log('\n== 桌面专属 API 引用（需剥离/替换）==');
for (const kw of ['__CM_DESKTOP', '__CM_UPDATER', 'ipcRenderer', 'printToPDF', 'cmPro', 'isPro', 'PRO_', 'userData']) {
  const n = (all.split(kw).length - 1);
  if (n) console.log(String(n).padStart(4), kw);
}
