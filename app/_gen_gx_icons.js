/* 一次性工具：从 lucide-static 包提取所需图标 → 生成 gx-icons.json（app/src/）
   用法：node _gen_gx_icons.js <lucide-icons-dir>
   产物：src/gx-icons.json = { "图标名": "<path .../> <circle .../>", ... }（内部 markup，不含 svg 根） */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('用法: node _gen_gx_icons.js <lucide-icons-dir>'); process.exit(1); }

const NAMES = [
  'clipboard-list', 'trophy', 'medal', 'award', 'landmark', 'graduation-cap', 'sparkles',
  'triangle-alert', 'crown', 'users', 'circle-check', 'trending-up', 'star', 'calendar',
  'search', 'image', 'file-text', 'save', 'folder-open', 'refresh-cw', 'trash-2', 'plus',
  'rocket', 'lock', 'lock-open', 'mail', 'package', 'monitor', 'moon', 'sun', 'cloud',
  'info', 'circle-x', 'hand', 'palette', 'tag', 'briefcase', 'bell-ring', 'ban', 'school',
  'chart-column', 'pen-line', 'megaphone', 'eye', 'download', 'x', 'check', 'notebook',
  'gift', 'coffee', 'alarm-clock', 'key-round', 'history', 'layout-dashboard', 'camera',
  'target', 'lightbulb', 'upload', 'log-out', 'shield-check', 'user-cog', 'scroll'
];

const out = {};
let miss = [];
for (const n of NAMES) {
  const p = path.join(dir, n + '.svg');
  if (!fs.existsSync(p)) { miss.push(n); continue; }
  const svg = fs.readFileSync(p, 'utf8');
  const inner = svg.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?>/, '')
    .replace(/<\/svg>/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!inner) { miss.push(n + '(empty)'); continue; }
  out[n] = inner;
}
fs.writeFileSync(path.join(__dirname, 'src', 'gx-icons.json'), JSON.stringify(out));
console.log('extracted:', Object.keys(out).length, 'missing:', miss.join(',') || 'none');
