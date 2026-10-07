/* 构建重试器：EBUSY（杀软实时扫描新 asar）退避重试；成功后由外层恢复 npmrc */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');

const tries = 5;
for (let i = 1; i <= tries; i++) {
  // 清理上次残留
  try { spawnSync('powershell', ['-NoProfile', '-Command', "Stop-Process -Name 'app-builder' -Force -ErrorAction SilentlyContinue; Stop-Process -Name 'electron' -Force -ErrorAction SilentlyContinue"], { stdio: 'ignore' }); } catch (e) {}
  try { fs.rmSync('release', { recursive: true, force: true, maxRetries: 5, retryDelay: 1500 }); } catch (e) { console.log('release 清理未完成（继续尝试构建）'); }

  const r = spawnSync('npx', ['electron-builder', '--win'], {
    stdio: 'inherit', shell: true,
    env: Object.assign({}, process.env, { ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/' })
  });
  if (r.status === 0) { console.log('BUILD-OK attempt ' + i); process.exit(0); }
  console.log('BUILD-FAIL attempt ' + i + '，退避 ' + (i * 8) + 's 后重试…');
  spawnSync('timeout', ['/t', String(i * 8), '/nobreak', '/noheader'], { stdio: 'ignore', shell: 'cmd.exe' });
}
console.log('BUILD-GAVE-UP');
process.exit(1);
