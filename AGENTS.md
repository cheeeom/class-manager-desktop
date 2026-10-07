# AGENTS.md — 班主任工作台 · 桌面版（class-manager-desktop）

> 知识入口。任何 AI 工具接手前先读本文件 + `PROGRESS.md`。网页版本体的知识库在 `…\workspace\default\class-manager\AGENTS.md`，两仓不要混。
> 基准：main `3ca16d4`（v1.0.2）· baseWeb v3.4.0 · 2026-10-07 校准。

## 1. 项目定位

网页版（单文件 SPA `index.html`，线上 v3.4.0）的 **Windows 桌面壳**：Electron 33 + electron-builder 25（NSIS 向导式安装）。卖点「数据全本地」：localStorage 存数据（`%APPDATA%\班主任工作台`），无服务器、无云同步 UI。
**核心设计铁律：线上网页版零改动。** 桌面层全部通过构建期补丁 + 运行时注入实现，根 `index.html`（网页版源文件）一个字节都不许动。

## 2. 目录地图

```
class-manager-desktop/            ← GitHub 仓（cheeeom/class-manager-desktop）
├─ index.html                     ← 落地页（GitHub Pages：cheeeom.github.io/class-manager-desktop/）
│                                    下载稳定直链 = releases/latest/download/ClassManager-Setup.exe（英文！GitHub 剥中文资产名）
├─ README.md                      ← 落地页美术方向与发布说明
├─ _fix_asset_name.js / _fix_asset_ascii.js   ← 落地页资产名修正脚本（一次性，已用完）
└─ app/                           ← Electron 应用源码（唯一功能改动区）
   ├─ main.js                     ← 主进程：BrowserWindow / 安全基线 / electron-updater 接线 / CM_SMOKE 冒烟
   ├─ preload.js                  ← 受控桥：__CM_DESKTOP（版本/版权）+ __CM_UPDATER（check/download/install/onEvent）
   ├─ src/app.patch.js            ← ★ 注入层（桌面版全部页面侧逻辑）：首启向导 6 步 / 零密码面板 /
   │                                清空数据管理员闸 / 云同步 UI 裁剪 / 安全设置卡 / 关于卡+更新弹窗
   ├─ src/wizard.css              ← 注入层样式（向导/模态/安全卡）
   ├─ build.js                    ← 构建脚本（见 §3）
   ├─ _v_desktop_test.js          ← 桌面断言 11 项（不进网页版 _runall，独立跑）
   ├─ _build_retry.js             ← electron-builder EBUSY 退避重试包装
   ├─ _npmrc_proxy_toggle.py      ← .npmrc 死代理开关（off=禁用代理构建，on=恢复）
   ├─ _probe_toast.js             ← 一次性探针（查 toast CSS，调试用，可删）
   ├─ _probe_settings.js          ← 视觉探针：隔离 userData 进设置页截图（含 toast 样品），发版前决定去留
   ├─ dist/                       ← build.js 产物：index.html（补丁后）+ app.patch.js + wizard.css + pdf 库
   ├─ out/                        ← 安装包产物（Setup.exe / latest.yml / win-unpacked / _smoke.png）
   ├─ icon/                       ← 应用图标
   └─ release/                    ← 旧输出目录（被系统句柄钉死已弃用，勿再用）
```

## 3. 构建机制（build.js 四步，理解这个就理解了整个项目）

1. **root 完整性闸**：读同级 `…\workspace\default\class-manager\index.html`，sha256 对比其 git HEAD——不一致直接 die（线上文件被改过就不许构建）。
2. **补丁表**：9 条 `(old, new, 期望次数)` 精确替换——禁 SW、去 manifest/apple-icon、**三处版本位换成桌面版版本号**（登录页 `.login-version` / 左下角 `.sidebar-footer` / 设置徽标，来源 `package.json.version`，变量 `deskVer`）、速览标题注明「网页版」、`</body>` 前注入 wizard.css + app.patch.js。**锚点次数失配即失败**（网页版改版后补丁表要跟着校准）。
3. **dist 断言**：标记齐全（wizard.css/app.patch.js/禁 SW/「桌面版」≥3）+ 不许残留 serviceWorker.register；顺带把 pdf.min.js/worker 从网页版仓复制过来。
4. **baseWeb 跟版**：`package.json.baseWeb` 自动写成网页版登录页版本串（现 v3.4.0）。

版本串规则：登录页显示 `v3.4.0 桌面版`（网页版版本 + 桌面壳版本解耦，**冒烟断言是逐字精确匹配** `'v' + app.getVersion() + ' 桌面版'`）。

## 4. 应用内更新链（v1.0.2 内置，正在改造中）

- 源 = GitHub Releases（`package.json.build.publish`）。electron-updater；开发模式（`electron .`）无 app-update.yml 自动跳过。
- **WIP 改造方向**（未提交）：`autoDownload` true→false，「自动后台下载」→「发现新版先弹左下角 toast 问用户（立即更新/暂不），选了才 `cm-upd-download`」，就绪后「重启安装/稍后」，会话内点过「暂不」不再自动弹。
- 发布三件套缺一不可（见 RELEASE.md）：①`class-manager-desktop-Setup-X.Y.Z.exe`（文件名必须与 latest.yml 的 url 逐字一致）②`latest.yml` ③`ClassManager-Setup.exe` 固定名副本（落地页直链）。
- 端到端验证需两个已发布版本：v1.0.2 发布后，下次 v1.0.3 装机实测全链。

## 5. 发版两段式（RELEASE.md 固化，必须遵守）

**本地预览审阅 → 老板明说「推送」→ 才发 GitHub Release。** 每次发版：
```
cd app
node build.js                # 构建产物
node _v_desktop_test.js      # 11 项断言全绿
python _npmrc_proxy_toggle.py off
node _build_retry.js         # 出安装包（EBUSY 自动退避）
python _npmrc_proxy_toggle.py on    # ⚠️ 完事必须 on，否则 .npmrc 留在无代理状态
set CM_SMOKE=1 && out\win-unpacked\班主任工作台.exe    # 冒烟：交互探针+console-error 计零+截图
```

## 6. 测试体系

- `node _v_desktop_test.js`（先 build.js）：护六层——①线上零改动（root sha256==HEAD 且不含桌面标记）②产物标记 + **三处版本位=桌面版版本号** ②b dist 与 src 一致 ③/③b/③c/③e 注入层契约（含 **③d 向导按钮绑定回归**：foot 区按钮一律 `w.foot.querySelector`；**③e 更新弹窗 + 按钮居中排版 + toast CSS**）④/④b 版权合规（`© 2026 chee` ≥4 处 + 署名声明）⑤主进程安全基线（`autoDownload = false` + `cm-upd-download` 通道）⑥更新链接线（先问后下）。
- `CM_SMOKE=1` 冒烟：5 秒后探针——desktopFlag/登录浮层/**版本标逐字 `'v' + app.getVersion() + ' 桌面版'`**、模拟点击「开始配置」必须翻到第 2 步、console-error 计零、截图存 `out/_smoke.png`。
- 视觉探针 `_probe_settings.js`：`env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_settings.js`（隔离 userData，拍设置页 + toast 样品）。
- 网页版自己的回归（`node _runall.js`）与桌面无关，别混跑。

## 7. 环境坑速查（都踩过）

- `.npmrc` 有死代理：构建走网前 `_npmrc_proxy_toggle.py off`，**完事必须 on**。
- EBUSY：`_build_retry.js` 自带退避；输出目录曾被系统句柄钉死 → 已从 release/ 迁到 out/（别迁回去）。
- **沙箱环境 Node 起不了子进程**：build.js/测试支持 `CM_HEAD_FILE` 逃生舱口（bash 预取 `git show HEAD:index.html` 写文件再指进去）；打包 `_build_retry.js` 无逃生口，须本机真环境跑。
- **`ELECTRON_RUN_AS_NODE` 陷阱**：AI 工具环境若设了它，electron.exe 退化成纯 Node（`--version` 打出 Node 版本号即中招）→ 跑冒烟/探针前先卸掉。
- cmd 内联多行 `node -e` 静默失败——一律写脚本文件。
- out/ 里同名多份 Setup.exe 是发版命名迭代的残留，认准 latest.yml 的 url 同名那份。
- electron-builder 无签名（未购买证书），SmartScreen 拦截属正常，quitAndInstall 静默参数一般不触发。

## 8. 已知问题与修复史

- **v1.0.1 P0（已修）**：向导首屏按钮无响应——按钮渲染在 foot 区却用 `w.body.querySelector` 绑定（绑定落在 null）；换步遮罩堆叠逐层变暗。修复后加 ③d 断言 + 冒烟交互探针，此类问题永久拦截。
- **GitHub Release 资产名剥中文（已绕）**：中文直链 404 → 稳定副本改英文名 `ClassManager-Setup.exe`，落地页两处直链已替换。
- **v1.0.2 安装包名对齐（已修）**：artifactName 从中文改名 `${name}-Setup-${version}`，使 latest.yml 的 url 诚实（更新器下载目标逐字一致，否则更新链断）。
- **版本号口径（2026-10-07 拍板）**：凡显示给用户的版本号一律**桌面版号**；网页版号只在关于卡「基于网页版 vX」括号与速览标题里出现。
- **设置页桌面化（2026-10-07）**：网页版「修改登录密码」「跨电脑使用指南」两区隐藏（改密统一走「🔐 安全（桌面版）」卡）；「登录密码仅限本机登录」桌面版隐藏；危险操作提示/关于卡介绍均为桌面版口径。
- 🔴 **更新 toast（已补完）**：`app.patch.js` 的 `cmUpdToast` 四态 + `wizard.css` 的 `.cmDeskUpdToast/.cmUpdBar` 样式成对出现，改任一侧必须同步另一侧。

## 9. 风格与约定

- 主进程/注入层注释齐全，每个区块 `/* ---------- N. 名称 ---------- */` 分节。
- 版权四处落地：package.json copyright / 向导首页 / 向导完成页+无密码面板 / 安全卡+关于卡；分发必须保留「© 2026 chee · 保留所有权利」+ 署名声明。
- UI 全走应用内 CSS 变量（`--card-bg/--border/--primary/--text…`），wizard.css 里每个变量都带纸墨风回退值。
- 安全基线不许放松：contextIsolation 开、nodeIntegration 关、外链 shell.openExternal、will-navigate 拦非 file://、禁 ServiceWorker（构建期桩掉 + session 双保险）。
