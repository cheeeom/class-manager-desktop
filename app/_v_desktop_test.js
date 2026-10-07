/* 班主任工作台 · 桌面版测试套件（不进根 _runall：桌面层独立断言）
   护四层：①线上零改动 ②构建产物标记 ③注入层契约 ④版权合规四位置。
   运行：先 node build.js，再 node _v_desktop_test.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = process.env.CM_WEB_ROOT || path.join(__dirname, '..', '..', 'class-manager'); // 线上网页版仓库（本地 clone 路径，可用 CM_WEB_ROOT 覆盖）
const HERE = __dirname;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let pass = 0, fail = 0, failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log('  ✅', name); }
  catch (e) { fail++; failures.push(name + ' — ' + e.message); console.log('  ❌', name, '—', e.message); }
}
function ok(c, msg) { if (!c) throw new Error(msg || '断言失败'); }
function has(a, b, msg) { if (a.indexOf(b) < 0) throw new Error((msg || '') + ` 缺少 ${JSON.stringify(b)}`); }
function notHas(a, b, msg) { if (a.indexOf(b) >= 0) throw new Error((msg || '') + ` 不应出现 ${JSON.stringify(b)}`); }

let distHtml = null;
try { distHtml = fs.readFileSync(path.join(HERE, 'dist', 'index.html'), 'utf8'); } catch (e) { /* 未构建 */ }

t('①线上零改动：根 index.html 与 git HEAD 完全一致', () => {
  const work = fs.readFileSync(path.join(ROOT, 'index.html'));
  const head = process.env.CM_HEAD_FILE
    ? fs.readFileSync(process.env.CM_HEAD_FILE, 'utf8') // 沙箱逃生舱口（同 build.js）
    : execSync('git show HEAD:index.html', { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  ok(sha256(work) === sha256(Buffer.from(head, 'utf8')), '根文件被改动——线上版会受影响');
  // 桌面层不得污染根文件
  const rootStr = work.toString('utf8');
  notHas(rootStr, 'cm_onboarded', '根文件不应含向导标记');
  notHas(rootStr, '__CM_DESKTOP', '根文件不应含桌面标识');
});

t('②构建产物存在且标记齐全', () => {
  ok(distHtml, 'dist/index.html 不存在——先跑 node build.js');
  has(distHtml, 'wizard.css', '样式注入');
  has(distHtml, 'app.patch.js', '注入层');
  has(distHtml, 'ServiceWorker 已禁用', '禁SW标记');
  notHas(distHtml, 'serviceWorker.register', 'SW注册必须消失');
  ok((distHtml.split('桌面版').length - 1) >= 3, '版本标「桌面版」≥3 处');
  notHas(distHtml, 'rel="manifest"', 'PWA manifest 应移除');
  const deskVer = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;
  has(distHtml, 'login-version">v' + deskVer + ' 桌面版', '登录页版本标 = 桌面版版本号');
  has(distHtml, 'sidebar-footer">v' + deskVer + ' 桌面版', '侧栏页脚（左下角）= 桌面版版本号');
  has(distHtml, '🏷️ 桌面版 v' + deskVer + '</span>', '设置徽标 = 桌面版版本号');
  has(distHtml, '网页版近版更新速览', '速览标题注明网页版口径');
});

t('②b 构建产物 = 根文件 + 桌面补丁（可复算）', () => {
  const patchJs = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const distPatch = fs.readFileSync(path.join(HERE, 'dist', 'app.patch.js'), 'utf8');
  ok(patchJs === distPatch, 'dist 里的注入层与 src 不一致——重跑 build.js');
});

t('③注入层契约：零密码模式', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  has(p, "LS_NOPWD = 'cm_nopwd'", '零密码标记键');
  has(p, 'userLoginPwdSet() ?', '登录判定分流');
  has(p, '零密码模式', '零密码文案');
  has(p, '直接进入', '无密码登录面板按钮');
  has(p, 'cmDesk-login-card', '零密码面板自包含样式类');
  notHas(p, 'class="login-card"', '禁复用网页版 .login-card（760px 横排双栏，套用即炸布局）');
  has(p, '跳过（不设密码）', '向导内跳过入口');
  ok(/isSixDigits/.test(p), '6位校验');
  ok(/weakPattern/.test(p), '弱口令提示');
});

t('③b 注入层契约：管理员闸与可跳过语义', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  has(p, 'function adminGate', '管理员闸函数');
  has(p, 'window.clearData.__cmDeskGate', 'clearData 包装防重入');
  has(p, '「<b>清空</b>」两字确认', '未设管理员密码时的降级确认');
  has(p, "USER_SET_ADMIN = 'cm_admin_user_set'", '区分「用户设过管理员密码」与默认哈希');
});

t('③c 注入层契约：云同步裁剪与设置卡', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  has(p, 'stripCloudUI', '云同步裁剪函数');
  has(p, 'restoreFromCloud', '云端恢复按钮隐藏');
  has(p, 'cmDeskSecurity', '桌面安全设置卡');
  has(p, '设置 → 🔐 安全', '后续设密码入口指引');
  has(p, "'修改登录密码'", '网页版改密区隐藏（改密统一走安全卡）');
  has(p, '跨电脑使用指南', '网页版跨电脑指南隐藏（桌面无此场景）');
  has(p, 'pwdLocalOnlyChk', '「登录密码仅限本机登录」双保险隐藏');
  has(p, '从云端恢复」会用', '危险操作提示改为桌面版口径');
});

t('③e 注入层契约：更新弹窗与设置页桌面化', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  has(p, 'cmUpdToast', '更新弹窗函数');
  has(p, '__CM_UPDATER.download', '弹窗「立即更新」走下载桥');
  has(p, 'cmUpdDeclined', '「暂不」后本会话不再自动弹');
  has(p, '单机版', '关于卡桌面版介绍');
  has(p, '自动更新', '关于卡更新说明');
  has(p, "ah3.parentNode.insertBefore(row, ah3.nextSibling)", '检查更新栏 = 关于卡第一栏（紧随标题）');
  ok(p.indexOf("btn = el('button', 'btn btn-primary', '🔄 检查更新')") >= 0, '检查更新按钮主色加大（非小号 outline）');
  has(p, '更新代理', '更新代理设置行（国内直连 GitHub 常超时）');
  has(p, '直连 GitHub 超时', '检查失败时的代理引导提示');
  has(pre, 'setProxy', 'preload 暴露更新代理桥');
  has(m, "'cm-upd-setproxy'", '代理保存 IPC 通道');
  has(m, 'updater-proxy.json', '代理持久化到 userData');
  has(m, 'if (savedProxy) applyProxy(savedProxy)', '启动时恢复已存代理');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  has(css, '.cmDeskUpdToast', '弹窗样式（定位/卡片）');
  has(css, '.cmUpdBar', '下载进度条样式');
  has(css, 'left:20px;bottom:20px', '弹窗固定在左下角');
  has(css, 'justify-content:center', '按钮文字居中');
  ok(/\.cmDesk-wfoot \.btn \.arr[^}]*position:absolute/.test(css), '箭头符号钉在按钮右侧（不挤占文字居中）');
});

t('③d 向导按钮绑定回归：foot 区按钮一律 w.foot.querySelector（v1.0.1 首屏按钮死因）', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  // 首屏两个按钮的绑定必须存在且走 foot
  has(p, "w.foot.querySelector('#cmWizNext').onclick", '开始配置绑定');
  has(p, "w.foot.querySelector('#cmWizSkipAll').onclick", '跳过向导绑定');
  notHas(p, "w.body.querySelector('#cmWizNext')", '首屏按钮不许从 body 找（foot 渲染区）');
  notHas(p, "w.body.querySelector('#cmWizSkipAll')", '同上（跳过按钮）');
  // 全文件扫：所有 w.body.querySelector('#…') 的 id 必须不是 foot 按钮命名（cmWizNext/Skip/Done/Back/Ok/SkipAll/SkipPwd/Import 系）
  const FOOT_IDS = ['cmWizNext', 'cmWizSkipAll', 'cmWizSkipPwd', 'cmWizBack', 'cmWizBack2', 'cmWizOk', 'cmWizDone', 'cmWizSkip', 'cmWizImport'];
  for (const m of p.matchAll(/w\.body\.querySelector\('#([A-Za-z0-9_]+)'\)/g)) {
    ok(FOOT_IDS.indexOf(m[1]) < 0, 'foot 按钮 ' + m[1] + ' 被写成了 w.body.querySelector（首屏按钮死 bug 重演）');
  }
});

t('④版权合规：安装包元数据 + 向导首尾 + 关于卡', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  has(pkg.copyright || '', '© 2026 chee', '安装包版权字段');
  has(pkg.author || '', 'chee', '作者字段');
  has(pkg.build.productName, '班主任工作台', '产品名');
  has(pkg.build.nsis.shortcutName, '班主任工作台', '快捷方式名');
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  ok((p.split('© 2026').length - 1) >= 4, '注入层版权呈现 ≥4 处（欢迎/完成/无密码面板/安全卡）');
  has(p, '转发分享请完整保留开发者署名', '分发署名要求声明');
  has(p, 'enhanceAbout', '关于卡增强函数');
  has(p, '保留所有权利', '权利保留声明');
});

t('④b 版权合规：dist 关于卡增强可落地', () => {
  ok(distHtml, '未构建');
  const p = fs.readFileSync(path.join(HERE, 'dist', 'app.patch.js'), 'utf8');
  has(p, 'settingsAbout', '定位关于卡');
  has(p, '桌面版 v', '桌面版版本行');
});

t('⑤主进程安全基线', () => {
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  has(m, 'contextIsolation: true', '上下文隔离');
  has(m, 'nodeIntegration: false', '禁 Node');
  has(m, 'will-navigate', '导航守卫');
  has(m, 'setMenu(null)', '去菜单');
  has(m, 'CM_SMOKE', '冒烟自检入口');
  has(m, 'autoInstallOnAppQuit', '更新器：退出自装');
  has(m, 'autoDownload = false', '更新器：发现新版先问用户，不自动下载');
  has(m, "'cm-upd-download'", '下载 IPC 通道（弹窗选「立即更新」用）');
  has(m, "require('electron-updater')", '更新器接线');
  has(m, "if (!app.isPackaged) return null", '开发模式跳过更新器');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  has(pre, 'contextBridge', '桥接方式暴露');
  has(pre, '__CM_UPDATER', '更新器受控桥');
  notHas(pre, 'nodeIntegration', 'preload 不开 Node');
});

t('⑥应用内更新：发布配置与页面接线', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  ok(pkg.build.publish && pkg.build.publish.provider === 'github' && pkg.build.publish.repo === 'class-manager-desktop', 'publish=github 源');
  ok(fs.existsSync(path.join(HERE, 'node_modules', 'electron-updater', 'package.json')), 'electron-updater 已安装');
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  has(p, '__CM_UPDATER', '页面走受控桥');
  has(p, '检查更新', '手动检查按钮');
  has(p, '重启应用即完成安装', '就绪提示');
  has(p, 'setTimeout(function () { checkNow(false); }, 30000)', '启动静默检查（手动参数 false）');
  has(p, "window.__CM_UPDATER.download()", '弹窗「立即更新」→ 下载');
  has(p, '发现新版本 v', '弹窗询问文案（先问后下）');
  const rm = fs.readFileSync(path.join(HERE, 'RELEASE.md'), 'utf8');
  has(rm, 'latest.yml', '发布命令含 latest.yml（漏传=更新链失效）');
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(`结果：${pass} 通过，${fail} 失败`);
if (fail) { console.log('\n失败项：'); failures.forEach(f => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
