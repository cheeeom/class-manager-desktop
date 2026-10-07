// 资产改 ASCII 名：删旧传新（cmd 多行 node -e 静默失败的教训——一律脚本文件）
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'cheeeom/class-manager-desktop';
const REL = 'v1.0.0';
const RELEASE_DIR = path.join(__dirname, 'app', 'release');
const want = 'ClassManager-Setup.exe';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

const rel = JSON.parse(gh(['api', 'repos/' + REPO + '/releases/tags/' + REL]));
for (const a of rel.assets) {
  console.log('删除资产:', JSON.stringify(a.name), a.id);
  gh(['api', '-X', 'DELETE', 'repos/' + REPO + '/releases/assets/' + a.id]);
}

const src = path.join(RELEASE_DIR, '班主任工作台-Setup.exe');
const dst = path.join(RELEASE_DIR, want);
if (!fs.existsSync(dst)) fs.renameSync(src, dst);
if (!fs.existsSync(dst)) throw new Error('找不到本地安装包');

gh(['release', 'upload', REL, dst, '--repo', REPO, '--clobber']);
console.log('上传完成');

const rel2 = JSON.parse(gh(['api', 'repos/' + REPO + '/releases/tags/' + REL]));
console.log('资产:', JSON.stringify(rel2.assets.map(a => ({ name: a.name, size: a.size }))));
if (rel2.assets.length !== 1 || rel2.assets[0].name !== want) throw new Error('资产名仍不正确');
console.log('OK');
