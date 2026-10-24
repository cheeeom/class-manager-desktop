# Microsoft Store 上架指南（班主任工作台桌面版）

> 2026-10-11 整理。政策口径：个人开发者注册已免费（2025-09 起，原 $19 已取消）；
> 非游戏应用允许**自建内购 0 抽成**——Pro 买断继续走现有激活码体系，微软不经手钱、不分成。

---

## 0. 上架前必须先解决的三件事

### 0.1 应用内更新器会跟商店自动更新打架（必改）
商店版由 Microsoft Store 自动更新，应用内 `__CM_UPDATER`（检查 GitHub Releases）必须自禁。
**Electron 有现成开关：MSIX 环境下 `process.windowsStore === true`**——
main.js 里更新检查入口加一句守卫即可，不用改 build.js：

```js
if (!process.windowsStore) { /* 现有更新检查逻辑 */ }
```

### 0.2 捐赠收款码（审核风险点，建议收敛）
应用里的支付宝/微信收款码属于"站外收款入口"。政策上非游戏应用允许外部购买，
但审核员看到裸收款码可能人工卡一次。建议：商店版保留但收纳进「关于/支持作者」页，
描述里写明「应用免费，Pro 功能通过开发者自有激活体系购买」。

### 0.3 版本与身份
- 上架分支版本号必须 **大于** GitHub 直装版已发过的任何版本（商店按版本号判更新）。
- `identityName` 只能字母数字加点（中文 productName「班主任工作台」不影响，两者分开）。

---

## 1. 注册开发者账户（免费，约 10 分钟）

1. 打开 `https://storedeveloper.microsoft.com` → 用微软账号登录（建议专门注册一个工作邮箱）。
2. 账户类型选 **个人（Individual）**——免费；公司账户要付费且要企业资质。
3. 身份验证：扫描身份证件 + 自拍，几分钟出结果，全程不需要信用卡。
4. ⚠️ **国家/地区 和 发布者显示名（Publisher Display Name）注册后不可改**：
   - 国家/地区：中国大陆；
   - 显示名：这是商店页上公示的开发者名（会显示"发布者：xxx"），建议直接用 `chee`。
5. 完成后进入 **Partner Center**（partner.microsoft.com/dashboard）。

> 不需要现在配置收款/税务——我们的模式微软不经手钱。以后若改用微软内购再补
> W-8BEN 表 + 银行账户（每月 15 日左右付款，达标才付）。

## 2. 预留应用名称（拿到两个关键字符串）✅ 已完成（2026-10-11）

产品名 **班主任工作台·班级管理** 已预留。Partner Center「产品标识」页给出的三元组
（**打包时原样使用，Publisher 一字不差**）：

| 字段 | 值 |
|---|---|
| **Package/Identity/Name** | `chee777.5391106D84753` |
| **Package/Identity/Publisher** | `CN=490FE7CA-7868-47E8-A72A-471E4DC9D956` |
| **Package/Properties/PublisherDisplayName** | `chee777` |

## 3. 本地打 MSIX 包

`app/package.json` 的 build 段加 msix target（与现有 nsis 并存，互不影响直装版）：

```json
"win": {
  "target": [
    { "target": "nsis", "arch": ["x64"] },
    { "target": "msix", "arch": ["x64"] }
  ],
  "icon": "icon/icon.png"
},
"msix": {
  "identityName": "chee777.5391106D84753",
  "publisher": "CN=490FE7CA-7868-47E8-A72A-471E4DC9D956",
  "publisherDisplayName": "chee777",
  "languages": ["zh-CN", "en-US"]
}
```

打包：`cd app && npm run dist`（electron-builder 25.x 会在 `out/` 产出 `.msix`；
若产出 `.msixupload` 一样能传，商店接受两种）。

**冒烟验收（照搬桌面版铁律）**：
- 本机装包冒烟需自签：`New-SelfSignedCertificate` 造证书导入「受信任人」后
  `Add-AppxPackage` 装 .msix；嫌麻烦可先跳过，以商店"认证测试"为准，但建议做。
- 装好后验证四件事：① `process.windowsStore` 下更新器**不**联网检查；
  ② `data.json` 读写正常（AppData\Roaming 照常可写，与直装版数据互通）；
  ③ Pro 激活码流程可用；④ 卸载后重装数据仍在。

## 4. Partner Center 填提交

第一次提交要填全，之后更新只传包+改版本说明：

1. **定价**：免费（Pro 是应用内买断，不影响商店定价）。
2. **类别**：`效率/Productivity` 或 `教育/Education`；子类别可选「教学工具」。
3. **年龄分级问卷**：全部答"否"（无暴力/赌博/社交等），自动评 3+ 或 PEGI 3。
4. **商店列表（Store listing）**：
   - 描述：从 README 改写，突出「班级管理 · 学分统计 · 班委协作 · 离线可用」；
   - **截图至少 1 张**（要求 ≥1366×768；用现有 `_shot` 截图链路拍首页/课表/学分页 3-5 张）；
   - 应用图标：MSIX 包内自带（icon/icon.png 生成）；
   - **隐私政策 URL（必填）**：网页版仓库放一页静态 HTML（如 `privacy.html`）走
     GitHub Pages，内容一句话「数据仅存本机/用户自有云盘，开发者不收集任何数据」；
   - 网站：`https://cheeeom.github.io/class-manager/`；支持联系方式：邮箱。
5. **提交选项**：可勾「发布保留（Publishing hold）」，过审后手动放行，防止措手不及。

## 5. 提交认证 → 上架

- 提交后进认证：安全测试（病毒/崩溃）+ 合规审查 + 发布前检查，**通常 1-3 天**，
  偶尔一周。被拒会给具体政策条款编号，改完重新提交即可（常见拒因见 0.2）。
- 过审后商店自动分发，用户在商店搜索或从网页版横幅/README 引导跳转
  `ms-windows-store://` 深链直达。
- **商店版自动更新**：以后发版只需 ①bump 版本号 → ②重新 `npm run dist` →
  ③Partner Center 新建提交传包。不用再管 GitHub Releases（那边照旧发直装版）。

## 6. 双轨分发对照表

| | GitHub 直装版（现状） | 微软商店版（新增） |
|---|---|---|
| 安装包 | NSIS Setup.exe | MSIX（商店重签） |
| 更新 | 应用内 __CM_UPDATER | 商店自动更新 |
| Pro 买断 | 激活码（爱发电） | **同一套激活码，0 抽成** |
| 数据 | AppData\Roaming | 同一路径，互通 |
| 版本要求 | — | 必须 ≥ 直装版最高版本 |

## 7. 风险与坑速记

- 🔴 **磁贴图默认图 = 认证拒批（10.1.1.11，2026-10-11 实际踩中）**：electron-builder 打 appx 时，
  磁贴图只认 **`{buildResources}/appx/`** 目录（本项目 = `app/icon/appx/`）；目录不存在会
  **静默落回 Electron 默认原子图标**（`SampleAppx.*.png`），审核必拒。已生成四张品牌图
  （StoreLogo 50² / Square44x44 44² / Square150x150 300²（2x）/ Wide310x150 620×300 朱砂底居中），
  源图 `app/icon/icon.png`（256²）。宽幅不能拉伸图标，用底色铺满 + 图标居中；底色取图标内部
  不透明像素（圆角外圈是透明的，采 (3,3) 会拿到透明）。修复后包：`out\班主任工作台 1.5.0.appx`
  （四图与源图逐字节一致已验收）。
- 🔴 **process.windowsStore 守卫漏写** → 商店版和商店更新打架，认证会被打回。（已做：`isStoreBuild`）
- 🔴 **Publisher 串复制不完整**（CN= 后那串 UUID 少一位）→ 上传包时身份不匹配直接拒收。
- 🔴 **商店版版本号 ≤ 直装版** → 商店判"已安装更高版本"，用户装不上。
- 🟡 Electron 33 / electron-builder 25 的 msix target 出包正常，但若报 icon 相关错，
  确认 `icon/icon.png` ≥ 512×512 正方形。
- 🟡 商店中国区上架的教育类工具无前置资质要求（不是 K12 学科培训内容），无 ICP 门槛。
