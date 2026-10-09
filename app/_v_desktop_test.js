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
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  has(p, 'cmUpdToast', '更新弹窗函数');
  has(p, '__CM_UPDATER.download', '弹窗「立即更新」走下载桥');
  has(p, 'cmUpdDeclined', '「暂不」后本会话不再自动弹');
  has(p, '单机版', '关于卡桌面版介绍');
  has(p, '自动更新', '关于卡更新说明');
  has(p, "ah3.parentNode.insertBefore(row, ah3.nextSibling)", '检查更新栏 = 关于卡第一栏（紧随标题）');
  ok(p.indexOf("btn = el('button', 'btn btn-primary', '🔄 检查更新')") >= 0, '检查更新按钮主色加大（非小号 outline）');
  notHas(p, '更新代理', '更新代理功能已移除（v1.0.6 老板拍板）');
  has(p, 'enterWithTransition', '进入工作台平滑过渡');
  has(p, "overlay.classList.remove('hidden')", '交叉淡化：工作台先渲染、遮罩回顶淡出（盖住渲染帧卡）');
  has(css, 'background-blend-mode:soft-light', '工作台背景海报 soft-light 融入（随皮肤/暗色自适应）');
  has(css, 'cmDeskAppIn', '工作台淡入动画');
  has(css, '.login-overlay', '启动界面背景覆盖');
  ok(css.indexOf("url('./login-bg.jpg')") >= 0 && css.indexOf('html.dark .login-overlay') >= 0, 'AI 海报背景接入 + 暗色压暗层');
  ok(/\.cmDesk-login-card #cmDeskEnter\{[^}]*justify-content:center/.test(css), '直接进入按钮文字居中');
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
  const FOOT_IDS = ['cmWizNext', 'cmWizSkipAll', 'cmWizSkipPwd', 'cmWizBack', 'cmWizBack2', 'cmWizOk', 'cmWizDone', 'cmWizSkip', 'cmWizImport', 'cmWizSample'];
  for (const m of p.matchAll(/w\.body\.querySelector\('#([A-Za-z0-9_]+)'\)/g)) {
    ok(FOOT_IDS.indexOf(m[1]) < 0, 'foot 按钮 ' + m[1] + ' 被写成了 w.body.querySelector（首屏按钮死 bug 重演）');
  }
});

t('③f 注入层契约：示例体验 + 设置页再裁剪（v1.0.9）', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  const build = fs.readFileSync(path.join(HERE, 'build.js'), 'utf8');
  // 示例体验：注入/清除/指引/等待进入 四件套
  has(p, 'function cmSampleInject', '示例数据注入');
  has(p, 'function cmSampleCleanup', '示例数据清除（完成/跳过/跨会话兜底共用）');
  has(p, 'function cmStartTour', '位置弹窗指引');
  has(p, 'function cmTourWatch', '等工作台可见再起指引（零密码/密码登录两路兼容）');
  has(p, "sessionStorage.setItem(CM_TOUR_SNAP", '注入前快照进 sessionStorage（可恢复）');
  has(p, "990001", '示例 id 落在 990001+ 区间（与真实自增 id 永不冲突）');
  has(p, "'高2026级一班'", '示例班级名');
  has(p, "if (lsGet(CM_TOUR_FLAG) === '1') cmSampleCleanup(true);", 'boot 幂等清扫：中途关应用不残留示例');
  has(p, "w.foot.querySelector('#cmWizSample').onclick", '完成页「带示例体验」按钮走 foot 绑定');
  // 指引气泡样式
  has(css, '.cmDesk-guide{position:fixed', '指引气泡样式');
  has(css, '.cmDesk-guide-hl', '指引目标高亮样式');
  // 设置页再裁剪：网页版速览整块摘除
  has(p, "getElementById('settingsReleaseNotes')", '速览块 DOM 摘除');
  has(p, 'sn.parentElement.remove()', '摘除的是虚线容器整块（含折叠标题）');
  // build.js 文案补丁
  has(build, 'placeholder="如：高2026级一班"', '班级全称输入提示（老板示例：高2026级一班）');
  has(build, '三名学生可进入班委协作', '班委协作说明已重写（去版本号标签）');
  has(build, '登记 / 续假 / 销假 / 删除均不可用', '班委协作说明：请假页只读口径修正');
  // 打赏入口（自愿/零捆绑）：微信+支付宝双渠道，设置常驻卡 + 满 3 天一次性提醒
  has(p, 'function buildDonateRow', '关于卡常驻打赏卡');
  has(p, 'function cmDonateModal', '双渠道选择弹窗（微信/支付宝并排标注）');
  has(p, "CM_DONATE = { wechatImg: 'donate-wechat.png', alipayImg: 'donate-alipay.png' }", '双码资产接线');
  has(p, '#07C160', '微信渠道徽标色');
  has(p, '#1677FF', '支付宝渠道徽标色');
  has(p, 'function cmNudgeMaybe', '满 3 天诙谐提醒（周期制）');
  has(p, "CM_NUDGE_DAYS = 3", '提醒周期 3 天');
  has(p, "lsSet(CM_NUDGE_AT, String(Date.now()))", '记上次弹出时间（每满 3 天再来一轮）');
  notHas(p, "lsSet(CM_NUDGE_FLAG, '1')", '一次性永不再扰已废（v1.0.12 老板拍板改周期提醒）');
  has(p, "id=\"cmNudgeLater\"", '满天弹窗保留「下次一定」（仅关本轮弹窗）');
  has(p, 'if (lsGet(CM_TOUR_FLAG) === \'1\')', '示例体验期间不弹（避让）');
  // 爱发电以「商品」身份回归（v1.1.0 Pro 买断，见 ⑦）；打赏弹窗本身仍只用收款码图片
  has(build, 'donate-alipay.png', 'build 双码资产拷贝');
  has(p, 'cmDonateLater', '双码弹窗「下次一定」按钮（v1.0.11）');
  // 独立打赏卡（v1.0.11 老板拍板：拆出关于卡、排其上方、带下次一定、按钮放大）
  has(p, "getElementById('cmDeskDonateSec')", '独立打赏卡幂等护栏');
  notHas(p, 'cmDonateSnooze', '打赏卡常驻不消失（无下次一定按钮，v1.0.12）');
  has(p, 'CM_NUDGE_DAYS * 86400000', '满天弹窗周期 = 3 天');
  has(p, 'about.parentNode.insertBefore(sec, about)', '独立卡排在「关于本系统」上方');
  ok(p.indexOf('padding:10px 30px;font-size:14.5px') >= 0, '打赏作者按钮放大（主色大按钮）');
  has(p, "btn btn-primary\" id=\"cmDonateOpen\"", '打赏作者改主色大按钮');
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
  has(m, "if (!app.isPackaged && !process.env.CM_UPDTEST) return null", '开发模式跳过更新器（CM_UPDTEST 端到端验证例外）');
  notHas(m, "mode: 'direct'", '不强制直连（跟随系统代理；github.com 直连被墙，强制直连必挂）');
  has(m, 'updater-proxy.json', 'v1.0.5 代理残留启动即清理');
  has(m, 'pickFeed', '更新源并发探测择优（v1.0.8）');
  has(m, 'quitAndInstall(true, true)', '静默安装+装完自启（v1.0.9：点一次立即重启后全程免操作）');
  has(m, 'setFeedURL({ provider: \'generic\', url: feed.url })', '运行时切 generic 源');
  has(m, 'releases/latest/download/', 'latest.yml 走 latest/download 固定路径（免 tag 依赖）');
  has(m, 'gh-proxy.com', '镜像主源（实测直连可达 206/200）');
  has(m, "/^version:\\s*\\d/m", 'latest.yml 合法性校验（防镜像劫持返回 HTML）');
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
  has(p, '沿用原目录静默覆盖安装', '就绪提示（自动安装+自动重启文案）');
  has(p, "id=\"cmUpdInstall\"", '就绪弹窗有「立即重启」按钮');
  has(p, 'setTimeout(function () { checkNow(false); }, 30000)', '启动静默检查（手动参数 false）');
  has(p, "window.__CM_UPDATER.download()", '弹窗「立即更新」→ 下载');
  has(p, '发现新版本 v', '弹窗询问文案（先问后下）');
  const rm = fs.readFileSync(path.join(HERE, 'RELEASE.md'), 'utf8');
  has(rm, 'latest.yml', '发布命令含 latest.yml（漏传=更新链失效）');
});

t('③g 注入层契约：反馈卡邮件直达（v1.0.11）', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  has(p, '846699191@qq.com', '作者邮箱');
  has(p, 'buildFeedbackRow(about);', '关于卡接线（enhanceAbout 内调用）');
  has(p, "about.querySelector('.cmDeskFeedback')", '反馈卡幂等护栏');
  has(p, '__CM_FEEDBACK.mail', '写邮件走受控桥');
  has(p, 'cmCopyText', '复制邮箱兜底函数');
  has(p, 'id="cmFbCopy"', '邮箱 chip 可点复制');
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  has(m, "ipcMain.handle('cm-feedback-mail'", '主进程邮件 IPC');
  has(m, "shell.openExternal('mailto:' + FEEDBACK_MAIL", '收件人在主进程拼死（页面传不进任意 URL）');
  has(m, 'app.getVersion()', '主题/正文带版本号（定位问题快）');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  has(css, '.cmDeskFeedback', '反馈卡样式');
  has(css, '.cmDeskFbMail', '邮箱 chip 样式');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  has(pre, '__CM_FEEDBACK', 'preload 反馈桥');
  notHas(pre, 'nodeIntegration', 'preload 不开 Node');
});

t('⑦ 注入层契约：Pro 买断体系（v1.1.0）', () => {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  const build = fs.readFileSync(path.join(HERE, 'build.js'), 'utf8');
  // gate：UI 不变点击才拦 + 每会话每功能一次
  has(p, 'function cmWrapPro', 'Pro gate 包装器');
  has(p, "cmWrapPro('seatExportImage', '座次表导出打印')", '座次表导出已挂 Pro gate');
  has(p, "cmWrapPro('dutyExportImage', '值日表导出打印')", '值日表导出已挂 Pro gate');
  has(p, 'CM_PRO_SESSION[label] = 1', '引导框每会话每功能只弹一次');
  has(p, 'if (cmProActive()) return orig.apply(this, arguments);', '已激活透传原函数');
  // 引导弹窗：引导付费 + 申请码 + 自动取码 + 手动贴码
  has(p, 'function cmProModal', 'Pro 引导弹窗');
  has(p, 'cmProReqCode', '申请码生成（设备指纹+邮箱哈希）');
  has(p, 'custom_order_id=', '购买链接携带申请码（自动发货对单用）');
  has(p, 'afdian.com/item/', '爱发电商品页购买入口（afdian.com 新域名）');
  has(p, "id=\"cmProClaim\"", '「我已付款自动取码」按钮');
  has(p, "id=\"cmProGo\"", '手动贴码激活');
  has(p, '846699191@qq.com', '失败兜底联系邮箱');
  // 激活后状态切换
  has(p, 'function buildProActiveCard', '「Pro 已激活」卡（D1=A）');
  has(p, 'if (cmProActive()) return;   // 已买断：不再弹赞赏提醒（D 批复）', '买断后赞赏满天弹窗停发');
  has(p, '早鸟纪念', '早鸟纪念徽章 #N/100');
  // 主进程验签（双存储：pro.json 存 lic 原文，status 重验签）；核心实现抽 pro.core.cjs（探针共用）
  has(m, "require('./src/pro.core.cjs')", '主进程接 Pro 核心（薄壳）');
  const core = fs.readFileSync(path.join(HERE, 'src', 'pro.core.cjs'), 'utf8');
  has(core, "require('./ed25519.cjs')", '核心内联 Ed25519 验签库');
  has(core, 'async function proCheck', '验签函数（真实现，探针共用）');
  has(core, 'l.dev !== reqDev', '设备指纹绑定校验');
  has(core, "ipcMain.handle('cm-pro-status'", '状态 IPC（重验签）');
  has(core, "ipcMain.handle('cm-pro-activate'", '激活 IPC');
  has(core, "ipcMain.handle('cm-pro-claim'", '自动取码 IPC');
  ok(/const CM_PRO_PUB = '[0-9a-f]{64}'/.test(m), '真公钥已内置（64 hex）');
  has(m, 'proCore.register(', '主进程注册 Pro handlers');
  ok(m.indexOf("process.env.CM_PRO_PUB_DEV") >= 0, '测试公钥逃生舱口存在');
  ok(/!app\.isPackaged && process\.env\.CM_PRO_PUB_DEV/.test(m), '公钥测试覆盖仅限非打包环境');
  // 桥与打包
  has(pre, '__CM_PRO', 'preload Pro 受控桥');
  notHas(pre, 'nodeIntegration', 'preload 不开 Node');
  ok(pkg.build.files.indexOf('src/ed25519.cjs') >= 0, '验签库进 asar');
  has(build, 'src/ed25519.cjs', 'build.js 拷贝验签库');
  ok(fs.existsSync(path.join(HERE, 'src', 'ed25519.cjs')), '验签库文件存在');
  has(css, '.cmDesk-pro-price', 'Pro 弹窗样式');
  // 老承诺红线：免费承诺文案仍在
  has(p, '功能不加钱也不减', '老承诺文案仍在（基础版永久免费）');
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(`结果：${pass} 通过，${fail} 失败`);
if (fail) { console.log('\n失败项：'); failures.forEach(f => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
