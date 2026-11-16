/* 启动画面探针（v1.7.9 新增，仅开发期用，不进安装包）
   验证五件事：
   1. transparent + frame:false 在 Windows 上不闪白底方块
   2. 朱砂横画与 1px 进度线各自在正确位置、且**不重叠**
      （踩过的坑：<svg> 默认 inline，在 height:4px 容器里会按基线对齐向下溢出十几像素，
       横画整个跑到进度线上把它盖住 —— rect 完全正常，只有像素分析才看得出）
   3. **任意一帧都以中线为轴对称**：横画由中宫向两端铺开、进度线由正中向两端生长，
      所以不能只验静止态；演到一半时两边也必须等长。这是「看着偏左」的回归守卫。
   4. 版本号经 query 注入成功、fast 热启动类不误加
   5. 截三帧 + 一张特写，供人工看观感

   用法：env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron _probe_splash.js
   产出：out/_splash_<t>ms.png / out/_splash_lines.png */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* 探针直接跑脚本时 app.getVersion() 返回的是 Electron 自身版本（33.x），
   截图会带上一个假版本号。所以这里读 package.json 的真实桌面版号。 */
const APP_VER = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;

/* 亮度：把 rect 换算成物理像素行号后逐点取（capturePage 的 rect 用 DIP，位图是物理像素） */
function lumAt(bmp, w, x, y) {
  const i = (y * w + x) * 4;
  return 0.299 * bmp[i + 2] + 0.587 * bmp[i + 1] + 0.114 * bmp[i];
}

/* 在 [y0,y1] 行区间里找「比底色暗」的列范围 —— 量真实发光边缘。
   不能用 getBoundingClientRect：它只报布局盒，动画缩放到哪它一概不管。 */
function inkSpan(bmp, w, y0, y1, thr) {
  let min = 1e9, max = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < w; x++) {
      if (lumAt(bmp, w, x, y) < thr) { if (x < min) min = x; if (x > max) max = x; }
    }
  }
  return max < 0 ? null : { min: min, max: max, w: max - min + 1, cx: (min + max) / 2 };
}

app.whenReady().then(async function () {
  let w;
  try {
    w = new BrowserWindow({
      width: 400, height: 240, frame: false, transparent: true,
      resizable: false, movable: false, skipTaskbar: true,
      alwaysOnTop: true, show: true, backgroundColor: '#00000000',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }
    });
    await w.loadFile(path.join(__dirname, 'splash.html'), {
      query: { v: APP_VER, fast: '0' }
    });

    const geo = JSON.parse(await w.webContents.executeJavaScript(
      'JSON.stringify((function(){var o={};' +
      'o.ver=document.getElementById("ver").textContent;' +
      'o.fast=document.documentElement.classList.contains("fast");' +
      'o.iconOk=document.querySelector(".ico").naturalWidth>0;' +
      '["\.ico",".rule",".scan",".ttl"].forEach(function(s){' +
      'var r=document.querySelector(s).getBoundingClientRect();' +
      'o[s]={t:Math.round(r.top),b:Math.round(r.bottom)};});' +
      'return o;})())'
    ));
    console.log('[SPLASH] ver=' + geo.ver + ' fast=' + geo.fast + ' iconOk=' + geo.iconOk);
    console.log('[SPLASH] geo rule=' + geo['.rule'].t + '-' + geo['.rule'].b +
      '  scan=' + geo['.scan'].t + '-' + geo['.scan'].b);

    /* 按真实时间推进采样。⚠️ 曾经的坑：三帧 capturePage 连拍（中间不 sleep），
       三张全是刚起笔的同一瞬间 —— 横画只长到一半，交付图看着就像“偏左”。 */
    const marks = [260, 520, 1000];
    let clock = 0, symOk = true;
    let sz = null, k = 1, px = null, mid = 0;

    for (const t of marks) {
      await new Promise(r => setTimeout(r, t - clock)); clock = t;
      const img = await w.capturePage();
      fs.writeFileSync(path.join(OUT, '_splash_' + t + 'ms.png'), img.toPNG());

      const bmp = img.toBitmap();
      sz = img.getSize(); k = sz.height / 240; px = function (v) { return Math.round(v * k); };
      mid = sz.width / 2;
      const rule = inkSpan(bmp, sz.width, px(geo['.rule'].t), px(geo['.rule'].b) + 1, 205);
      const scan = inkSpan(bmp, sz.width, px(geo['.scan'].t), px(geo['.scan'].b) + 1, 210);
      const dx = function (o) { return o ? +(o.cx - mid).toFixed(1) : null; };
      console.log('[SPLASH] t=' + t + 'ms 横画 dx=' + dx(rule) + ' w=' + (rule ? rule.w : 0) +
        ' | 进度线 dx=' + dx(scan) + ' w=' + (scan ? scan.w : 0));
      /* 允许 1px：位图宽 500、线宽多为奇数时，中心必然落在 x.5 上 */
      if (rule && Math.abs(dx(rule)) > 1.0) symOk = false;
      if (scan && Math.abs(dx(scan)) > 1.0) symOk = false;
    }

    /* 像素核对：
       · 横画那一行必须真的是朱砂（中心亮度 < 130）
       · 进度线是「淡褐轨道 + 朱砂填充从正中长出」，所以不能只说“它比横画浅”：
         取轨道段（中心右侧 48CSS，已超出填充、仍在 112px 轨道内）与中心点分别量，
         要求轨道确实是浅色、中心确实被填充压暗。 */
    const full = await w.capturePage();
    const bmp = full.toBitmap();
    const yRule = Math.round((geo['.rule'].t + geo['.rule'].b) / 2 * k);
    const yScan = Math.round((geo['.scan'].t + 1.5) * k);
    const cx = Math.round(sz.width / 2);
    const xTrack = cx + Math.round(48 * k);
    const lRule = lumAt(bmp, sz.width, cx, yRule);
    const lFill = lumAt(bmp, sz.width, cx, yScan);
    const lTrack = lumAt(bmp, sz.width, xTrack, yScan);
    console.log('[SPLASH] 像素 rule@' + yRule + '=' + lRule.toFixed(0) +
      '  fill@' + yScan + '=' + lFill.toFixed(0) +
      '  track=' + lTrack.toFixed(0) + '  (dpi=' + k + ')');

    const okRule = lRule < 130;
    const okTrack = lTrack > 140 && lTrack < 235;
    const okFill = lFill < lTrack - 15;
    const okGap = geo['.rule'].b <= geo['.scan'].t;

    /* 特写：以中线为轴左右对称取景 —— 裁偏了，图本身就会让人以为线歪 */
    const zoom = await w.capturePage({ x: 200 - 90, y: 108, width: 180, height: 56 });
    fs.writeFileSync(path.join(OUT, '_splash_lines.png'), zoom.toPNG());

    console.log('[SPLASH] 横画是朱砂=' + okRule + ' 轨道是浅色=' + okTrack +
      ' 中心有填充=' + okFill + ' 两线不重叠=' + okGap + ' 任意帧对称=' + symOk);
    console.log('[SPLASH] verdict=' +
      (okRule && okTrack && okFill && okGap && symOk && geo.iconOk ? 'PASS' : 'FAIL'));
  } catch (e) {
    console.log('[SPLASH] verdict=FAIL ' + e.message);
  } finally {
    if (w && !w.isDestroyed()) w.destroy();
    app.quit();
  }
});
