# 桌面版发版流程（v1.0.2 起固化：本地预览审阅 → 老板说推送 → 才上线上）

## 前置（一次）
- 本机两个仓库必须并排放：`…\workspace\default\class-manager`（网页版）与 `…\workspace\default\class-manager-desktop`（桌面版）。
- `app/node_modules` 已装；`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` 已预置。

## 每次发版
```
cd app
node build.js                # 从同级 class-manager 仓读线上 index.html → 注入 → dist（自动校验 root sha）
node _v_desktop_test.js      # 桌面断言（含 root 零改动、向导按钮绑定回归）
python _npmrc_proxy_toggle.py off
node _build_retry.js         # 出安装包 → out/ClassManager-Setup.exe（EBUSY 自动退避重试）
python _npmrc_proxy_toggle.py on
set CM_SMOKE=1 && out\win-unpacked\班主任工作台.exe   # 冒烟：交互探针（必须翻到第 2 步）+ console-error 计零
```

## 审阅 → 推送（两段式）
1. **本地预览**：把 `out\ClassManager-Setup.exe` 直接发给老板（或让他本机跑上面命令），覆盖安装审阅——数据保留。
2. **老板说「推送」后**才执行：
```
gh release create vX.Y.Z "out\class-manager-desktop-Setup-X.Y.Z.exe" "out\latest.yml" "out\ClassManager-Setup.exe#ClassManager-Setup.exe（Windows 64位，稳定链接副本）" \
  --repo cheeeom/class-manager-desktop --title "班主任工作台 桌面版 vX.Y.Z" --notes "…"
```
   ⚠️ **三件套缺一不可**：①`class-manager-desktop-Setup-X.Y.Z.exe`（electron-updater 的下载目标，文件名必须与 latest.yml 的 url 逐字一致）；②`latest.yml`（更新器靠它发现版本与校验和）；③`ClassManager-Setup.exe` 稳定链接副本（落地页 latest 直链指向它；GitHub 会剥离资产名里的中文，故用英文）。
   构建后把 `class-manager-desktop-Setup-X.Y.Z.exe` 复制一份改名为 `ClassManager-Setup.exe` 再一起上传（同一文件、两份拷贝）。
   （可选暂存：加 `--draft` 先建草稿，老板点头后 `gh release edit vX.Y.Z --draft=false` 发布。）
   **应用内更新链**：v1.0.2 起内置 electron-updater（启动静默检查 + 关于卡手动检查，后台下载，重启安装/退出自装）。
   端到端验证需要两个已发布版本：发布 vX.Y.Z 后，下次 vX.Y.Z+1 装机即可验证「检查→下载→重启安装」全链。
3. 落地页稳定直链指向**固定名副本** `ClassManager-Setup.exe`（不带版本号 → latest 链接永久有效）。
4. 跟版：`app/package.json` 的 version 与 `build.js` 自动写入的 baseWeb；落地页需要改版时单独提交 index.html。

## 环境坑速查
- npm/构建走网络前：`_npmrc_proxy_toggle.py off` → 完事 **必须 on**（用户 .npmrc 有死代理，备份同名 .bak）。
- registry 用官方 `https://registry.npmmirror.com` 超时就直连 `https://registry.npmjs.org`。
- EBUSY：`_build_retry.js` 自带清理+退避；旧 release 路径被系统句柄钉死时换输出目录（现为 `out/`）。
- cmd 内联多行 node -e 会静默失败——一律写脚本文件。

## 应用内自动更新（v1.0.2 起内置，老板已拍板）
electron-updater + GitHub Releases 作源：启动 30 秒后静默检查一次 + 设置→关于「🔄 检查更新」手动检查；发现新版后台下载，下载完提示「重启应用即完成安装」（或正常退出时自动装）。未签名应用：更新下载完成后 quitAndInstall 走静默参数，一般不再触发 SmartScreen；若遇拦截属正常。
**端到端验证**：需要两个已发布版本——v1.0.2 发布后，下一次发版（v1.0.3）装机即可实测「检查→下载→重启安装」全链。国内网络下载 github 资产偏慢属现状；后续可加蓝奏云镜像（见分发方案记忆）。
