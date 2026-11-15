# AGENTS.md — 班主任工作台 · 桌面版（class-manager-desktop）

> 知识入口。任何 AI 工具接手前先读本文件 + `PROGRESS.md`。网页版本体的知识库在 `…\workspace\default\class-manager\AGENTS.md`，两仓不要混。
> 基准：main `8abfe52`（v1.7.8）· baseWeb `v3.9.23` · 2026-11-15 校准。
>
> ⚠️ **本文件里的版本号、套数、条数都是「当前状态值」，会随发版腐烂。** 发现对不上时以这些权威源为准，别信正文：
> 桌面版号 → `app/package.json` 的 `version`；跟版号 → 同文件的 `baseWeb`；网页版号 → 网页版仓 `sw.js` 的 `CACHE_NAME`；测试套数 → `node _v_desktop_test.js` 末行「结果：N 通过」；补丁条数 → `build.js` 的 `const patches = [` 数组。

## 1. 项目定位

网页版（单文件 SPA `index.html`，线上 v3.9.23）的 **Windows 桌面壳**：Electron 33 + electron-builder 25（NSIS 向导式安装）。卖点「数据全本地」：localStorage 存数据（`%APPDATA%\班主任工作台`），无服务器、无云同步 UI。
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
   │                                清空数据管理员闸 / 云同步 UI 裁剪 / 安全设置卡 / 关于卡+更新弹窗 /
   │                                数据分析图表引擎（v1.3.0：接管成绩 tab，cmInk 主题，ECharts 6）
   ├─ src/echarts.min.js          ← ECharts 6.1.0（Apache-2.0，1.12MB；build.js 复制进 dist，按需加载）
   ├─ src/wizard.css              ← 注入层样式（向导/模态/安全卡）
   ├─ build.js                    ← 构建脚本（见 §3）
   ├─ _v_desktop_test.js          ← 桌面断言 28 套（不进网页版 _runall，独立跑）
   ├─ _build_retry.js             ← electron-builder EBUSY 退避重试包装
   ├─ _npmrc_proxy_toggle.py      ← .npmrc 死代理开关（off=禁用代理构建，on=恢复）
   ├─ _probe_toast.js             ← 一次性探针（查 toast CSS，调试用，可删）
   ├─ _probe_settings.js          ← 视觉探针：隔离 userData 进设置页截图（含 toast 样品），发版前决定去留
   ├─ _archive/                   ← 已退役的一次性脚本，仅追溯用，**别跑**
   │                                （_port_to_web.py = 图表/学期报告引擎从桌面注入层移植进网页版，使命已完成）
   ├─ dist/                       ← build.js 产物：index.html（补丁后）+ app.patch.js + wizard.css + pdf 库
   ├─ out/                        ← 安装包产物（Setup.exe / latest.yml / win-unpacked / _smoke.png）
   ├─ icon/                       ← 应用图标
   └─ release/                    ← 旧输出目录（被系统句柄钉死已弃用，勿再用）
```

## 3. 构建机制（build.js 四步，理解这个就理解了整个项目）

1. **root 完整性闸**：读同级 `…\workspace\default\class-manager\index.html`，sha256 对比其 git HEAD——不一致直接 die（线上文件被改过就不许构建）。
2. **补丁表**：**15 条** `(old, new, 期望次数)` 精确替换（当版实测 13 条生效 + 2 条「摘停更横幅」因上游已无此内容自动跳过）——禁 SW、去 manifest/apple-icon、**三处版本位换成桌面版版本号**（登录页 `.login-version` / 左下角 `.sidebar-footer` / 设置徽标，来源 `package.json.version`，变量 `deskVer`）、速览标题注明「网页版」、`</body>` 前注入 wizard.css + app.patch.js。**锚点次数失配即失败**（网页版改版后补丁表要跟着校准）。
3. **dist 产物与断言**：dist 复制清单 = `app.patch.js / wizard.css / ed25519.cjs / pro.core.cjs / echarts.min.js / gx-icons.js`（六个，缺失即 die）+ 登录背景/打赏码（可选）+ pdf 库（从网页版仓复制）；标记断言（wizard.css/app.patch.js/禁 SW/「桌面版」≥3/echarts.min.js 存在）+ 不许残留 serviceWorker.register。
4. **baseWeb 跟版**：`package.json.baseWeb` 自动写成网页版登录页版本串（现 v3.9.23）。

版本串规则：登录页显示的是**桌面版号**，当版为 `v1.7.8 桌面版`（网页版版本与桌面壳版本解耦，**冒烟断言是逐字精确匹配** `'v' + app.getVersion() + ' 桌面版'`，写错号必红）。

## 4. 应用内更新链（v1.0.2 内置，先问后下已落地）

- 源 = GitHub Releases（`package.json.build.publish`）。electron-updater；开发模式（`electron .`）无 app-update.yml 自动跳过。
- **先问后下（已落地）**：`autoDownload = false`；「自动后台下载」改为「发现新版先弹左下角 toast 问用户（立即更新 / 暂不）」，选了才走 `cm-upd-download`，就绪后「重启安装 / 稍后」，会话内点过「暂不」不再自动弹。契约由测试 ⑤⑥ 与 `cmUpdToast` 四态共同钉住（见 §8 末条）。
- 发布三件套缺一不可（发版流程见 §5）：①`class-manager-desktop-Setup-X.Y.Z.exe`（文件名必须与 latest.yml 的 url 逐字一致）②`latest.yml` ③`ClassManager-Setup.exe` 固定名副本（落地页直链）。
- 端到端验证需两个已发布版本：v1.0.2 发布后，下次 v1.0.3 装机实测全链。

## 5. 发版两段式（本节即正式流程，必须遵守）

**本地预览审阅 → 老板明说「推送」→ 才发 GitHub Release。** 每次发版：
```
cd app
node build.js                # 构建产物
node _v_desktop_test.js      # 28 套断言全绿
python _npmrc_proxy_toggle.py off
node _build_retry.js         # 出安装包（EBUSY 自动退避）
python _npmrc_proxy_toggle.py on    # ⚠️ 完事必须 on，否则 .npmrc 留在无代理状态
set "ELECTRON_RUN_AS_NODE=" && set CM_SMOKE=1 && D:\_cm_build\win-unpacked\班主任工作台.exe    # 冒烟：交互探针+console-error 计零+截图（先清 ELECTRON_RUN_AS_NODE，见 §7）
```

## 6. 测试体系

- `node _v_desktop_test.js`（先 build.js）：**28 套**——①线上零改动（root sha256==HEAD 且不含桌面标记）②产物标记 + **三处版本位=桌面版版本号** ②b dist 与 src 一致 ③/③b/③c/③e 注入层契约（含 **③d 向导按钮绑定回归**：foot 区按钮一律 `w.foot.querySelector`；**③e 更新弹窗 + 按钮居中排版 + toast CSS**；**③f 示例体验 + 设置页再裁剪**（v1.0.9）；**③g 反馈卡邮件直达**（v1.0.11））④/④b 版权合规（`© 2026 chee` ≥4 处 + 署名声明）⑤主进程安全基线（`autoDownload = false` + `cm-upd-download` 通道）⑥更新链接线（先问后下）⑦ Pro 买断体系（v1.1.0）**M3 学期报告引擎契约** ⑨⑩⑪⑫⑬ Pro 扩容与导航栏 Pro 化 / 页面级 Pro 锁 / 激活心跳与退款上锁 / 开发者模式 / 开发者密钥门槛 ⑭ v1.2.6 七件套 **⑮ 图表引擎契约**（echarts 许可头/接管+降级回退/CSS 变量取色/五档色对齐/boot 接线/版本 1.3.0）**⑯ 学分 tab 迁移契约**（renderAnalytics 接管/切 tab 补渲染/credit 口径/实例表白名单释放/链序）**⑰ 首页/公示统一 + 示例考试契约**（drawDistChart 接管/四图接管/导出制品不接管/示例考试快照与兜底清除）**⑱ v1.4.0 界面符号统一 + 留痕/荣誉墙重设计**（emoji→Lucide 清扫、周期筛选、证书预览、奖状式重绘）**⑲ v1.4.1 横幅摘除 + 单机清空 + 安全卡 v2** **⑳ v1.5.0 动效系统**。
- `CM_SMOKE=1` 冒烟：5 秒后探针——desktopFlag/登录浮层/**版本标逐字 `'v' + app.getVersion() + ' 桌面版'`**、模拟点击「开始配置」必须翻到第 2 步、console-error 计零、截图存 `out/_smoke.png`。
- `_probe_dataviz.js`（v1.3.0）：图表引擎端到端——一次性密钥真码激活 → 注入 45 生 3 考试 → 成绩 tab 断言接管/6 图实例/KPI/无旧 CSS 图残留 → 暗色重渲染 → 切考试斜率图 live → console-error 零（跑前 `set "ELECTRON_RUN_AS_NODE="`）。
- 视觉探针 `_probe_settings.js`：`env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe _probe_settings.js`（隔离 userData，拍设置页 + toast 样品）。
- 网页版自己的回归（`node _runall.js`）与桌面无关，别混跑。

## 7. 环境坑速查（都踩过）

- `.npmrc` 有死代理：构建走网前 `_npmrc_proxy_toggle.py off`，**完事必须 on**。
- EBUSY：`_build_retry.js` 自带退避；输出目录曾被系统句柄钉死 → 已从 release/ 迁到 out/（别迁回去）。
- 🔴 **沙箱批量删除保护会卡死打包**（2026-11-15 实测）：electron-builder 打 NSIS 前要清 `D:\_cm_build\win-unpacked`（79 个 locales 文件），超过沙箱阈值 50 ⇒ `SAFE_DELETE_BULK_CONFIRM_REQUIRED`；`_build_retry.js` 的 EBUSY 退避对它**无效**，5 次 attempt 全废。**解法 = 把旧 `win-unpacked` 整体改名挪走**（如 `win-unpacked.bak-v178`），让 builder 重建空目录，下次 attempt 1 即 OK（约 43s）。**别删那 79 个文件去迎合它。**
- 🔴 **发版工具坑**（2026-11-15）：`gh release create` 在非 git 目录（`D:\_cm_build`）执行报 `fatal: not a git repository` ⇒ 必须加 `-R cheeeom/class-manager-desktop`；本机 curl 直连 GitHub 一律 HTTP 000（环境代理，`--noproxy '*'` 同样不通）⇒ 线上资产校验改走 `gh api .../releases/assets/<id> -H 'Accept: application/octet-stream'`。
- 🔴 **`git fetch` 判定绝不接管道**：`if git fetch … | tail -1; then reset …` 会把退出码吞成 0、条件恒真，fetch 失败后照样 `reset --soft` ⇒ **HEAD 倒退、文件变 staged**（2026-11-15 亲踩）。正确写法：`if git -c http.proxy= -c https.proxy= fetch origin main > /tmp/f.log 2>&1; then …`。
- **沙箱环境 Node 起不了子进程**：build.js/测试支持 `CM_HEAD_FILE` 逃生舱口（bash 预取 `git show HEAD:index.html` 写文件再指进去）；打包 `_build_retry.js` 无逃生口，须本机真环境跑。
- **`ELECTRON_RUN_AS_NODE` 陷阱**：AI 工具环境若设了它，electron.exe 退化成纯 Node（`--version` 打出 Node 版本号即中招）→ 跑冒烟/探针前先卸掉。
- cmd 内联多行 `node -e` 静默失败——一律写脚本文件。
- **cmd `set X= && …` 陷阱**：`=` 后的空格会存成值（变量仍生效）——清环境变量必须 `set "X="`（v1.3.0 探针实测 ELECTRON_RUN_AS_NODE 复活）。
- **网页版 `state` 是顶层 `let`**（词法全局，不挂 window）——注入层/探针访问数据必须裸名 `state`（v1.3.0 有 `cmGxState()` 助手），`window.state` 永远 undefined 且**静默回退不报错**（探针抓到）。
- **隐藏窗口（show:false）截图可能拿到陈旧合成帧**——探针里状态切换后多等一会或先触发一次 class 变化再 capturePage，断言一律以 executeJavaScript 读 DOM 为准。
- out/ 里同名多份 Setup.exe 是发版命名迭代的残留，认准 latest.yml 的 url 同名那份。
- electron-builder 无签名（未购买证书），SmartScreen 拦截属正常，quitAndInstall 静默参数一般不触发。

## 8. 已知问题与修复史

- **v1.4.1（编码完成，未发布）**：老板实机四连修复——①**登录页乱码+横幅**：上游 v3.4.1 停更横幅整块（44px 让位 CSS+标记+摘除脚本）在桌面构建期摘除（build.js「摘停更横幅CSS/标记」+ dist notHas eolBanner）——根因是 44px 位移 CSS 残留让登录层下移漏出「全部功能」抽屉；②**完全单机清空**：clearData 闸改走 `gxWipeLocal()`（复刻网页版 schema 重置，砍两道原生 confirm——图四弹窗根因，砍 pushWipeToCloud），silenceCloudPush 扩展静默 pushWipeToCloud；③**安全卡 v2**：登录/管理员密码均可修改+关闭，涉及登录密码与关闭操作需 gxAdminVerify 管理员授权链，双字段弹窗 gxPwdModal，关闭登录密码回零密码模式（lsDel K_LOGIN+lsSet LS_NOPWD）；④PRO 专属卡（B 印章式，已实现）预览待审：`_dataviz_preview/pro-card-preview.html`。
- **v1.4.0（编码完成，未发布，并入 1.4.1 包）**：界面重设计四连——①**全台 emoji → Lucide 图标**（v0.544.0，ISC；`src/gx-icons.js` = window.__GX_ICONS，构建期 `_gen_gx_icons.js` 从 lucide-static 提取 62 枚，build.js 补丁表第 12 条扩为注入 `<script src="./gx-icons.js">`；app.patch.js gxInjectSprite/gxIc/GX_EMOJI_MAP + **UI 容器行首装饰 emoji 清扫**（GX_SWEEP_SEL 白名单容器，绝不碰用户内容，跨宿主文本节点 Set 去重，MutationObserver 防抖 + showToast/navigateTo 包装））②工作留痕：接管 renderWorkLogs，日期选择器退役 → 周期筛选（本周/本月/本学期/全部，**默认本月**），时间倒序流水，挂图 onerror 兜底（gx-imgdead）③荣誉墙：接管 renderHonors，卡片重设计 + **点卡片出证书预览弹窗**（gxHonorPreview：drawHonorCertCanvas 返回画布 drawImage 进弹窗——**重绘函数自建画布、不直接画弹窗 canvas，这是踩过的坑**）④证书奖状式重绘：接管 drawHonorCertCanvas（仍返回画布），顶部学校名称（设置页 cmDeskSchool 卡，localStorage `cm_school_name`）+ 姓名左顶格「同学：」+ 朱砂双环「荣誉」印章 + 右下落款；**导航图标区分**：荣誉墙侧栏/抽屉改 `#gx-award`（Lucide award），学分公示保持奖杯。**导出制品铁律更新：海报/周报仍不接管，荣誉证书 v1.4.0 起按老板需求接管重绘**。**上游 v3.4.1**：网页版「停更公告」横幅合法**读取** __CM_DESKTOP 桌面端自动摘除——测试 ① 断言收紧为「根文件不得**赋值**桌面全局」。
- **v1.3.0（编码完成，未发布，并入 1.4.0 包）**：数据分析图表引擎——**全站交互图表统一 cmInk（ECharts 6）**：成绩 tab 接管 `renderGradeAnalyticsDetail`、学分 tab 接管 `renderAnalytics`（成绩激活时委托原函数重定向）、首页接管 `drawDistChart`、公示页接管 drawPubTrend/Daily/Dist/Reason 四图（canvas 原地隐藏 + `cmGxSwapCanvas` 等尺寸 div 顶替）。铁律维持：接管全挂原函数名下，Pro 页级锁不动；echarts 加载失败/超时/空数据静默回退原实现。**图表实例表共享（cmGradeCharts），释放按白名单 CM_GRADE_CHART_IDS / 前缀 cmGxCd\*——重渲染一方不许误杀另一方**；**公示图表实例 key=容器 id（`pubTrendChart__gx` 等）**；学分面板不可见时图表记脏，`cmWrapCreditTabSwitch`（链在 Pro gate 之上）切回补渲染。**导出制品（drawPubPoster/drawWeeklyPoster）有意不接管**（荣誉证书 v1.4.0 起接管，见上）。学分口径：`Number(s.credit)` 规范化、及格线读 `CB_ALERT_MIN`、流水过滤 `state==='revoked'`、7 天窗口。示例数据（v1.3.0）：6 生 + 18 流水铺五档 + 一场期中考试（快照/兜底清除均含 exams+nextExamId，示例 id 全落 990001–990999）。
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
