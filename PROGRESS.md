# PROGRESS.md — 班主任工作台 · 桌面版

> 真实进度只认本文件。基准：线上 Latest = **v1.0.12**（远端 main 047c5652 含落地页 Pro 专区；本地与远端内容等价待 fetch 对齐）· baseWeb v3.4.0 · 2026-10-09 19:30。

## 一、当前状态速览

- **线上 Release**：**v1.0.12 = Latest**（三件套齐 + 镜像 latest.yml 服 1.0.12 + exe 206 实测）；v1.0.0…v1.0.11 在档。
- **测试**：`_v_desktop_test.js` **15/15 全绿**（+⑦ Pro 契约段）；Pro 全链探针五步全绿；打包冒烟 **PASS**（v1.1.0 / wizard 交互 / feed=gh-proxy 镜像）。
- **进行中**：**Pro 买断制 M4 付费墙+激活体系已完成编码**（v1.1.0 已打包**未发布**——M3 学期报告引擎未做，等老板验收 M4 后再定发布节奏）。落地页 Pro 专区已上线（远端 047c5652）。

## 二、待办队列

### Pro M4（已完成编码，v1.1.0 已打包未发布：付费墙 + 激活体系）
- [x] 激活码体系：申请码 `b64url(JSON{v:1,dev:16hex,eh:8hex})`；规范串 `CM1|tier|sn|eh|dev|ts`；激活码 `CMPRO1.` + `b64url(JSON{...,sig})`；Ed25519 签验（noble-ed25519 v2.1.0 → `app/src/ed25519.cjs` CJS 化）
- [x] Pro 核心共享 `app/src/pro.core.cjs`（main+探针同源）：proParse/proCanon/proCheck + IPC 注册（cm-pro-status 重验签 / cm-pro-activate 设备比对+写 pro.json / cm-pro-claim 自动取码，未配置 API 时优雅降级）；main.js 薄壳 `CM_PRO_PUB` 占位 + `CM_PRO_PUB_DEV` 测试逃生舱（仅 !isPackaged）
- [x] 渲染层 `app.patch.js`：cmProDev 设备指纹（16hex 随机）/ cmProReqCode 申请码（邮箱 FNV-1a→eh；**b64 正则必须 `/\+/g`**）/ cmWrapPro 导出闸（激活直通、未激活弹引导框）/ cmProModal 引导框（权益清单+申请码复制+购买链接带 `?custom_order_id=`+自动取码+手动贴码）/ buildProActiveCard（D1「✅ Pro 已激活」卡+小打赏入口）
- [x] 买断后体验：Pro 激活 → 停发满天弹窗（cmNudgeMaybe 首行闸）+ 打赏卡换「Pro 已激活」卡；接线 gate：座次表导出/值日表导出（学期报告 M3 未做）
- [x] preload 受控桥 `__CM_PRO{status,activate,claim}`；build.js 拷贝清单 + package.json build.files 增 ed25519.cjs/pro.core.cjs
- [x] 测试 15/15（+⑦ Pro 契约段：gate 接线/CM_PRO_SESSION 一次性/购买链接传申请码/afdian.com 入口/买断停发断言/公钥占位/asar files）；`_probe_pro.js` 全链探针五步全绿（未激活弹框→换机码拒→真码激活换卡→直通→reload 持久）
- [x] v1.1.0 打包 BUILD-OK + 冒烟 PASS（version=1.1.0 / consoleErrors=[] / verdict=PASS）
- [x] PRO-DESIGN.md §3.5 自动发货机定稿（爱发电 Webhook RSA 验签 + custom_order_id 传申请码 + 云函数 Ed25519 签码存 KV + App claim；兑换码批次备选）
- [ ] **等老板**：KeyGen 生成真公钥替换 `CM_PRO_PUB`；爱发电开店后替换占位链接（落地页 `pro-buy`、`CM_PRO_BUY_URL`）；自动取码云函数部署（需 user_id/token）
- [ ] **发布节奏**：M3 学期报告引擎做完后，Pro 正式随版发布（避免「引导付费但 Pro 功能只有两个导出」的半成品体验）

### Pro M2（已完成归档：落地页 Pro 专区 + KeyGen + 文案）
- [x] 落地页 Pro 专区上线（免费/Pro 对比卡、早鸟倒数 `PRO_EARLY_SOLD=0`、三步激活、FAQ 3 条、承诺文案改口径）→ 远端 047c5652
- [x] KeyGen 私用工具 `D:/a/chee777/_pro_keygen.html`（离线 Ed25519 签发+发货记录）+ 契约测试 6/6
- [x] 爱发电商品文案 `_afdian_商品文案.md`（商品描述/发货话术/上架清单）

### P0（v1.0.12 已发布归档：赞赏交互定稿）
- [x] 老板拍板赞赏交互：打赏卡**常驻不消失**（去卡片「下次一定」与 3 天收起 `cmDonateCardSnooze` 整体删除）
- [x] 满天弹窗改**周期制**：`cmDonateNudgeAt` 记上次弹出时间，每满 3 天再弹一轮；旧一次性标记 `cmDonateNudge='1'` 迁移为「刚提醒过」
- [x] 弹窗「下次一定」（`cmNudgeLater`）仅关本轮弹窗（`cmDonateLater` 双码弹窗的保持原样）
- [x] 回归 14/14 + 探针（nudge 弹出记 lastAt / reload 不弹；设置页卡片无按钮）+ 打包冒烟 PASS + 三件套多路验收 ✓
- ⚠️ **打包新坑（v1.0.12）**：环境安全删除钩子拦 `win-unpacked` 整树清理（bulk>50 需确认，bash rm 也拦）→ **先 `mv out/win-unpacked out/_trash_*` 再打包**（BUILD-OK attempt 1）；废料目录可小批量删

### v1.0.11（已发布归档：反馈卡 + 打赏独立卡 + 落地页弹窗修复）
- [x] P0 修落地页赞赏弹窗「关不掉 + 开页即弹」：CSS display:flex 覆盖 hidden 属性 → 补 `[hidden]{display:none!important}`（老板实机报，截图定位）
- [x] 落地页弹窗加「下次一定」；下载按钮旁虚拟下载数徽标（基数 10/6 起每天+11、进视野滚动上涨、每 8~20s 随机 +1）
- [x] 桌面版双码弹窗补「下次一定」；_probe_landing 断言初始 display:none + 关闭回归
- [x] 回归 14/14（+③g 反馈卡契约）+ 打包版 1.0.11 冒烟 PASS（verdict=PASS / feed=gh-proxy 镜像）
- [x] 老板说推送 → v1.0.11 追加桌面功能并入同版：设置页反馈卡（846699191@qq.com 邮件直达 `cm-feedback-mail` 受控桥 + 点邮箱复制）+ 「请作者喝杯奶茶」拆独立卡排「关于本系统」上方（「下次一定」= 收起 3 天 `cmDonateCardSnooze`；打赏作者按钮放大主色）
- [x] 落地页 hero 区补「☕ 请作者喝杯奶茶」按钮（e782d8f，三入口验收 ✓）
- [x] Release 三件套推送 + 多路验收 ✓：Latest=v1.0.11（三资产齐，exe×2 均 83,049,057B）；gh-proxy latest.yml 服 1.0.11 + exe 真实下载 206；ghfast 当晚不可达（三候选源兜底无碍）；稳定直链 302 有效（本机 github.com 直连抖动，API 侧事实为准）
- ⚠️ 本轮 git push 两路全堵 → 首次启用**纯 Python urllib API 增量推送**（`D:\a\chee777\_push_1011_api.py`，blob 归一化 LF + sha 自校验）；本地 HEAD（3813bcd）与远端（b0f13d5d）**内容等价但 sha 不同**，下次 fetch 通了记得 reset --hard 对齐

### v1.0.10（已发布归档）
- [x] 微信+支付宝收款码（560px PNG，126+70KB）入 dist 与落地页；爱发电暂缓（老板拍板）
- [x] 桌面版：关于卡常驻打赏卡 → 双渠道选择弹窗（渠道徽标 07C160/1677FF）；弹窗 440px 修双码挤竖排
- [x] 满 3 天一次性诙谐提醒（cmNudgeMaybe，弹过即记；进工作台 8s 后说；避开示例体验期）；_probe_nudge.js 真值全链 PASS
- [x] 落地页：下载区 CTA + 页脚「☕ 请作者喝杯奶茶」→ 双渠道弹窗（已上线验收 200）
- [x] 回归 13/13 + 双冒烟 PASS + Setup-1.0.10.exe 就绪
- [x] 推送 + 发布 v1.0.10 Release 三件套（镜像 latest.yml 服 1.0.10；稳定直链 206，直连抖动走代理复验）

### v1.0.9（已发布归档）
- [x] 设置页移除「网页版近版更新速览」整块（DOM 摘除虚线容器）
- [x] 班级全称提示 →「如：高2026级一班」（placeholder + 两处 toast 示例，build 补丁 3 条）
- [x] 更新就绪 →「立即重启」后 quitAndInstall(true,true)：原目录静默覆盖 + 自动重启，全程免操作
- [x] 新手示例体验：完成页「带示例体验」→ 示例注入（高2026级一班+6学生+1流水，id 990001+，快照 sessionStorage）→ 5 步位置弹窗指引（下一步/跳过）→ 完成自动清除；boot 幂等兜底；_probe_tour.js 全链真值 PASS
- [x] 班委协作说明重写（去版本标签、请假只读口径修正，build 补丁恰好 1 处命中）
- [x] 回归 13/13（新增 ③f 示例体验契约）+ 开发/打包双冒烟 PASS + Setup-1.0.9.exe 就绪
- [x] 推送 + 发布 v1.0.9 Release 三件套（镜像 latest.yml 实测服 1.0.9，稳定直链 206；推送途中代理瞬时抖动一次，重试即过）

### v1.0.8（已发布归档）
- [x] **诊断「检查更新 net::ERR_CONNECTION_TIMED_OUT」**（v1.0.7 发布后老板实机报）：实测 github.com 直连 TCP 超时、api.github.com 通、gh-proxy 镜像直连 200——electron-updater GitHub 源绑死 github.com 域，直连必挂
- [x] **更新源智能择优**：generic 源 + `releases/latest/download/` 固定路径；三候选并发探测（gh-proxy/ghfast/官方，6s 超时，latest.yml 正则校验）；`setFeedURL` 运行时切换；撤强制直连（跟随系统代理，镜像直连可达为主源）
- [x] CM_UPDTEST 端到端验证（dev 实测 ok + version=1.0.7 + 源=gh-proxy）；CM_SMOKE 增加 feed= 输出；回归 12/12；打包 v1.0.8 双冒烟 PASS
- [x] 推送 + 发布 v1.0.8 Release 三件套（镜像 latest.yml 实测服 1.0.8，稳定直链 206）

### v1.0.7（已发布归档）
- [x] 推送 + 发布 v1.0.7 Release 三件套（commits ea03ac8→c1b36fb；latest.yml 服 1.0.7，稳定直链 206）
- [x] 启动背景换 AI 海报（ImageGen 生成，PIL 裁 AI 生成角标 → login-bg-a/b.jpg 163/118KB；build.js 复制进 dist；暗色叠压暗层；测试断言更新）
- [x] **更新器一律直连**（老板 2026-10-07 拍板：直连就行不上代理）：默认会话 `setProxy({mode:'direct'})`（electron-updater 走 electron.net→默认会话，UI 只加载本地 file:// 零影响）+ 启动清理 v1.0.5 残留 `userData/updater-proxy.json`（死代理 = ERR_CONNECTION_TIMED_OUT 根因）；冒烟新增 `updaterRoute=DIRECT` 实证
- [x] 老板选稿：**A 全景山峦**（2026-10-07 拍板）→ 待推送发 v1.0.7
- [x] 海报背景嵌入工作台：`body` 同图 `background-blend-mode:soft-light`（随皮肤/暗色自适应，卡片底下透纹理）
- [x] 进入动画改**交叉淡化**：`enterWithTransition` 先 `enterApp` 渲染工作台（遮罩仍不透明盖住左上导航渲染帧卡）→ 遮罩回顶 0.6s 淡出+scale(1.045)；探针改点按 `#cmDeskEnter` 并补拍过渡中间帧（`_probe_transition.png` 实测工作台已在遮罩下就绪）
- [x] 移除 v1.0.5 更新代理（老板拍板撤下：UI/桥/IPC/持久化全链路）
- [x] 启动界面背景重设计：纸墨远山 SVG data-URI 覆盖 .login-overlay（明暗双套），卡片/标题/按钮全居中
- [x] 「直接进入」平滑过渡：enterWithTransition（登录层淡出 scale 1.03 → .app cmDeskAppIn 淡入上浮）；向导完成同路径
- [x] **更新代理设置**（老板实机报检查更新 net::ERR_TIMED_OUT）：关于卡「🌐 更新代理」行 + main.js IPC（cm-upd-getproxy/setproxy，存 userData/updater-proxy.json，启动恢复，session.defaultSession.setProxy 生效于 electron.net）；检查超时时状态栏引导填代理
- [x] 冒烟隔离化：CM_SMOKE 模式 userData 改临时目录（向导断言确定性 + 不碰真实数据）；代理 IPC 无条件注册（dev 下 setupUpdater 提前 return 曾致未捕获异常）
- [x] **P0 修复零密码登录面板布局错乱**（老板实机截图）：根因 = 网页版 .login-card 是 760px 横排双栏布局，注入面板套用即炸；改为自包含 .cmDesk-login-card（wizard.css），测试加 notHas 禁复用断言；探针新增登录页截图步骤（wait1 空步 capturePage）
- [x] 检查更新选择弹窗确认完整（available 态 toast：立即更新/暂不；老板旧包无 toast CSS 才看不见，v1.0.3 起已修）
- [x] 补更新 toast 的 CSS（wizard.css：定位左下角/卡片风/进度条/四态）
- [x] 测试锚点跟随（checkNow(false)）+ 新增 12 项断言（版本位/弹窗/按钮排版/设置页桌面化）
- [x] 重建 + 12/12 + 冒烟 PASS + 截图人工复核
- [x] 提交（`65fdce0`，含 `_probe_toast.js` 清理；推送待老板指令）

- [x] 检查更新按钮放大（btn-primary + padding 8/20）并挪到关于卡第一栏（紧随标题）
- [x] package.json version → 1.0.3（给老板预览旧包一条升级路径：发布 v1.0.3 后其内置更新器即可发现新版）
- [x] 推送 + 发布 v1.0.3 Release 三件套（https://github.com/cheeeom/class-manager-desktop/releases/tag/v1.0.3 ，打包冒烟 PASS，稳定直链 206）

### P1
- [x] 出 v1.0.2 安装包（BUILD-OK，冒烟 PASS）
- [x] 发布 v1.0.2 Release 三件套（https://github.com/cheeeom/class-manager-desktop/releases/tag/v1.0.2 ，稳定直链经代理实测 206）
- [ ] 清理 out/ 旧安装包（09:08 的 `班主任工作台-Setup.exe` 是命名迭代残留）。

### P2
- [ ] **v1.0.2 装机实测更新链**：v1.0.1 装机升级 v1.0.2 已可行（v1.0.1 无内置更新器则覆盖安装）；v1.0.3 发布后实测「检查→弹窗→下载→重启安装」全链。
- [ ] 蓝奏云镜像（国内下载 GitHub 慢）。
- [ ] `cm-desktop-landing/index.html` 与桌面仓落地页已分叉，确认废稿后清理。
- [ ] `_probe_settings.js`（视觉探针，隔离 userData 不碰真数据）发布前决定去留；`_probe_toast.js` 用途已完成可删。

## 三、开工清单（给下一个 AI）

1. 读 `AGENTS.md`，`cd app && git diff` 看本轮改动全貌。
2. 沙箱里构建/测试用逃生舱口：`git -C ../class-manager show HEAD:index.html > /tmp/_h.html && export CM_HEAD_FILE=/tmp/_h.html`；跑 Electron 先 `env -u ELECTRON_RUN_AS_NODE`（否则退化成纯 Node）。
3. 改 app.patch.js 记住 ③d 铁律：向导 foot 区按钮一律 `w.foot.querySelector`。
4. 版本位口径：**凡显示给用户的版本号一律桌面版号**（`deskVer`，build.js 统一注入）；baseWeb 只在关于卡括号里出现。

## 四、逐版史（摘要）

- **v1.0.0**（已发布）：Electron 壳 + 首启向导（密码可跳/零密码）+ 清空数据管理员闸 + 云同步 UI 裁剪 + 版权四处落地。
- **v1.0.1**（已发布）：P0 修复——向导首屏按钮死 + 换步遮罩堆叠；冒烟升级交互探针；落地页直链改英文资产名。
- **v1.0.2**（已发布，线上 Latest）：electron-updater 应用内更新 + NSIS 向导式安装 + 安装包名对齐 latest.yml + RELEASE.md 固化。
- **v1.0.11**（本地待发布）：落地页弹窗关闭修复 + 下载数徽标 + 双端「下次一定」。
- **v1.0.10**（已发布，线上 Latest）：赞赏双渠道（微信+支付宝）桌面版+落地页。
- **v1.0.9**（已发布，线上 Latest）：桌面版五连优化（速览移除/班级全称提示/更新自动装重启/新手示例体验/班委协作说明）。
- **v1.0.8**（已发布，线上 Latest）：更新源智能择优（镜像主源+官方兜底，修检查更新超时）。
- **v1.0.7**（已发布，线上 Latest）：启动背景换 AI 生成纸墨海报（A 稿全景山峦，B 稿 src/img/login-bg-b.jpg 一句话可换）+ 海报嵌入工作台（body soft-light 混合）+ 进入动画交叉淡化（工作台先渲染、遮罩回顶淡出，治导航帧卡）。
- **v1.0.6**：登录背景重设计 + 进入过渡动画 + 撤更新代理。
- **v1.0.5**：更新代理设置 + 冒烟隔离化。
- **v1.0.4**：零密码登录面板自包含样式修复（P0 hotfix）。
- **v1.0.3**：检查更新按钮放大并置于关于卡第一栏；版本号升 1.0.3。
- **v1.0.2.1 事故记录**：09:08 预览包与正式版同为 1.0.2 造成「假最新」——老板装了旧预览包，更新器说"已是最新"。教训：**预览包也必须用独立版本号**，杜绝同号覆盖。
- **本轮未提交**：更新交互改「弹窗询问、先问后下」+ toast CSS 补齐；老板反馈四连修复（按钮排版居中/版本号口径桌面版/设置页桌面化/关于卡重写）；CM_HEAD_FILE 逃生舱口；测试扩到 12 项。
