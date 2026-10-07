# PROGRESS.md — 班主任工作台 · 桌面版

> 真实进度只认本文件。基准：线上 Latest = **v1.0.8**（2026-10-07 15:40 发布，三件套+镜像更新链验收）· baseWeb v3.4.0 · 2026-10-07 11:50。

## 一、当前状态速览

- **线上 Release**：**v1.0.2 = Latest**（三件套齐：Setup exe ×2 + latest.yml，冒烟 PASS 后发布）；v1.0.1、v1.0.0 在档。
- **测试**：`_v_desktop_test.js` **12/12 全绿**；`CM_SMOKE=1` 冒烟 **PASS**（版本标 v1.0.2 桌面版逐字对上、向导交互翻步、console-error 计零）；设置页 + toast 视觉截图复核通过（`out/_smoke.png`、`out/_probe_settings.png`）。
- **本轮已完成（老板反馈四连）**：①向导/模态按钮文字居中 + 箭头钉右缘（根因：应用 `.btn` 无 `justify-content:center`）②三处版本位全部改用**桌面版版本号**（登录页/左下角侧栏/设置徽标 = v1.0.2，速览标题注明「网页版」口径）③设置页桌面化：网页版「修改登录密码」「跨电脑使用指南」两区隐藏（改密统一走「🔐 安全（桌面版）」卡）、「登录密码仅限本机登录」双保险隐藏、危险操作提示改桌面口径 ④关于本系统重写：桌面版徽标 + 单机版介绍卡（含自动更新说明）。
- **更新弹窗（上轮 WIP，本轮补完）**：发现新版左下角弹窗询问（立即更新/暂不）→ 下载进度条 → 就绪提示；**toast CSS 本轮补齐**（上轮只有 JS）。

## 二、待办队列

### P0（v1.0.8 待发布）
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
- **v1.0.8**（已发布，线上 Latest）：更新源智能择优（镜像主源+官方兜底，修检查更新超时）。
- **v1.0.7**（已发布，线上 Latest）：启动背景换 AI 生成纸墨海报（A 稿全景山峦，B 稿 src/img/login-bg-b.jpg 一句话可换）+ 海报嵌入工作台（body soft-light 混合）+ 进入动画交叉淡化（工作台先渲染、遮罩回顶淡出，治导航帧卡）。
- **v1.0.6**：登录背景重设计 + 进入过渡动画 + 撤更新代理。
- **v1.0.5**：更新代理设置 + 冒烟隔离化。
- **v1.0.4**：零密码登录面板自包含样式修复（P0 hotfix）。
- **v1.0.3**：检查更新按钮放大并置于关于卡第一栏；版本号升 1.0.3。
- **v1.0.2.1 事故记录**：09:08 预览包与正式版同为 1.0.2 造成「假最新」——老板装了旧预览包，更新器说"已是最新"。教训：**预览包也必须用独立版本号**，杜绝同号覆盖。
- **本轮未提交**：更新交互改「弹窗询问、先问后下」+ toast CSS 补齐；老板反馈四连修复（按钮排版居中/版本号口径桌面版/设置页桌面化/关于卡重写）；CM_HEAD_FILE 逃生舱口；测试扩到 12 项。
