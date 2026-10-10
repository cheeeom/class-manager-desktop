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
  ok(!/cmWizNext"><span>下一步<\/span><span class="arr">/.test(p), '向导「下一步」无箭头（v1.2.6 老板拍板去箭头）');
  ok(!/<span class="arr">←<\/span><span>上一步/.test(p), '向导「上一步」无箭头');
  ok(p.indexOf("'<button class=\"btn btn-outline\" id=\"cmWizBack\"><span>上一步</span></button>' +") >= 0
     && p.indexOf("'<button class=\"btn btn-primary\" id=\"cmWizNext\"><span>下一步</span></button>')") >= 0,
     '向导按钮顺序：上一步居左、下一步居右（v1.2.6 使用逻辑）');
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
  has(p, "document.querySelector('.cmDeskFeedback')", '反馈卡幂等护栏（v1.2.6 独立成卡，文档级查重）');
  has(p, 'about.parentNode.insertBefore(sec, about);   // 独立卡：排在「关于本系统」上方', '反馈卡独立成卡置于关于卡上方（v1.2.6 老板拍板）');
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
  has(core, "ipcMain.handle('cm-pro-report-pdf'", '报告 PDF IPC（探针同源）');
  has(core, 'printToPDF', 'PDF 走 Electron printToPDF（离线）');
  has(core, '/<script/i.test(html)', 'PDF HTML 拒绝脚本注入');
  ok(core.indexOf('!app.isPackaged && process.env.CM_PROBE_PDF') >= 0, 'PDF 免对话框逃生舱仅限非打包+环境变量');
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
  // 老承诺红线：免费承诺文案仍在（v1.2.6 措辞升级：Pro 买断制上线后的口径）
  has(p, '已发布功能永久免费', '老承诺文案仍在（基础版永久免费）');
});

/* ⑧ M3 学期报告引擎（v1.1.0 Pro 核心） */
t('M3 学期报告引擎契约', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  ok(distHtml, 'dist/index.html 不存在——先跑 node build.js');
  has(p, 'function cmReportOpen', '报告面板入口');
  has(p, "if (!cmProActive()) { cmProModal('学期报告引擎'); return; }", '报告入口 Pro 闸（未激活弹引导框）');
  has(p, 'function cmReportStuData', '个人报告数据聚合');
  has(p, 'function cmReportClassData', '班级报告数据聚合');
  has(p, 'liveOps(state.operations)', '统计走流水并过滤撤销（liveOps）');
  has(p, "loadPubSetting('semesterStart')", '学期起点读公示页手动设置');
  has(distHtml || '', 'function pngExport', '页面导出基建存在（长图复用页面函数）');
  has(p, "pngExport(lastCanvas", '长图导出复用页面 pngExport');
  has(p, 'REASON_CATALOG_FLAT[reason]', '原因反查大类（原因目录）');
  has(p, "lsGet(CM_RPT_LS_CMT)", '老师寄语本地保存');
  has(pre, 'reportPdf', 'preload PDF 桥');
  has(css, '.cmDesk-report-panel', '报告面板样式');
  has(css, '.cmDesk-pro-badge', 'PRO 徽章样式');
});

/* ⑨ v1.1.1：Pro 扩容 + 导航栏 Pro 化 + 复制修复 + 云同步静音 */
t('⑨ Pro 扩容与导航栏 Pro 化', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const core = fs.readFileSync(path.join(HERE, 'src', 'pro.core.cjs'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  // 复制走主进程 clipboard
  has(core, "ipcMain.handle('cm-clip-write'", '主进程剪贴板 IPC');
  has(core, 'CLIP.writeText', 'Electron clipboard 直写');
  has(pre, '__CM_CLIP', 'preload 剪贴板桥');
  has(p, 'function cmProCopy', '统一复制函数（桥优先）');
  has(p, '__CM_CLIP.write', '复制桥优先于 navigator.clipboard');
  has(p, 'cmProCopy(req,', '申请码复制走统一函数');
  // Pro 扩容：工作留痕配图 / 学分银行 / 数据分析
  has(p, "cmWrapPro('wlAddImages', '工作留痕配图')", '工作留痕配图已挂 Pro gate');
  has(p, "cmWrapPro('cbDoSettleUI', '学分银行')", '学分银行·月度结算已挂 gate');
  has(p, "cmWrapPro('cbOpenItemDetail', '学分银行')", '学分银行·兑换已挂 gate');
  has(p, "cmWrapPro('cbUseVoucherUI', '学分银行')", '学分银行·核销已挂 gate');
  has(p, "cmWrapPro('cbRefundVoucherUI', '学分银行')", '学分银行·退还已挂 gate');
  has(p, "cmWrapPro('cbOpenItemEditor', '学分银行')", '学分银行·商品编辑已挂 gate');
  has(p, "cmWrapPro('cbOpenBankProfile', '学分银行')", '学分银行·学生档案已挂 gate');
  has(p, "cmWrapPro('switchAnalyticsTab', '数据分析')", '数据分析·切 tab 已挂 gate');
  // 导航栏：PRO 角标 + 学期报告独立入口
  has(p, 'function buildNavPro', '导航栏 Pro 化函数');
  has(p, 'cmDesk-navbadge', 'PRO 角标类');
  has(p, 'cmNavReport', '学期报告导航项');
  has(p, "reportItem.addEventListener('click', function () { cmReportOpen(); });", '报告导航项直弹报告/引导框');
  has(css, '.cmDesk-navbadge', '导航 PRO 角标样式');
  // 设置页入口卡已撤（挪到导航栏）
  ok(p.indexOf('buildReportCard') < 0, '设置页报告入口卡应已移除');
  // 云同步静音
  has(p, 'function silenceCloudPush', '云同步静音函数');
  has(p, 'window.autoPushToCloud = function', 'autoPushToCloud 已置空（去 token 提示）');
});

/* ⑩ v1.2.0：页面级 Pro 锁 + 剪贴板粘贴激活码 + Pro 版图扩张 */
t('⑩ 页面级 Pro 锁', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const core = fs.readFileSync(path.join(HERE, 'src', 'pro.core.cjs'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  // 页面清单（v1.2.6 放宽：考勤请假/课堂点名转免费，老板拍板；免费=工作台/学生/班委/寝室/座次表/值日/考勤/点名）
  ['grades', 'todo', 'worklogs', 'notices', 'credits', 'bank', 'publicity', 'honors', 'analytics', 'profiles'].forEach(function (pg) {
    ok(p.indexOf(pg + ": ['") >= 0, 'CM_PRO_PAGES 缺页面 ' + pg);
  });
  ok(p.indexOf("attendance: [") < 0 && p.indexOf("rollcall: [") < 0, '考勤请假/课堂点名已转免费（v1.2.6）');
  has(p, 'function wrapNavigatePro', 'navigateTo 包闸');
  has(p, "window.__cmRole === 'committee'", '班委协作模式豁免页面锁');
  has(p, 'function cmPagePill', '关弹窗后悬浮解锁按钮');
  has(p, 'cmDesk-blurtarget', '高斯模糊类（渲染层）');
  has(css, '.cmDesk-blurtarget', '高斯模糊样式');
  has(css, '.cmDesk-pagepill', '悬浮解锁按钮样式');
  has(css, '.cmDesk-pro-intro', '页面功能介绍样式');
  has(p, 'cmPageLockClear', '激活成功解除模糊');
  // 剪贴板粘贴激活码
  has(core, "ipcMain.handle('cm-clip-read'", '主进程剪贴板读取 IPC');
  has(pre, 'read:', 'preload 剪贴板读取桥');
  has(p, 'cmProPaste', '「我已有激活码」粘贴按钮');
  has(p, '/^CMPRO1\\./.test(t)', '粘贴内容校验激活码前缀');
  // Pro 版图扩张：公示导出两闸
  has(p, "cmWrapPro('exportPublicityPoster', '公示海报导出')", '公示海报导出已挂 gate');
  has(p, "cmWrapPro('exportWeeklyReport', '学分周报导出')", '学分周报导出已挂 gate');
});

/* ⑪ v1.2.3：激活心跳（退款自动上锁） */
t('⑪ 激活心跳与退款上锁', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const core = fs.readFileSync(path.join(HERE, 'src', 'pro.core.cjs'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  has(core, "ipcMain.handle('cm-pro-heartbeat'", '主进程心跳 IPC');
  has(core, 'reqCode', '激活时持久化申请码（心跳凭据）');
  has(core, "replace('?req=', '?mode=check&req=')", '心跳 URL 换 check 分支');
  has(core, 'unlinkSync', '吊销 = 删激活文件上锁');
  has(core, 'alive === false', '吊销判定');
  has(pre, 'heartbeat:', 'preload 心跳桥');
  has(p, 'function cmProHeartbeat', '渲染层心跳调度');
  has(p, 'function cmProRevoke', '吊销后恢复锁态');
  has(p, 'setTimeout(cmProHeartbeat, 20000)', '启动 20s 后静默复查');
  has(p, 'cmProRefresh()', '吊销后刷新激活缓存');
});

/* ⑫ v1.2.4：开发者模式（双态模拟 + 向导重播） */
t('⑫ 开发者模式', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  has(p, 'cmDevOverride !== null) return cmDevOverride === true', '渲染层模拟优先于真实状态');
  has(p, 'function cmDevTap', '连点入口计数');
  has(p, "closest('.sidebar-footer')", '侧栏版本文字连点 5 次');
  has(p, 'cmDevTaps >= 5', '5 次阈值');
  has(p, 'function cmDevPanel', '浮动开发者面板');
  has(p, "lsSet(LS_ONBOARD, ''); stepWelcome()", '重播首启向导');
  has(p, '不改动真实激活数据', '面板注明不碰真实数据');
  has(p, 'cmDevApply', '模拟后即时套用锁态');
  has(css, '.cmDesk-devbadge', 'DEV 角标样式');
  has(css, '.cmDesk-devcard', '开发者面板样式');
});

/* ⑬ v1.2.5：开发者密钥门槛（开启需密钥，关闭免密） */
t('⑬ 开发者密钥门槛', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const m = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
  const pre = fs.readFileSync(path.join(HERE, 'preload.js'), 'utf8');
  has(m, "ipcMain.handle('cm-dev-checkkey'", '主进程密钥校验 IPC');
  has(m, 'CM_DEV_KEY_HASH', '代码只存 SHA-256 不存明文');
  has(m, "createHash('sha256')", 'SHA-256 比对');
  has(pre, '__CM_DEV', 'preload 密钥校验桥');
  has(p, 'function cmDevKeyPrompt', '密钥输入弹窗');
  has(p, "id=\"cmDevKeyIn\" type=\"password\"", '密钥输入框（密码态）');
  has(p, "else cmDevKeyPrompt();", '开启需密钥');
  ok(/cmDevOn\) \{\s*\/\/ 关闭免密/.test(p) || p.indexOf('关闭免密') >= 0, '关闭免密');
  has(p, "checkKey(v).then", '异步主进程比对');
});

/* ⑭ v1.2.6：向导导入学生名单 + 侧栏 PRO 徽标 + 请假流水导出 + 关于卡更新简要 */
t('⑭ v1.2.6 七件套', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  // 向导第 5 步：导入学生名单（网页版描述已移除）
  has(p, '导入学生名单（可选）', '向导第 5 步改导入学生名单');
  notHas(p, '如果你在用<b>网页版</b>', '网页版导入描述已移除');
  has(p, 'function cmWizStuTpl', '导入模板下载函数');
  has(p, '学生导入模板.csv', '模板文件名');
  has(p, 'function cmWizPickTable', '向导表格导入入口');
  has(p, "id === 'studentImportModal'", '劫持预览弹窗：向导语境直接确认注入');
  has(p, 'wizState.imported = true', '导入后置标记');
  has(p, "setTimeout(function () { finishWizard(false); }, 250);", '导入完成自动收尾进入工作台');
  ok(p.indexOf("(wizState.imported") >= 0, '完成页按 imported 切换文案/按钮（不再展示示例数据）');
  ok(p.indexOf("(wizState.imported\n        ? '<p>📋 学生名单已导入") >= 0 || p.indexOf("wizState.imported ?") >= 0 || p.indexOf("(wizState.imported") >= 0, '示例体验让位已导入名单');
  // 导入模板演示行无多余空格（列识别口径干净）
  ok(p.indexOf(', S202601 ,') < 0, '模板演示数据无脏空格');
  // 侧栏 PRO 徽标（激活专属）
  has(p, 'cmDesk-proemblem', '侧栏 PRO 徽标类');
  has(css, '.cmDesk-proemblem', '侧栏 PRO 徽标样式');
  has(p, "var olds = nav.querySelectorAll('.cmDesk-navbadge');", '激活后清角标（状态感知重跑）');
  ok((p.match(/buildNavPro\(\)/g) || []).length >= 4, 'buildNavPro 至少四处刷新（boot/激活/吊销/开发者模拟）');
  // 请假流水导出（Pro）
  has(p, 'function buildLeaveExportBtn', '考勤页导出按钮注入');
  has(p, "cmWrapPro('cmExportLeaveFlow', '请假流水导出')", '请假流水导出已挂 Pro gate');
  has(p, 'window.cmExportLeaveFlow = function', '导出实现挂 window（gate 包装目标）');
  has(p, '班委模式无权导出数据', '班委模式拦截导出');
  // 关于卡：本版更新简要（无网页版字样）
  has(p, '桌面版 v\' + D.version + \' 更新', '关于卡 = 本版更新简要');
  ok(p.indexOf('功能与网页版') < 0, '关于卡介绍不再提网页版');
  // 打赏弹窗口径跟上 Pro 时代
  has(p, '免费功能永久免费，Pro 一次买断', '打赏弹窗文案不再声称「所有功能永远免费」');
  // wizard.css：箭头钉右侧死规则已随箭头移除
  ok(!/\.cmDesk-wfoot \.btn \.arr/.test(css), 'wfoot 箭头死规则已清');
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(`结果：${pass} 通过，${fail} 失败`);
if (fail) { console.log('\n失败项：'); failures.forEach(f => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
