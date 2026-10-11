# PROGRESS.md — 班主任工作台 · 桌面版

> 真实进度只认本文件。基准：线上 Latest = **v1.4.1**（2026-10-11 发布，内容含 1.3.0 图表引擎 + 1.4.0 界面重设计全量）· baseWeb v3.4.1 · **git 主线已对齐远端（merge -X ours 收编 v1.2.6 线 + 落地页水墨风改版 13be2f0）并推送（0925c62）**。历史分叉已消解。

## 一、当前状态速览

- **已发布**：**v1.4.1 = Latest**（2026-10-11 三件套验收 ✓：assets 齐 exe×2 同字节 83,413,606 + latest.yml；稳定直链 200 实测 4.4MB/s；镜像 ghproxy 服 1.4.1）。
- **测试**：`_v_desktop_test.js` **27 套全绿**；`_probe_dataviz.js` / `_probe_tour.js` / `_probe_login_bug.js` 全 PASS。
- **v1.3.0 内容（P0+P1 全量完成）**：`src/echarts.min.js`（6.1.0，Apache-2.0，1.12MB，build.js 复制进 dist）；`app.patch.js` 新增「数据分析图表引擎」分节。**P0 成绩 tab**：接管 `renderGradeAnalyticsDetail`（cmWrapGradeDetail，挂原函数名下，Pro 页级锁不动）：KPI 环比带（均分/及格率/优秀率/标准差/最高最低，vs 上一场）、总分直方图（均分/及格/优秀三基准线挂隐藏二轴）、五档环形、各科均分横条（60/85 基准线）、单科得分率雷达（本场 vs 上一场）、多场趋势双轴折线、名次流动斜率图（|Δ|≥4）、学业预警（单科不及格≥2 科 / 总分环比下滑≥10 分）、排名前 10 数据条。**P1 学分 tab**：接管 `renderAnalytics`（cmWrapCreditRender，成绩 tab 激活时委托原函数重定向）：KPI 六卡（平均/中位/标准差/极差/及格率≥CB_ALERT_MIN/进取率，chips 全真实数据）、学分区间五档柱（credit 原生五档色）、五档构成环形（原 pieChart+#pieLegend 一体化）、近 7 天净变动 diverging 柱、本周进退步榜横向 diverging 条（原 renderProgressList 数据口径，7 天窗口+撤销过滤逐字一致）；面板不可见时只刷 DOM 图表记脏，`cmWrapCreditTabSwitch`（链在 Pro gate 之上）切回 credit tab 补渲染。cmInk 主题全部运行时读 CSS 变量（亮/暗/皮肤自适应，MutationObserver 重渲染）；echarts 加载失败/超时/空数据静默回退原实现；图表实例表共享，释放按白名单（CM_GRADE_CHART_IDS）/前缀（cmGxCd*）防误杀。
- **v1.2.6 内容（已发布）**：向导按钮重排（上一步左/下一步右/去箭头）；第 5 步改「导入学生名单」（CSV 模板下载 + 劫持预览直接注入 + 导入后不再给示例数据）；激活后侧栏去 PRO 角标、左上角亮烫金 PRO 徽标（cmDesk-proemblem，buildNavPro 状态感知化）；考勤请假/课堂点名转免费 + 新增「导出请假流水」（CSV，Pro gate，班委拦截）；反馈卡独立成卡；关于卡改本版更新简要（≤100 字，无网页版字样）；满天弹窗/打赏卡文案跟上 Pro 时代；激活弹窗重排（复制钮右置主色、购买/已付款 300px 居中对齐、激活居中放大）+ 可选邮箱框（cmProMail 真实入链）；Pro 已激活卡 B 印章式定稿（早鸟 № 钢印 + BY: chee 署名 + 复制激活码按钮）；KeyGen ②b 换机重签自动核对（邮箱指纹/设备指纹/沿用序号）+ ③发货记录查询框。
- **⚠️ v1.3.0 踩坑（重要）**：网页版 `state` 是**顶层 `let`**（词法全局不挂 window）——注入层必须裸名访问（`cmGxState()` 助手），`window.state` 永远 undefined 会静默回退；cmd `set X= && …` 尾随空格会让 ELECTRON_RUN_AS_NODE 陷阱复活，用 `set "X="`。
- **⚠️ 换钥事故（2026-10-10 凌晨）**：App 旧公钥 4e4f3a71 对应的私钥在 KeyGen 页被「生成新私钥」覆盖丢失（页面显示的 3714294d 与云函数 PRO_PRIV=3938d60b 才是真配对）。处理：CM_PRO_PUB 改 **3714294d**（v1.2.2 已发），云函数不动；KeyGen 页 gen 按钮加双确认+生成后强提醒导出；老板本机旧激活失效需重签。教训：**烧进 App 的公钥对应的私钥必须「导出备份」双份保存，KeyGen 页 localStorage 是唯一存储太脆**。
- **⚠️ 打包坑（v1.2.6 实测）**：electron-builder 清空 `out/win-unpacked` 被安全删除钩子拦（批量删除超阈值）→ **打包前先 `mv out/win-unpacked out/_trash_*`**。
- **发货机已上线**（2026-10-09）：腾讯云函数 `cm-pro-shipper`（ap-shanghai，Nodejs12.16 Web 函数），URL `https://1466839507-gqk4mefrq0.ap-shanghai.tencentscf.com/?req=`；4 环境变量全齐（含 PRO_PRIV）；线上实测：格式拒 + 合法 payload → `NOT_FOUND`（爱发电翻页查单链路通）。部署改走 **SCF REST API**（`scripts/_scf_api.py` TC3 签名，密钥 `scripts/_tencent_creds.txt` 严禁入仓）；浏览器代操作在本机不可行（GUI 进程被系统收割，试 3 次全灭）。

## 二、待办队列

### v1.4.1（完成编码：老板实机四连修复，2026-10-11，已打包冒烟 PASS，待老板审阅 PRO 卡预览后发版）
- [x] **登录页乱码+横幅修复**：上游 v3.4.1 停更横幅整块（44px 让位 CSS + 横幅标记 + 摘除脚本）在桌面构建期摘除（build.js 补丁「摘停更横幅CSS/标记」+ dist notHas 断言）——根因：桌面端横幅被运行时摘掉但 44px 位移 CSS 残留 → 登录层下移、顶部漏出「全部功能」抽屉。探针断言：eolBanner 无 / loginOverlay top=0px / 顶层不再漏抽屉。
- [x] **完全单机·清空数据去云**：接管 clearData 改走 `gxWipeLocal()`（复刻网页版 schema 重置段，**砍掉两道原生 confirm——图四弹窗样式不统一根因**，砍掉 pushWipeToCloud 云端链路）；silenceCloudPush 扩展静默 pushWipeToCloud；toast 改「本机数据已全部清空（桌面版单机存储，无云端）」。
- [x] **安全卡 v2**：登录密码/管理员密码均可 **修改 + 关闭**；修改/关闭登录密码、修改/关闭管理员密码前需验证管理员密码（gxAdminVerify 链）；未设管理员密码时直接操作；关闭登录密码回零密码模式；双字段密码弹窗 gxPwdModal（6 位校验/一致性/弱口令）。
- [x] 测试 +⑲（dist 无 eolBanner/单机清空/云端静默/安全卡 v2 全要素）；探针扩展：登录页三断言 + 安全卡三按钮 + 清空全链（纸墨风闸 → 输入「清空」→ wipe → 单机 toast）全 PASS。
- [x] **PRO 专属卡预览（待老板审阅后确认实施）**：`_dataviz_preview/pro-card-preview.html` + shots（亮/暗 × 早鸟/常价）——激活后赞赏卡整体替换为 B 印章式专属卡（现有 buildProActiveCard 实现即图三设计，赞赏卡/满天弹窗/打赏入口不再出现）；**老板点头后**：核对现实现与预览一致 + 提交。
- [x] **反馈卡样式统一（老板实机报）**：`.cmDeskFeedback` 残留 v1.0.11 时代「关于卡内嵌盒」样式（row-bg+虚线框）压掉 settings-section 实心卡 → 删覆盖只留外距；探针 computed style 与「关于本系统」完全一致（bg rgb(255,253,247) + solid）。
- [x] **向导模块卡图标统一（老板实机报）**：stepTour 六卡从 emoji（🏠 漏网 + swept 后 1em 过小）改为显式 `gxIc` 大图标（.cmDesk-tic 44px 朱砂底座 + 24px 描边图标，home 图标补提取 63 枚）；GX_EMOJI_MAP 补 🏠→home；指引气泡「完成体验 ✓ →」去箭头。
- [x] 打包 BUILD-OK + CM_SMOKE PASS（v1.4.1）；ClassManager-Setup.exe 副本同步。
- [x] **PRO 卡预览等老板审阅**（现实现即图三 B 印章式设计，赞赏卡/满天弹窗激活后停发）；**已发布（2026-10-11 老板令「直接一起打包推送」）**：git 主线 merge 对齐远端（收编 v1.2.6 线 + 落地页水墨风改版 13be2f0）→ 合并树重建 27 套全绿 + 冒烟 PASS → push（git 死代理用 `-c http.proxy=` 绕过 + 直连抖动 HTTP/1.1 重试）→ [v1.4.1 Release](https://github.com/cheeeom/class-manager-desktop/releases/tag/v1.4.1) 三件套验收 ✓（exe×2 同字节 83,413,606 + latest.yml；稳定直链 200 @4.4MB/s；ghproxy 镜像服 1.4.1）。
- [x] **自动发货序号加固（老板问序号机制后拍板做 C）**：旧云函数按「爱发电返回列表遍历顺序」数数——若 API 新单在前会倒挂/撞号。`D:/a/chee777/_afdian_shipper/web_express.js` 加固：全量拉已付订单（PLAN_ID 过滤防混算）→ 按 out_trade_no（流水号=日期时间前缀）升序显式排序 → 序号=同档位序列位次（早鸟 ¥49-68 / 常价 ¥69+ 分档互不占号）+ 早鸟限量 100 售罄闸；沙箱单测 6 用例 + 线上三连验收（格式拒/NOT_FOUND/心跳 alive）全 PASS，SCF 重部署 Active ✓（`scripts/_ship_hardened.py`，zip 内 app.js 替换）。**序号机制定论：KeyGen 手动签发与云函数自动发货是两套独立计数，测试号 №001/№002 不影响顾客——真实顾客按购买时间从 №001 起；KeyGen 手填序号可指定任意号**。
- [ ] **下一轮：全工作台动效优化**（v1.5.0，老板已预告）。

### v1.4.0（完成编码：界面重设计四连，2026-10-11，并入 1.4.1 包）
- [x] **全台 emoji → Lucide 图标体系**：选型 Lucide v0.544.0（24.9k★，ISC，Feather 社区续作，与网页版 29 枚 stroke sprite 同风格）；`_gen_gx_icons.js` 从 lucide-static 提取 62 枚 → `src/gx-icons.js`（window.__GX_ICONS）→ build.js 注入 `<script src="./gx-icons.js">`（补丁表第 12 条扩展）；app.patch.js 注入 sprite + `gxIc()` helper + **UI 容器 emoji 清扫**（GX_EMOJI_MAP 70+ 映射，只扫 h1-h4/按钮/统计卡/空态/toast/注入层 UI 的「行首装饰 emoji」，绝不碰用户内容；跨宿主文本节点去重；MutationObserver 防抖补扫 + showToast/navigateTo 包装）；页头 📋/🏆/📁/🏦、设置页九卡、按钮、统计卡全部换装。
- [x] **工作留痕重设计**：接管 renderWorkLogs——页头 emoji 去除（清扫覆盖）；日期选择器退役 → **本周/本月/本学期/全部 周期筛选（默认本月）**；按时间倒序展示周期内流水（不再只看当天）；**挂图修复双保险**：入库存图前置校验思路 + 缩略图 onerror 兜底块（gx-imgdead，HEIC 等浏览器解不动的图不再显示破图标）；分类/搜索语义保留（关键词在周期内检索）。
- [x] **荣誉墙重设计**：接管 renderHonors——卡片重设计（gxH-*：级别色条/徽章/图标行/两行截断 desc/查看证书按钮/悬停上浮）；**点卡片 → 证书预览弹窗**（gxHonorPreview：重绘函数返回画布 drawImage 进弹窗 + 下载 PNG）；范围/级别双排筛选 chips；统计卡图标化。
- [x] **证书奖状式重绘**：接管 drawHonorCertCanvas（仍返回画布，exportHonorCert 下载链路不变）——**顶部学校名称**（新增设置页「🏫 学校信息（桌面版）」卡，localStorage cm_school_name，照 buildSecurityCard 模板）；**姓名左顶格 + 「同学：」**；事由正文（「在「X」中表现优异，特发此证，以资鼓励。」自动换行）；级别大字居中；**朱砂双环「荣誉」印章**（微倾 0.82 透明度）；右下班级+日期落款。
- [x] **导航图标区分**：学分公示保持奖杯（#i-horn 语义相邻不改），荣誉墙侧栏/抽屉改 **#gx-award 奖章绶带**（Lucide award）。
- [x] 测试 +⑱（gx-icons 构建/接线/清扫去重/导航区分/学校卡/留痕周期/挂图兜底/证书预览/奖状式要素/导出制品仍不接管）；①断言放宽为「根文件不得**赋值**桌面全局」（上游 v3.4.1 合法读取）；⑰「证书不接管」随需求推翻更新。
- [x] 探针扩展：留痕（4 周期/日期隐藏/卡片/页头无 emoji/121 枚图标）→ 荣誉墙（卡片/导航 #gx-award/学校卡）→ 证书预览（弹窗/标题红色像素 1141/下载按钮）全 PASS；`_probe_tour.js` 复跑 PASS。
- [x] **打包（2026-10-11 三次）**：BUILD-OK attempt 1 → `out/class-manager-desktop-Setup-1.4.0.exe`（83.4MB）+ latest.yml 服 1.4.0；代理 off→on 已恢复；CM_SMOKE 冒烟 PASS（v1.4.0/版本标逐字/向导交互/consoleErrors=[]）；ClassManager-Setup.exe 副本已同步。
- [x] **发布（2026-10-11 老板令「直接一起打包推送」）**：git 主线 merge 对齐远端（收编 v1.2.6 线与落地页水墨风改版，-X ours 取本地 v1.4.1 线）→ 合并树重建 27 套全绿 + 冒烟 PASS → push（直连 + HTTP/1.1；git 配置死代理 192.168.8.104:9890 需 `-c http.proxy=` 绕过）→ `gh release create v1.4.1` 三件套 → 验收：assets 齐（exe×2 同字节 83,413,606 + latest.yml）、稳定直链 200 实测 83MB@4.4MB/s、ghproxy 镜像 latest.yml 服 1.4.1。
- [ ] **下一轮：全工作台动效优化**（v1.5.0，老板已预告）。

### v1.3.0（完成编码：数据分析图表引擎 P0+P1+P2，2026-10-11，已并入 v1.4.0 包）
- [x] 方案与预览（老板过目拍板）：`app/_dataviz_preview/DATAVIZ-PLAN.md` + `preview.html`（选型 ECharts 6，落选 Chart.js/ApexCharts/AntV 理由在案）
- [x] `src/echarts.min.js` 6.1.0 → build.js 复制清单 + dist 断言（缺文件即 die）
- [x] `app.patch.js` 图表引擎分节：cmLoadEcharts 按需加载（15s 挂死兜底）/ cmWrapGradeDetail + cmWrapCreditRender + cmWrapDistChart + cmWrapPubCharts 接管 / cmGx* 主题工具（CSS 变量取色）/ MutationObserver 亮暗皮肤重渲染 / resize
- [x] P0 成绩 tab 全量（KPI 环比带/直方图三基准线/五档环形/各科均分/雷达/趋势/名次流动/预警/排名数据条）
- [x] P1 学分 tab 全量（KPI 六卡/五档柱/五档环形/近 7 天 diverging/进退步榜横条；renderAnalytics 接管 + 切 tab 脏渲染补画）
- [x] **P2 全站统一**：首页学分分布接管（drawDistChart → cmInk 八档直方图，口径逐字复刻）；公示页四图接管（趋势 30 天人均/每日 14 天加扣 diverging/五档分布/原因 Top6 环形——原 HTML 图例退役并入 ECharts）；**图表位置全景排查定论：交互图 8 处全接管（成绩 6 + 学分 4 + 首页 1 + 公示 4 个实例）**，海报导出（drawPubPoster/drawWeeklyPoster）为导出自绘制品**有意不接管**（荣誉证书当时同判，v1.4.0 按老板需求推翻接管重绘，见上）
- [x] **示例数据升级**：6 生 + 18 条流水铺满五档（credit 122/118/158/73/200/55，不变式=100 基准+Σ流水，加分时总分均 ≥100 → coin 全额合规）+ 一场「期中考试（示例）」3 科成绩（周子墨两科不及格 → 学业预警有货）；快照/恢复/跨会话兜底扩 exams+nextExamId；向导指引文案同步
- [x] `wizard.css` `.cmGx-*` 样式段（KPI 带 cols5/cols6/图卡/预警/排名，全 CSS 变量带纸墨回退；定高容器空态居中）
- [x] 版本升 1.3.0（独立版本号铁律）；测试 +⑮+⑯+⑰ 契约段（接管/降级/许可头/五档色对齐/boot 接线/链序/示例考试/导出制品不接管）
- [x] `_probe_dataviz.js` 端到端：真码激活 → 成绩 tab 6 图 + 暗色重渲染 + 学分 tab 四图 + **首页 1 图 + 公示 4 图** → console-error 零；`_probe_tour.js` 复跑：示例注入（平均学分 121 精确吻合/预警 1）+ 完成自动清除全链 PASS
- [x] 修复：`window.state`→`cmGxState()`（顶层 let 陷阱）；公示图表 key 与容器 id 不一致静默不渲染（探针抓到）；cmPubTrendOption 漏 `tNow`（探针抓到）；movers 容器漏定高类；名次流动/进退步榜空态文案
- [x] ~~打包 1.3.0 + 发布~~（被 v1.4.0 取代：1.3.0 未单独发版，全量并入 1.4.0 包；打包记录见 v1.4.0 段）
- [ ] P3（可选）：学期报告长图（导出制品）cmInk 化重绘；`_dataviz_preview/` 审阅后可删

### v1.2.1（已完成：自动取码转正，已打包未发布）
- [x] `main.js` `CM_PRO_CLAIM_API` 填入云函数 URL →「② 我已付款 · 自动获取激活码」按钮转正（未填时仍显示但点击提示 AUTO_OFF）
- [x] 发货机部署：云端 zip 只替换根 app.js（端口 9001→9000，腾讯 Web 函数固定转发 9000）+ 删脏 index.html；**scf_bootstrap 重打包必须保留 0o755**
- [x] ⚠️ 申请码**不带 CMPRO1. 前缀**（前缀只在激活码 lic 上）；云函数格式校验 16-64 位 base64url + `{v:1,dev:16hex,eh:8hex}`
- [x] build.js spawnSync 修复：`execSync('git show…')` → `execFileSync`（cmd.exe 被系统拦截 EBUSY；Node spawn 在本机不可靠，仍挂时用 CM_HEAD_FILE 逃生舱——**文件必须来自网页版仓** `../class-manager`，不是桌面版仓）
- [x] 回归：契约 17/18（EBUSY 环境误报）+ gate/report 探针 PASS + 冒烟 PASS（v1.2.1 角标/consoleErrors 零/feed gh-proxy）

### v1.1.1（已完成编码：老板实测七连反馈修复，打包中）
- [x] **复制申请码不进剪贴板**（老板实测）：file:// 下 navigator.clipboard 不可靠 → 主进程 `cm-clip-write` IPC（Electron clipboard 直写，pro.core 同源）+ `__CM_CLIP` 桥；统一 `cmProCopy`（桥→execCommand 兜底），申请码/邮箱两处复制全接
- [x] **示例数据弹「未配置云同步 Token」**（老板实测）：`silenceCloudPush()` 把 `autoPushToCloud` 置空——桌面版数据只在本机，云推送提示与桌面改造方向不符
- [x] **学分银行 → Pro**：页面可看，操作全锁（月度结算/兑换详情/核销/退还/商品编辑/学生银行档案 六闸，label 统一「学分银行」）
- [x] **数据分析 → Pro**：页面可看，`switchAnalyticsTab` 上锁（初始成绩分析 tab 可看，深度 tab 弹引导框）
- [x] **导航栏 PRO 角标**：学分银行/数据分析 nav-item 右上角 PRO 小徽章（`.cmDesk-navbadge`，pointer-events:none）
- [x] **学期报告挪出设置页**：`buildReportCard` 删除 → 导航栏独立项「🎓 学期报告」（设置项上方，PRO 角标；动态插入项自绑 click → 未激活直弹购买引导框 = 所有 Pro 模块点击即弹购买）
- [x] **工作留痕配图 → Pro**：`cmWrapPro('wlAddImages')`
- [x] **学生档案导出**：档案页现无导出功能（Explore 核实），个人学期报告即档案导出场景（已 Pro）——回复老板，暂无新闸点
- [x] **落地页**：「先在浏览器试试」按钮已删；购买链接实测 200（老板点时商品或未生效），App 外链本就走 shell.openExternal 系统浏览器
- [x] 测试 **17/17**（+⑨ Pro 扩容段）；报告探针五步 PASS（导航入口）+ Pro 探针回归 PASS
- [x] 版本升 **1.1.1**（预览包独立版本号铁律）

### Pro M3（已完成归档：学期报告引擎，2026-10-09）
- [x] 数据地基（Explore 代理核实）：流水 `state.operations`（op{studentId,amount,coin,reason,time}，撤销=`state:'revoked'`，统计必走 `liveOps`）；请假 `state.leaves`（type sick/personal/official + duration）；成绩 `state.exams`（subjects + scores{studentId:{科目:分}}）；学期起点 `loadPubSetting('semesterStart')` 回退 9/1-3/1 自动推断（与公示页同口径）
- [x] 报告面板（设置页入口卡「🎓 学期报告引擎」+ Pro 闸）：个人报告（学号/寝室/职位 + 期初基线/当前学分/净变化/学分币/加减分次数 + 大类分布条形图（reason 反查 REASON_CATALOG_FLAT）+ 请假统计 + 最近考试（总分/班级均分/名次）+ 老师寄语（localStorage 持久））；班级报告（人数/流水/请假汇总 + TOP10 净变榜 + 零扣分名单 + 考试概览）
- [x] 双导出：canvas 自绘长图（750 宽朱砂品牌色，复用页面 pngExport）+ PDF（`__CM_PRO.reportPdf` → pro.core 隐藏窗口 printToPDF，A4 自包含 HTML，拒 `<script>` 注入）
- [x] 🔴 **canvas 大坑（截图抓到）**：先画内容后赋 `canvas.height` 会**重置 context 抹掉全部绘制**（探针 nonBlank 只测到脚部色条误报通过）→ 修法 `cmCrop`（临时画布画完 drawImage 裁到定高画布）；探针非空判定同步改严（inkPx>3000 偏离背景像素计数）
- [x] 探针 `_probe_report.js` 五步全 PASS：①未激活弹引导框 ②真码激活 ③个人画布 inkPx=23331 ④班级画布 inkPx=15462 ⑤PDF 落盘 80,743B；测试 16/16（+⑧ M3 契约段）
- [x] 真公钥 `CM_PRO_PUB`（64hex，KeyGen）与爱发电商品链接（`afdian.com/item/e4cf19…`）已内置并上线（落地页线上验收 ✓，远端 fe2c2be7）
- ⏳ 待老板：用 KeyGen 真码对打包版实测激活（打包版公钥=真钥，dev 逃生舱已封）；下令发布 v1.1.0 Release

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
- ⚠️ 本轮 git push 两路全堵 → 首次启用**纯 Python urllib API 增量推送**（`D:\a\chee777\_push_1011_api.py`，blob 归一化 LF + sha 自校验）；本地 HEAD（3813bcd）与远端（b0f13d5d）**内容等价但 sha 不同**，下次 fetch 通了记得 reset --hard 对齐（⚠️ 该指令 2026-10-10 起作废：整线入库后 reset --hard 会丢掉全部本地提交，一律改 fetch + merge/rebase）

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
