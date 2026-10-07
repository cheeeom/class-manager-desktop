// 修复 Release 资产中文名：node spawn gh（绕开 cmd GBK 命令行编码）
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'cheeeom/class-manager-desktop';
const REL = 'v1.0.0';
const RELEASE_DIR = path.join(__dirname, 'app', 'release');
const want = '班主任工作台-Setup.exe';

function gh(args, opts) {
  return execFileSync('gh', args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, opts));
}

// 1. 本地文件重命名为中文名（node 的 fs 处理 UTF-16 文件名无压力）
const localPath = path.join(RELEASE_DIR, want);
if (!fs.existsSync(localPath)) {
  const old = path.join(RELEASE_DIR, '班主任工作台-Setup-1.0.0.exe');
  if (fs.existsSync(old)) fs.renameSync(old, localPath);
  else throw new Error('本地找不到安装包: ' + RELEASE_DIR);
}
if (!fs.existsSync(localPath)) throw new Error('重命名失败');
console.log('本地文件就绪:', want, fs.statSync(localPath).size, 'bytes');

// 2. 删除现有坏名资产
const rel = JSON.parse(gh(['api', 'repos/' + REPO + '/releases/tags/' + REL]));
for (const a of rel.assets) {
  console.log('删除坏名资产:', JSON.stringify(a.name), a.id);
  gh(['api', '-X', 'DELETE', 'repos/' + REPO + '/releases/assets/' + a.id]);
}

// 3. 重新上传（args 数组经 node 传 UTF-16 → gh 收到正确文件名）
gh(['release', 'upload', REL, localPath, '--repo', REPO, '--clobber']);
console.log('上传完成');

// 4. 校验
const rel2 = JSON.parse(gh(['api', 'repos/' + REPO + '/releases/tags/' + REL]));
for (const a of rel2.assets) {
  console.log('资产:', JSON.stringify(a.name), a.size);
  if (a.name !== want) throw new Error('资产名仍不正确: ' + JSON.stringify(a.name));
}
console.log('OK 资产名已修复为', want);
