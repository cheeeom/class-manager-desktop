const fs = require('fs');
// 1. web EOL 横幅足迹
const web = fs.readFileSync('../../class-manager/index.html', 'utf8');
console.log('== EOL 横幅足迹 ==');
for (const k of ['eolBanner', 'data-eol', '44px']) console.log(k, '出现', web.split(k).length - 1, '次');
const i = web.indexOf('eolBanner');
console.log(JSON.stringify(web.slice(i - 120, i + 260)));

// 2. web sw.js CORE_ASSETS
const sw = fs.readFileSync('../../class-manager/sw.js', 'utf8');
const m = sw.match(/CORE_ASSETS\s*=\s*\[[\s\S]*?\]/);
console.log('\n== CORE_ASSETS ==');
console.log(m ? m[0].slice(0, 600) : '未找到');

// 3. 桌面启动段（3521 到文件尾）对这些引擎的接线
const t = fs.readFileSync('src/app.patch.js', 'utf8');
const lines = t.split('\n');
console.log('\n== 启动段接线（3521-末尾）==');
for (let i2 = 3520; i2 < lines.length; i2++) {
  const l = lines[i2];
  if (/cmWrap|cmReport|Nav|nav|gxCount|echarts|cmPub|Pub|Dashboard|Dashboard|home/i.test(l) && l.trim()) console.log((i2 + 1) + ': ' + l.trim().slice(0, 120));
}
console.log('\n文件总行数:', lines.length);
