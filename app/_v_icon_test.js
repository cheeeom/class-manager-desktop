/* A 款「朱砂 C 标」图标资产静态验收（v1.7.4 起）
 *
 * 只认磁盘上的字节事实，不认「生成器说它跑过了」：
 *   · 九个尺寸各自成图、带 alpha 且四角真透（白底烤死是历史坑）
 *   · icon.ico 内九条 PNG 与 icon-png/*.png 逐字节同源 —— 防「拿 256 缩」回潮
 *   · appx 磁贴尺寸与铺底（微软商店认证曾因默认图被拒）
 *   · 打包配置三处指向 ICO、商店线显式回退 PNG、主进程不碰 ICO
 *
 * 跑法：node _v_icon_test.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HERE = __dirname;
const ICON = path.join(HERE, 'icon');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
};

const read = (rel) => fs.existsSync(path.join(ICON, rel)) ? fs.readFileSync(path.join(ICON, rel)) : null;

function pngInfo(buf) {
  // PNG 签名是 8 字节（89504e470d0a1a0a）；只比前 4 字节会把每张真图判成「缺失」，
  // 而 ICO 同源断言仍全绿 —— 判据自相矛盾时先怀疑判据，别去动资产。
  if (!buf || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    colorType: buf[25], // IHDR 数据起点 16：宽4+高4 后是位深(1)+颜色类型(1)
    buf
  };
}

/** 只解第一行扫描线，取左上/右上 alpha（首行反滤波不依赖前一行） */
function cornerAlpha(buf, w) {
  // Chromium 对整张不透明的截图会省掉 alpha 通道（colortype=2，RGB 三字节/像素）。
  // 这时若还按 RGBA 步进解首行，会把 RGB 字节错位读成 alpha（实测假值 1/157）。
  // 无 alpha 通道本身就证明底板铺满，直接返回全不透明。
  const colorType = buf[25];
  if (colorType === 2) return [255, 255];
  if (colorType !== 6) return [null, null];
  const idat = [];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    if (buf.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const f = raw[0];
  const row = Buffer.from(raw.subarray(1, 1 + stride));
  for (let x = 4; x < stride; x++) {
    const a = row[x - 4];
    if (f === 1) row[x] = (row[x] + a) & 255;
    else if (f === 3) row[x] = (row[x] + (a >> 1)) & 255;
    else if (f === 4) row[x] = (row[x] + a) & 255;
  }
  return [row[3], row[stride - 1]];
}

/** ICO 目录解析；返回 null 表示结构不合法 */
function checkIco(buf) {
  if (!buf || buf.length < 22) return null;
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const n = buf.readUInt16LE(4);
  if (n !== SIZES.length) return null;
  const entries = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    const size = buf[o] || 256;
    const len = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    const data = buf.subarray(off, off + len);
    if (data.subarray(0, 4).toString('hex') !== '89504e47') return null;
    entries.push({ size, len, data, bpp: buf.readUInt16LE(o + 6) });
  }
  return entries;
}

console.log('\n=== A 款图标资产验收（app/icon） ===');

/* 1. 主图 */
const main = pngInfo(read('icon.png'));
ok(!!main && main.w === 512 && main.h === 512, 'icon.png 为 512² 正方形（商店要求 ≥512）',
  main ? `${main.w}x${main.h}` : '缺失');
ok(!!main && main.colorType === 6, 'icon.png 带真 alpha 通道',
  main ? 'colortype=' + main.colorType : '缺失');
if (main) {
  const [tl, tr] = cornerAlpha(main.buf, main.w);
  ok(tl <= 8 && tr <= 8, 'icon.png 圆角四角透明（没被烤成白底）', `${tl}/${tr}`);
}

/* 2. 九尺寸逐张 */
for (const s of SIZES) {
  const p = pngInfo(read(`icon-png/${s}.png`));
  ok(!!p && p.w === s && p.h === s, `icon-png/${s}.png 尺寸 ${s}²`,
    p ? `${p.w}x${p.h}` : '缺失');
  if (!p) continue;
  ok(p.colorType === 6, `icon-png/${s}.png 带 alpha`, 'colortype=' + p.colorType);
  const [tl, tr] = cornerAlpha(p.buf, p.w);
  ok(tl <= 8 && tr <= 8, `icon-png/${s}.png 四角透明`, `${tl}/${tr}`);
}
ok(fs.existsSync(path.join(ICON, 'icon-png')) &&
   fs.readdirSync(path.join(ICON, 'icon-png')).length === 9,
  'icon-png/ 恰好九个尺寸（没有多余缩放图）');

/* 3. ICO：结构 + 逐字节同源 */
const icoBuf = read('icon.ico');
const entries = checkIco(icoBuf);
ok(!!entries, 'icon.ico 结构合法（type=1 / 9 条目 / 全 PNG）');
if (entries) {
  ok(entries.every((e) => e.bpp === 32), 'icon.ico 全部 32bpp');
  ok(entries.map((e) => e.size).join('/') === SIZES.join('/'),
    'icon.ico 尺寸序列 16/20/24/32/40/48/64/128/256', entries.map((e) => e.size).join('/'));
  let same = 0;
  for (const e of entries) {
    const f = read(`icon-png/${e.size}.png`);
    if (f && Buffer.compare(f, e.data) === 0) same++;
  }
  ok(same === 9, 'icon.ico 九张 PNG 与 icon-png/ 逐字节一致（九尺寸各渲一遍，不是缩放）', same + '/9');
  ok((entries.find((e) => e.size === 256) || {}).len > 8000, 'icon.ico 的 256 版不是空白占位');
  ok(icoBuf.length > 32 * 1024, 'icon.ico 有分量（>32KB）', (icoBuf.length / 1024).toFixed(1) + 'KB');
}

/* 4. 判据自证伪：坏 ICO 必须被咬住 */
ok(checkIco(Buffer.alloc(0)) === null, '证伪：空文件不能算合格 ICO');
if (icoBuf) {
  const broken = Buffer.from(icoBuf);
  broken.writeUInt16LE(8, 4); // 谎报 8 条目
  ok(checkIco(broken) === null, '证伪：少一个尺寸的 ICO 必须失败');
}

/* 5. favicon / 商店素材 / appx 磁贴 */
const fav = read('favicon.png');
const p32 = read('icon-png/32.png');
ok(!!fav && !!p32 && Buffer.compare(fav, p32) === 0, 'favicon.png 与 32² 同源');
for (const [rel, w, h] of [
  ['appx/StoreLogo.png', 50, 50],
  ['appx/Square44x44Logo.png', 44, 44],
  ['appx/Square150x150Logo.png', 300, 300],
  ['appx/Wide310x150Logo.png', 620, 300],
  ['store/StoreIcon-150x150.png', 150, 150],
  ['store/StoreIcon-71x71.png', 71, 71]
]) {
  const p = pngInfo(read(rel));
  ok(!!p && p.w === w && p.h === h, `${rel} = ${w}×${h}`, p ? `${p.w}x${p.h}` : '缺失');
}
const wide = pngInfo(read('appx/Wide310x150Logo.png'));
if (wide) {
  const [tl, tr] = cornerAlpha(wide.buf, wide.w);
  ok(wide.colorType === 2 || (tl > 200 && tr > 200),
    '宽幅磁贴底板铺满（无透明角，绝不拉伸图标）',
    `colortype=${wide.colorType} 四角=${tl}/${tr}`);
}

/* 6. 打包配置指向 */
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
ok(pkg.build.win.icon === 'icon/icon.ico', 'package.json win.icon → icon.ico（exe / 快捷方式）', pkg.build.win.icon);
const nsis = pkg.build.nsis || {};
ok(['installerIcon', 'uninstallerIcon', 'installerHeaderIcon']
  .every((k) => nsis[k] === 'icon/icon.ico'),
'nsis 安装向导/卸载器/页眉三处显式指向 icon.ico（防默认原子标）');
ok((pkg.build.files || []).includes('icon/**'), 'build.files 含 icon/**（九尺寸进包）');

const store = fs.readFileSync(path.join(HERE, 'store.config.js'), 'utf8');
ok(/icon:\s*'icon\/icon\.png'/.test(store), '商店线显式回退 icon.png（appx 不吃 ico）');
const mainJs = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8');
ok(/icon:\s*path\.join\(__dirname,\s*'icon',\s*'icon\.png'\)/.test(mainJs),
  'main.js 窗口图标仍读 PNG（nativeImage 认图片文件，ICO 交给 electron-builder）');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} 项通过，${fail} 项失败\n`);
process.exitCode = fail === 0 ? 0 : 1;
