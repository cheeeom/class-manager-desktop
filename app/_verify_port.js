// v3.6.0 移植验证：语法 + 残留扫描 + div 平衡
const fs = require('fs');
const { execFileSync } = require('child_process');
const WEB = 'C:/Users/84669/.zcode/workspace/default/class-manager';

const cmgx = fs.readFileSync(WEB + '/cmgx.js', 'utf8');

// 1. 残留扫描
console.log('== 桌面残留符号扫描（应全 0）==');
for (const k of ['__CM_DESKTOP', '__CM_PRO', 'cmProActive', 'cmProModal', 'printToPDF', 'cmWrapPro', 'buildNavPro', 'gxSweep', 'gxInjectSprite', 'GX_EMOJI_MAP']) {
  const n = cmgx.split(k).length - 1;
  console.log((n === 0 ? '✓ ' : '✗✗✗ ') + k + ' × ' + n);
}

// 2. 关键契约串
console.log('\n== 契约串 ==');
for (const k of ['window.renderGradeAnalyticsDetail = wrapped', 'window.renderAnalytics = wrapped', './echarts.min.js', 'cmWrapDistChart', 'cmWrapPubCharts', 'cmReportOpen', 'cmRptPdf', 'srcdoc']) {
  console.log((cmgx.indexOf(k) >= 0 ? '✓ ' : '✗✗✗ ') + k);
}

// 3. index.html 全文档 div 深度扫描（结构手术铁律）
const html = fs.readFileSync(WEB + '/index.html', 'utf8');
const noComment = html.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length));
const noScript = noComment.replace(/<script[\s\S]*?<\/script>/g, m => ' '.repeat(m.length));
const opens = (noScript.match(/<div\b/g) || []).length;
const closes = (noScript.match(/<\/div>/g) || []).length;
console.log('\n== div 平衡（剔注释与脚本后）==');
console.log('开:', opens, '闭:', closes, opens === closes ? '✓ 平衡' : '✗✗✗ 不平衡！');

// 地标深度：关于卡应在 page-settings 内
function depthOf(marker) {
  const i = noScript.indexOf(marker);
  if (i < 0) return -1;
  let d = 0;
  for (let j = 0; j < i; j++) {
    if (noScript.startsWith('<div', j)) d++;
    if (noScript.startsWith('</div>', j)) d--;
  }
  return d;
}
console.log('地标 settingsAbout 深度:', depthOf('id="settingsAbout"'), '| eolBanner:', depthOf('eolBanner'), '| script注入:', depthOf('src="./cmgx.js"'));

// 4. script 顺序：主脚本必须先于 cmgx 注入
const mainEnd = noComment ? html.lastIndexOf('</script>') : 0;
const inject = html.indexOf('src="./cmgx.js"');
console.log('\n注入点在最后一个 </script> 之前:', inject > mainEnd ? '✗✗✗ (注入在主脚本前?)' : '✓');
console.log('cmgx 标签距 body 尾:', html.indexOf('</body>') - inject, '字符');

// 5. node 语法检查
try {
  execFileSync('node', ['--check', WEB + '/cmgx.js'], { stdio: 'pipe' });
  console.log('✓ node --check cmgx.js 语法通过');
} catch (e) {
  console.log('✗✗✗ 语法错误: ' + String(e.stderr).slice(0, 400));
}
