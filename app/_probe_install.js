const fs = require('fs');
const t = fs.readFileSync('src/app.patch.js', 'utf8');
const lines = t.split('\n');
const L = (a, b) => lines.slice(a - 1, b).join('\n');

// 1. cmInk 定义位
lines.forEach((l, i) => { if (/var cmInk|cmInk\s*=\s*\{/.test(l)) console.log('cmInk 定义 @' + (i + 1) + ': ' + l.trim().slice(0, 100)); });

// 2. 报告段里的 cmDesk 调用行
console.log('\n== M3 报告段的 cmDesk/Pro/printToPDF 调用行 ==');
for (let i = 1534; i < 1963; i++) {
  if (/cmDesk|cmPro|printToPDF|__CM_DESKTOP/.test(lines[i])) console.log((i + 1) + ': ' + lines[i].trim().slice(0, 130));
}

// 3. P0 段头 60 行（cmInk/loader/cmGxState/cmGxChart 结构）
console.log('\n== P0 头部（2075-2100）==');
console.log(L(2075, 2100));

// 4. 接管安装机制（cmWrapGradeDetail 定义处 + 挂接处）
console.log('\n== cmWrapGradeDetail 安装行 ==');
for (let i = 2499; i < 2560; i++) {
  if (/renderGradeAnalyticsDetail|cmWrapGradeDetail\s*=|window\.render/.test(lines[i])) console.log((i + 1) + ': ' + lines[i].trim().slice(0, 130));
}
console.log('\n== cmWrapCreditRender 安装行 ==');
for (let i = 2725; i < 2790; i++) {
  if (/renderAnalytics|cmWrapCreditRender\s*=|window\.render/.test(lines[i])) console.log((i + 1) + ': ' + lines[i].trim().slice(0, 130));
}
