const fs = require('fs');
const t = fs.readFileSync('src/app.patch.js', 'utf8');
const lines = t.split('\n');

// 1. PDF 导出 handler 全文（cmRptPdf 绑定处到函数尾）
console.log('== cmRptPdf 绑定与实现 ==');
const p = lines.findIndex(l => /cmRptPdf/.test(l) && /onclick|bind|\$\(/.test(l));
for (let i = Math.max(0, p - 2); i < Math.min(lines.length, p + 30); i++) {
  console.log((i + 1) + ': ' + lines[i]);
  if (lines[i].trim() === '});' && i > p + 3) break;
}

// 2. 报告入口注入代码（2025-2060）
console.log('\n== 报告导航注入（2025-2062）==');
console.log(lines.slice(2024, 2062).map((x, j) => (2025 + j) + ': ' + x).join('\n'));

// 3. localDateStr / liveOps / loadPubSetting / pngExport 是否网页版全局（搜 web 仓）
const web = fs.readFileSync('../../class-manager/index.html', 'utf8');
for (const fn of ['function localDateStr', 'function liveOps', 'function loadPubSetting', 'function pngExport', 'function renderGradeAnalyticsDetail', 'function renderAnalytics', 'function showToast', 'function localDateTime']) {
  console.log((web.indexOf(fn) >= 0 ? 'web有 ' : 'web无 ') + fn);
}

// 4. 四段内 gx-ic / gxH- / gx-wl- 使用（是否需要附带样式/图标）
console.log('\n== 段内图标类使用 ==');
const seg = lines.slice(1534, 1963).concat(lines.slice(2074, 2965)).join('\n');
for (const k of ['gx-ic', 'gxH-', 'gx-wl-', 'cmGx-', 'cmDesk-rp-', 'cmDesk-donate-', 'cmDesk-modal-overlay', 'cmDesk-pro-badge', 'cmDesk-navreport']) {
  console.log(String(seg.split(k).length - 1).padStart(3), k);
}

// 5. web 版 body 尾结构（script 注入点）
console.log('\n== web </body> 前 240 字符 ==');
const b = web.lastIndexOf('</body>');
console.log(JSON.stringify(web.slice(b - 240, b + 7)));
