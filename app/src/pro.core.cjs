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
  /* 学期报告 PDF 导出（M3）：隐藏窗口 printToPDF，全程离线。
     BrowserWindow/dialog 取自 deps 或 electron 本体（探针同源可用）。
     免对话框逃生舱仅非打包 + CM_PROBE_PDF=1（探针）。 */
  const { BrowserWindow: BW } = deps.BrowserWindow ? { BrowserWindow: deps.BrowserWindow } : require('electron');
  const { dialog: DLG } = deps.dialog ? { dialog: deps.dialog } : require('electron');
  ipcMain.handle('cm-pro-report-pdf', async function (e, payload) {
    let bw = null;
    try {
      const html = String((payload && payload.html) || '');
      const name = String((payload && payload.name) || '学期报告.pdf').replace(/[\\/:*?"<>|]/g, '_');
      if (!html || html.length > 2000000) return { ok: false, why: '报告内容为空或过大' };
      if (/<script/i.test(html)) return { ok: false, why: '报告内容不允许包含脚本' };
      bw = new BW({ show: false, webPreferences: { offscreen: true } });
      await bw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const buf = await bw.webContents.printToPDF({
        printBackground: true, pageSize: 'A4',
        margins: { top: 0.55, bottom: 0.55, left: 0.5, right: 0.5 }
      });
      let filePath = null;
      if (!app.isPackaged && process.env.CM_PROBE_PDF === '1') {
        filePath = path.join(app.getPath('temp'), name);
      } else {
        const r = await DLG.showSaveDialog(bw, {
          title: '导出学期报告 PDF', defaultPath: name,
          filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
        });
        if (r.canceled || !r.filePath) return { ok: false, why: 'canceled' };
        filePath = r.filePath;
      }
      fs.writeFileSync(filePath, buf);
      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, why: String((err && err.message) || err).slice(0, 140) };
    } finally {
      if (bw && !bw.isDestroyed()) bw.destroy();
    }
  });
}

module.exports = { proParse, proCanon, proCheck, register, ed };
