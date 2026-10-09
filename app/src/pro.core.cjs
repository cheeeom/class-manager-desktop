/* Pro 授权核心（v1.1.0）：离线 Ed25519 验签 + 设备绑定 + 双存储
   main.js 与探针（_probe_pro.js）共用本实现——探针测的就是真代码。
   契约：激活码 = CMPRO1. + b64url(JSON{v,tier,sn,eh,dev,ts,sig})；规范串 = CM1|tier|sn|eh|dev|ts */
const ed = require('./ed25519.cjs');

const unhx = (s) => new Uint8Array(String(s).match(/../g).map((h) => parseInt(h, 16)));
const b64d = (s) => JSON.parse(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
function proParse(lic) {
  if (typeof lic !== 'string' || lic.indexOf('CMPRO1.') !== 0) return null;
  try { return b64d(lic.slice(7)); } catch (e) { return null; }
}
function proCanon(l) { return 'CM1|' + l.tier + '|' + l.sn + '|' + l.eh + '|' + l.dev + '|' + l.ts; }
async function proCheck(l, reqDev, pub) {
  try {
    if (!l || l.v !== 1 || (l.tier !== 'early' && l.tier !== 'std') || !/^[0-9a-f]{128}$/.test(l.sig || '')) return { ok: false, why: '格式' };
    if (reqDev && l.dev !== reqDev) return { ok: false, why: '设备不符' };
    if (!/^[0-9a-f]{64}$/.test(pub || '')) return { ok: false, why: '未配置公钥' };
    const ok = await ed.verifyAsync(unhx(l.sig), new TextEncoder().encode(proCanon(l)), unhx(pub));
    return ok ? { ok: true, tier: l.tier, sn: l.sn, eh: l.eh, dev: l.dev } : { ok: false, why: '验签' };
  } catch (e) { return { ok: false, why: String(e && e.message || e).slice(0, 80) }; }
}

/* 注册 IPC（main 传生产 pub/claimApi；探针传测试 pub）。返回_handlers 供注入。 */
function register(deps) {
  const { ipcMain, app, fs, path, net, pub, claimApi } = deps;
  const proFile = () => path.join(app.getPath('userData'), 'pro.json');
  ipcMain.handle('cm-pro-status', async function () {
    try {
      const f = proFile();
      if (!fs.existsSync(f)) return { active: false };
      const st = JSON.parse(fs.readFileSync(f, 'utf8'));
      const r = await proCheck(st.lic, st.dev, pub());
      if (!r.ok) return { active: false, why: r.why };
      return { active: true, tier: r.tier, sn: r.sn, eh: r.eh };
    } catch (e) { return { active: false, why: String(e && e.message || e).slice(0, 80) }; }
  });
  ipcMain.handle('cm-pro-activate', async function (e, payload) {
    try {
      let req = payload && payload.req;
      if (typeof req === 'string') req = b64d(req);
      const l = proParse(payload && payload.lic);
      const r = await proCheck(l, req && req.dev, pub());
      if (!r.ok) return { ok: false, why: r.why === '设备不符' ? '这个激活码不是签给本机的（换机请联系作者免费重置）' : '激活码无效（' + r.why + '）' };
      fs.writeFileSync(proFile(), JSON.stringify({ lic: l, dev: r.dev, activatedAt: Date.now() }, null, 1));
      return { ok: true, tier: r.tier, sn: r.sn, eh: r.eh };
    } catch (e) { return { ok: false, why: String(e && e.message || e).slice(0, 100) }; }
  });
  ipcMain.handle('cm-pro-claim', async function (e, reqCode) {
    if (!claimApi) return { ok: false, why: 'AUTO_OFF' };
    try {
      const acc = await new Promise(function (resolve, reject) {
        const rq = net.request(claimApi + encodeURIComponent(reqCode));
        let buf = '';
        rq.on('response', function (res) { res.on('data', (c) => { buf += c; }); res.on('end', () => resolve(buf)); });
        rq.on('error', reject);
        rq.end();
      });
      const j = JSON.parse(acc);
      return j && j.ok ? { ok: true, lic: j.lic } : { ok: false, why: (j && j.why) || 'NOT_FOUND' };
    } catch (e2) { return { ok: false, why: 'NET' }; }
  });
}

module.exports = { proParse, proCanon, proCheck, register, ed };
