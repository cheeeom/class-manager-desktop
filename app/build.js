/* 班主任工作台 · 桌面版构建脚本
   流程：读取仓库根 index.html（线上同源文件，禁止任何构建期修改根文件）
        → 应用桌面补丁表（每条 (old,new,期望次数)，失配即失败）
        → 写 desktop/dist/ + 复制运行资产
        → 断言：root 未被改、补丁标记齐全。
   用法：node build.js   （先 npm install） */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.CM_WEB_ROOT || path.join(__dirname, '..', '..', 'class-manager'); // 线上网页版仓库（本地 clone 路径，可用 CM_WEB_ROOT 覆盖）
const HERE = __dirname;
const deskVer = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version; // 桌面版版本号：三处版本位 + 关于卡均以此为准
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function log(s) { console.log(s); }

/* ---------- 0. root 完整性：构建不得在 root 被改动的状态下进行 ---------- */
const rootPath = path.join(ROOT, 'index.html');
const rootBuf = fs.readFileSync(rootPath);
let headContent = null;
try {
  if (process.env.CM_HEAD_FILE) {
    // 逃生舱口：沙箱等 Node 无法 spawn 子进程的环境，用 CM_HEAD_FILE 指向 bash 预取的 HEAD 内容
    //   git -C <网页版仓> show HEAD:index.html > <文件>
    headContent = fs.readFileSync(process.env.CM_HEAD_FILE, 'utf8');
    log('· HEAD 内容来自 CM_HEAD_FILE（跳过 git spawn）');
  } else {
    headContent = require('child_process').execSync('git show HEAD:index.html', { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).toString();
  }
} catch (e) { die('取 git HEAD:index.html 失败：' + e.message); }
if (sha256(rootBuf) !== sha256(Buffer.from(headContent, 'utf8'))) {
  die('根 index.html 与 git HEAD 不一致（线上文件被改动？）——先提交或还原，再构建桌面版');
}
log('✓ root index.html 与 git HEAD 一致（线上零改动保证）');

/* ---------- 1. 读取 + 补丁表 ---------- */
let html = rootBuf.toString('utf8').replace(/\r\n/g, '\n');
const rootVersion = (html.match(/<div class="login-version">([^<]+)<\/div>/) || [])[1];
if (!rootVersion) die('root 版本串解析失败');
log('✓ 线上基线版本: ' + rootVersion);

const patches = [
  ['navigator.serviceWorker.register(\'./sw.js\').catch(function () {});',
   '/* desktop: ServiceWorker 已禁用（桌面版自带完整资源，无需缓存层） */', 1, '禁SW'],
  ['<link rel="manifest" href="./manifest.json">', '', 1, '去manifest'],
  ['<link rel="apple-touch-icon" href="./icon_192.png">', '', 1, '去apple-icon'],
  ['<div class="login-version">' + rootVersion + '</div>', '<div class="login-version">v' + deskVer + ' 桌面版</div>', 1, '登录版本标'],
  ['<div class="sidebar-footer">' + rootVersion + ' · 班主任工作台</div>', '<div class="sidebar-footer">v' + deskVer + ' 桌面版 · 班主任工作台</div>', 1, '侧栏版本标'],
  ['🏷️ ' + rootVersion + '</span>', '🏷️ 桌面版 v' + deskVer + '</span>', 1, '设置徽标'],
  ['📝 近版更新速览（' + rootVersion + '）', '📝 网页版近版更新速览（' + rootVersion + '）', 1, '速览标网页版'],
  ['placeholder="如：2026级幼儿保育2班"', 'placeholder="如：高2026级一班"', 1, '班级全称提示'],
  ['例：2026级幼儿保育2班', '例：高2026级一班', 1, '班级全称toast例'],
  ['如「2026级幼儿保育2班」', '如「高2026级一班」', 1, '班级全称同步toast例'],
  ['仅<b>班长、副班长、纪律委员</b>三人可进入班委协作（v3.0.0）。<b>首页</b>只看课表、班级人数与今日实到（v3.2.0）；请假页只读（看人数与姓名，不可登记）；<b>学分页</b>只能加分扣分（留痕署名），只能看见并撤销<b>本次自己的操作记录</b>，月度加分/按寝室加减分不可用；<b>荣誉墙</b>只可查看；<b>公示页</b>不显示最低分；无待办模块。关闭扣分后班委只能加分，减分统一由你操作。',
   '仅<b>班长、副班长、纪律委员</b>三名学生可进入班委协作（在「📱 班委协作」里给学生打上对应职位标签即可）。<b>首页</b>只展示课表、班级人数与今日实到；请假页只读（可看人数与姓名，登记 / 续假 / 销假 / 删除均不可用）；<b>学分页</b>可加分扣分并留痕署名，只能看见并撤销<b>本次自己会话里的操作</b>，月度加分与按寝室加减分不可用；<b>荣誉墙</b>只可查看；<b>公示页</b>不显示最低分；无待办模块。关闭上方「允许班委扣分」后，班委只能加分，减分统一由班主任操作。', 1, '班委协作说明'],
  ['</body>', '<link rel="stylesheet" href="./wizard.css">\n<script src="./app.patch.js"></script>\n</body>', 1, '注入桌面层']
];
for (const [oldS, newS, cnt, tag] of patches) {
  const n = html.split(oldS).length - 1;
  if (n !== cnt) die('补丁 [' + tag + '] 期望 ' + cnt + ' 处，实际 ' + n + ' 处');
  html = html.split(oldS).join(newS);
  log('✓ 补丁 [' + tag + ']');
}

/* ---------- 2. 写 dist ---------- */
const dist = path.join(HERE, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
for (const f of ['src/app.patch.js', 'src/wizard.css']) {
  fs.copyFileSync(path.join(HERE, f), path.join(dist, path.basename(f)));
}
// 登录页背景海报（AI 生成，已裁水印）
const bgAsset = path.join(HERE, 'src', 'img', 'login-bg-a.jpg');
if (fs.existsSync(bgAsset)) fs.copyFileSync(bgAsset, path.join(dist, 'login-bg.jpg'));
// 本地运行资产：pdf 库（成绩/课表导入用；存在则带）
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(dist, f));
}
log('✓ dist 就绪: ' + dist);

/* ---------- 3. dist 标记断言 ---------- */
const distHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const must = [
  ['wizard.css', 1], ['app.patch.js', 1], ['ServiceWorker 已禁用', 1], ['桌面版', 3],
  ['login-version">v' + deskVer + ' 桌面版', 1],
  ['sidebar-footer">v' + deskVer + ' 桌面版', 1],
  ['🏷️ 桌面版 v' + deskVer + '</span>', 1]
];
for (const [needle, minCnt] of must) {
  const n = distHtml.split(needle).length - 1;
  if (n < minCnt) die('dist 标记断言失败: ' + needle + ' 出现 ' + n + ' 次（期望 ≥' + minCnt + '）');
}
if (/serviceWorker\.register/.test(distHtml)) die('dist 仍含 serviceWorker.register');
log('✓ dist 标记断言通过');

/* ---------- 4. package.json.baseWeb 跟版 ---------- */
const pkgPath = path.join(HERE, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.baseWeb !== rootVersion) {
  pkg.baseWeb = rootVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log('✓ package.json.baseWeb → ' + rootVersion);
}

log('\n🎉 构建完成。下一步：npm run dist 出安装包（或 npm start 直接跑）。');
