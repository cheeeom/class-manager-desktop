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
gh release create vX.Y.Z "out\ClassManager-Setup.exe#ClassManager-Setup.exe（Windows 64位）" \
  --repo cheeeom/class-manager-desktop --title "班主任工作台 桌面版 vX.Y.Z" --notes "…"
```
   （可选暂存：加 `--draft` 先建草稿，老板点头后 `gh release edit vX.Y.Z --draft=false` 发布。）
3. 资产名**固定 `ClassManager-Setup.exe` 不带版本号**（落地页 latest 直链永久有效；GitHub 会剥离资产名里的中文）。
4. 跟版：`app/package.json` 的 version 与 `build.js` 自动写入的 baseWeb；落地页需要改版时单独提交 index.html。

## 环境坑速查
- npm/构建走网络前：`_npmrc_proxy_toggle.py off` → 完事 **必须 on**（用户 .npmrc 有死代理，备份同名 .bak）。
- registry 用官方 `https://registry.npmmirror.com` 超时就直连 `https://registry.npmjs.org`。
- EBUSY：`_build_retry.js` 自带清理+退避；旧 release 路径被系统句柄钉死时换输出目录（现为 `out/`）。
- cmd 内联多行 node -e 会静默失败——一律写脚本文件。

## 待拍板：应用内自动更新（electron-updater）
解决"每次更新重新下载 78MB"：应用内「检查更新」→ 后台差量/全量下载 → 重启安装；GitHub Releases 作源免费。
代价：需要真实发两个版本才能端到端验证（vNext 发布后，vNext+1 验证更新链）；未签名应用更新时 SmartScreen 会闪一次。
