const fs = require('fs');
const t = fs.readFileSync('src/app.patch.js', 'utf8');
console.log('总大小KB:', Math.round(t.length / 1024), '总行数:', t.split('\n').length);

// 全部一级分节标记（桌面层用 /* ==== X ==== */ 风格）
console.log('\n== 分节标记（含行号与字节位）==');
const lines = t.split('\n');
let acc = 0;
lines.forEach((l, i) => {
  acc += l.length + 1;
  if (/\/\* =+ .* =+ \*\//.test(l) || /^ {2}\/\* ----.*----/.test(l)) {
    console.log(String(i + 1).padStart(5), '@' + String(acc - l.length).padStart(7), l.trim().slice(0, 90));
  }
});

// 关键函数与依赖清单
console.log('\n== 关键符号定义位（函数/变量）==');
const syms = ['function cmGxState', 'var cmInk', 'function cmInk', 'cmEchartsLoad', 'cmGxChart', 'cmWrapGradeDetail', 'cmWrapCreditRender', 'cmCreditDrawCharts', 'cmGxTicker', 'gxCountKpis', 'cmTermReport', 'renderTermReport', 'cmReport', 'termReport', 'printToPDF', 'cmPro', 'function cmPro', 'isProActive', 'cmDeskPro'];
acc = 0;
const found = {};
lines.forEach((l, i) => {
  acc += l.length + 1;
  for (const s of syms) {
    if (!found[s] && l.indexOf(s) >= 0) { found[s] = true; console.log(String(i + 1).padStart(5), l.trim().slice(0, 110)); }
  }
});
