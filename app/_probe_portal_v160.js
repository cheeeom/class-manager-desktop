/* v1.6.0 静态契约探针：学生查询端随 v3.8.1 基线进入桌面版
   ① 构建适配：可选补丁机制 / cmgx 标签摘除 / portal 资产拷贝 / baseWeb 跟版
   ② dist 完整性：portal 三件 + jsqr + 无 cmgx 引用 + 新功能标记（兑换核销/学生查询端/批量配学号）
   ③ 桌面层：portalStudentUrl 固定 Pages（file:// 下 origin 无意义）+ 关于卡 v1.6.0 文案
   运行：node _probe_portal_v160.js */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
let pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } }

const build = fs.readFileSync(path.join(HERE, 'build.js'), 'utf8');
const patch = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
const dist = path.join(HERE, 'dist');
const distHtml = fs.existsSync(path.join(dist, 'index.html')) ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8') : '';

ok(build.includes("if (n === 0 && cnt === 0)"), '①可选补丁机制（横幅锚点基线消失时跳过）');
ok(build.includes("'摘cmgx标签（桌面用自带引擎，防双挂载）'"), '①cmgx 标签摘除补丁');
ok(build.includes("portal/index.html", ) && fs.existsSync(path.join(dist, 'portal', 'index.html')), '①②dist portal/index.html');
ok(fs.existsSync(path.join(dist, 'portal', 'qrcode.js')), '②dist portal/qrcode.js');
ok(fs.existsSync(path.join(dist, 'portal', 'qrcode_utf8.js')), '②dist portal/qrcode_utf8.js');
ok(fs.existsSync(path.join(dist, 'jsqr.min.js')), '②dist jsqr.min.js（核销解码）');
ok(distHtml.includes('学生查询端') && distHtml.includes('兑换核销'), '②dist 含学生查询端与核销中心（基线带入）');
ok(distHtml.includes('批量配学号'), '②dist 含批量配学号');
ok(!/cmgx\.js/.test(distHtml), '②dist 无 cmgx 引用（防双引擎）');
ok(patch.includes("window.portalStudentUrl = function (owner, gistId)"), '③portalStudentUrl 桌面覆盖');
ok(patch.includes('https://cheeeom.github.io/class-manager/portal/'), '③链接指向 GitHub Pages');
ok(patch.includes('📦 <b>桌面版 v\' + D.version + \' 更新</b>：兑换商店大版本'), '③关于卡 v1.6.0 文案');
ok(pkg.version === '1.6.0', '③version=1.6.0（实际 ' + pkg.version + '）');
ok(pkg.baseWeb === 'v3.8.1', '③baseWeb=v3.8.1（实际 ' + pkg.baseWeb + '）');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
