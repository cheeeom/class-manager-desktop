# PROGRESS.md — 班主任工作台 · 桌面版

> 真实进度只认本文件。基准：main `522e3bf`+（**v1.0.2 已发布至 GitHub Releases**，线上 Latest）· baseWeb v3.4.0 · 2026-10-07 09:50。

## 一、当前状态速览

- **线上 Release**：**v1.0.2 = Latest**（三件套齐：Setup exe ×2 + latest.yml，冒烟 PASS 后发布）；v1.0.1、v1.0.0 在档。
- **测试**：`_v_desktop_test.js` **12/12 全绿**；`CM_SMOKE=1` 冒烟 **PASS**（版本标 v1.0.2 桌面版逐字对上、向导交互翻步、console-error 计零）；设置页 + toast 视觉截图复核通过（`out/_smoke.png`、`out/_probe_settings.png`）。
- **本轮已完成（老板反馈四连）**：①向导/模态按钮文字居中 + 箭头钉右缘（根因：应用 `.btn` 无 `justify-content:center`）②三处版本位全部改用**桌面版版本号**（登录页/左下角侧栏/设置徽标 = v1.0.2，速览标题注明「网页版」口径）③设置页桌面化：网页版「修改登录密码」「跨电脑使用指南」两区隐藏（改密统一走「🔐 安全（桌面版）」卡）、「登录密码仅限本机登录」双保险隐藏、危险操作提示改桌面口径 ④关于本系统重写：桌面版徽标 + 单机版介绍卡（含自动更新说明）。
- **更新弹窗（上轮 WIP，本轮补完）**：发现新版左下角弹窗询问（立即更新/暂不）→ 下载进度条 → 就绪提示；**toast CSS 本轮补齐**（上轮只有 JS）。

## 二、待办队列

### P0
- [x] 补更新 toast 的 CSS（wizard.css：定位左下角/卡片风/进度条/四态）
- [x] 测试锚点跟随（checkNow(false)）+ 新增 12 项断言（版本位/弹窗/按钮排版/设置页桌面化）
- [x] 重建 + 12/12 + 冒烟 PASS + 截图人工复核
- [x] 提交（`65fdce0`，含 `_probe_toast.js` 清理；推送待老板指令）

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
- **本轮未提交**：更新交互改「弹窗询问、先问后下」+ toast CSS 补齐；老板反馈四连修复（按钮排版居中/版本号口径桌面版/设置页桌面化/关于卡重写）；CM_HEAD_FILE 逃生舱口；测试扩到 12 项。
