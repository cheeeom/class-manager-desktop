// 从持久化工件中提取 dataURL 并解码为 icon.png
const fs = require('fs');
const path = require('path');
const ART = process.argv[2];
const OUT = process.argv[3];
const raw = fs.readFileSync(ART, 'utf8');
const m = raw.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!m) { console.error('FAIL 未找到 PNG dataURL'); process.exit(1); }
const buf = Buffer.from(m[1], 'base64');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
// PNG 完整性：8字节签名 + IHDR
const sigOk = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
console.log('OK icon.png', buf.length, 'bytes, PNG签名:', sigOk, '尺寸( IHDR ):',
  buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20));
