const fs = require('fs');
const t = fs.readFileSync('src/app.patch.js', 'utf8');
const lines = t.split('\n');

// 1. cmInk 任意形式定义
console.log('== cmInk 定义 ==');
lines.forEach((l, i) => { if (/cmInk\s*[=(:(]|function\s+cmInk/.test(l) && !/cmInk[\w]/.test(l.replace('cmInk', 'cmInk '))) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });

// 2. 报告入口按钮注入（cmDeskReportOpen 调用者）
console.log('\n== 报告入口 ==');
lines.forEach((l, i) => { if (/cmDeskReportOpen|学期报告/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120)); });

// 3. printToPDF 使用上下文
console.log('\n== printToPDF 上下文 ==');
const p = lines.findIndex(l => /printToPDF/.test(l) && !/^\s*\*/.test(l));
if (p >= 0) console.log(lines.slice(p - 6, p + 10).map((x, j) => (p - 6 + j + 1) + ': ' + x).join('\n'));

// 4. KPI annotate 接线（P0/P1 段内 gxCount 调用行）
console.log('\n== gxCount 接线 ==');
lines.forEach((l, i) => { if (/gxCountAnnotate|gxPlayCounters|cmGx-kvalue/.test(l) && (i + 1 > 2074 && i + 1 < 2966)) console.log((i + 1) + ': ' + l.trim().slice(0, 110)); });

// 5. wizard.css 里报告/图表相关样式块
const css = fs.readFileSync('src/wizard.css', 'utf8');
console.log('\n== wizard.css 相关选择器 ==');
const cls = new Set();
for (const m of css.matchAll(/\.([\w-]+)/g)) {
  if (/rp|report|donate|kpi|kvalue|gx/i.test(m[1])) cls.add(m[1]);
}
console.log([...cls].join(', '));
console.log('wizard.css 大小KB:', Math.round(css.length / 1024));
