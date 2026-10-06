# 班主任工作台 · 桌面版落地页

线上地址：https://cheeeom.github.io/class-manager-desktop/

单文件 `index.html`，零依赖、零网络字体（与应用同款系统字体栈），可直接作为 GitHub Pages 站点发布。

## 美术方向

「纸墨·新中式 × 国际极简版式」——配色与字体完整继承应用内设计系统（AGENTS.md 9.5）：

| 令牌 | 值 | 用途 |
|---|---|---|
| 宣纸 `#F6F2E9` | 页面底色 | 配纤维细纹 |
| 纸白 `#FFFDF7` | 浅色面板 | |
| 浓墨 `#2B2B33` | 正文 | 宋体标题 + 黑体正文 |
| 朱砂 `#A63A2B` | 主色 | 按钮 / 印章 / 印章点 |
| 玄墨 `#191613` | 唯一深色区 | 「数据本地」宣言 + 下载区 |

签名元素：朱砂「班」字印章（SVG symbol）、旋转 45° 印章点、旋转「印」字落款、竖排校训、窗棂纹。

## 发布步骤

1. 新建仓库 `class-manager-desktop`（桌面版安装包也将发在它的 Releases），把本文件夹整个推上去，`index.html` 在仓库根目录即可。
2. 仓库 Settings → Pages → Branch: `main` + `/ (root)` → Save。
3. 访问 `https://cheeeom.github.io/class-manager-desktop/`。

下载链接使用稳定地址（永远指向最新 Release 附件）：

```
https://github.com/cheeeom/class-manager-desktop/releases/latest/download/班主任工作台-Setup.exe
```

**配套要求**：electron-builder 的 `artifactName` 固定为 `班主任工作台-Setup.exe`（不带版本号），否则该链接在下次发版后会失效。

## 待替换项

- 仓库名若不叫 `class-manager-desktop`：全局替换该字符串。
- 页脚「独立开发，免费分享」可换成真实署名。
- 功能描述按桌面版实际模块微调。
