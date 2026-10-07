/* 班主任工作台 · 桌面版 —— Electron 主进程
   原则：本地内容、无远程加载、contextIsolation 开、nodeIntegration 关、禁 ServiceWorker。 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('班主任工作台');

/* ---------- 更新代理（国内网络直连 GitHub 常超时：允许用户为更新器指定代理，存 userData 文件） ---------- */
const proxyFile = () => path.join(app.getPath('userData'), 'updater-proxy.json');
function readProxy() {
  try {
    const j = JSON.parse(fs.readFileSync(proxyFile(), 'utf8'));
    return typeof j.proxy === 'string' ? j.proxy : '';
  } catch (e) { return ''; }
}
function applyProxy(p) {
  try {
    const { session } = require('electron');
    if (p) session.defaultSession.setProxy({ proxyRules: p });   // 形如 host:port 或 scheme=host:port
    else session.defaultSession.setProxy({ mode: 'direct' });
  } catch (e) {}
}
function normalizeProxy(input) {
  var p = String(input || '').trim();
  if (!p) return '';
  if (!/^[a-z]+:\/\//i.test(p)) p = 'http://' + p;
  var u = new URL(p);
  if (!u.hostname) throw new Error('代理地址无效');
  var scheme = u.protocol.replace(':', '');
  if (scheme === 'https') scheme = 'http';
  return scheme === 'http' ? (u.hostname + ':' + (u.port || 80)) : (scheme + '=' + u.hostname + ':' + (u.port || 1080));
}

let win = null;

/* 冒烟模式：隔离 userData（临时目录）——既保证向导断言确定性，也绝不碰真实数据 */
if (process.env.CM_SMOKE) {
  const os = require('os');
  app.setPath('userData', path.join(os.tmpdir(), 'cm_smoke_' + Date.now()));
}

/* ---------- 应用内更新（electron-updater，GitHub Releases 作源） ----------
   开发模式（electron .）无 app-update.yml，自动跳过；仅打包运行时生效。
   策略：启动静默检查 → 发现新版自动后台下载 → 下载完提示（重启即装 / 退出时自动装）。 */
let autoUpdater = null;
function setupUpdater() {
  if (!app.isPackaged) return null;
  try {
    const { autoUpdater: au } = require('electron-updater');
    au.autoDownload = false;              // 发现新版先问用户（左下角弹窗），选「立即更新」才下载
    au.autoInstallOnAppQuit = true;      // 下载完成后用户正常退出应用时自动安装
    au.logger = null;                     // 不往 console 刷 error（冒烟计零原则）
    autoUpdater = au;

    const send = (channel, payload) => {
      try { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); } catch (e) {}
    };
    au.on('checking-for-update', () => send('cm-upd-event', { state: 'checking' }));
    au.on('update-available', (info) => send('cm-upd-event', { state: 'available', version: info.version }));
    au.on('update-not-available', () => send('cm-upd-event', { state: 'none' }));
    au.on('download-progress', (p) => send('cm-upd-event', { state: 'downloading', percent: Math.round(p.percent || 0), mb: ((p.transferred || 0) / 1048576).toFixed(1) + '/' + ((p.total || 0) / 1048576).toFixed(1) }));
    au.on('update-downloaded', (info) => send('cm-upd-event', { state: 'ready', version: info.version }));
    au.on('error', (err) => send('cm-upd-event', { state: 'error', message: String(err && err.message || err).slice(0, 140) }));

    ipcMain.handle('cm-upd-check', async () => {
      try { const r = await au.checkForUpdates(); return { ok: true, version: r && r.update && r.update.version }; }
      catch (e) { return { ok: false, message: String(e && e.message || e).slice(0, 140) }; }
    });
    ipcMain.handle('cm-upd-download', async () => {
      try { await au.downloadUpdate(); return { ok: true }; }
      catch (e) { return { ok: false, message: String(e && e.message || e).slice(0, 140) }; }
    });
    ipcMain.handle('cm-upd-install', () => { try { au.quitAndInstall(); } catch (e) {} });
    return au;
  } catch (e) {
    console.log('[updater] init skipped: ' + e.message);
    return null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 660,
    title: '班主任工作台 · 桌面版',
    icon: path.join(__dirname, 'icon', 'icon.png'),
    backgroundColor: '#F6F2E9',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setMenu(null);
  win.removeMenu();

  // 本地应用不允许导航到外部地址；外链交给系统浏览器
  win.webContents.on('will-navigate', function (e, url) {
    if (!url.startsWith('file://')) { e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(function (details) {
    if (/^https:/.test(details.url)) shell.openExternal(details.url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.once('ready-to-show', function () { win.show(); });
}

app.whenReady().then(function () {
  const savedProxy = readProxy();
  if (savedProxy) applyProxy(savedProxy);   // 更新器（electron.net）走默认会话，代理需在检查前生效
  // 更新代理 IPC：无条件注册（dev 下更新器跳过，但页面桥始终存在，漏注册会落未捕获异常）
  ipcMain.handle('cm-upd-getproxy', () => readProxy());
  ipcMain.handle('cm-upd-setproxy', function (e, input) {
    try {
      const rules = normalizeProxy(input);
      fs.writeFileSync(proxyFile(), JSON.stringify({ proxy: rules }, null, 2) + '\n');
      applyProxy(rules);
      return { ok: true, proxy: rules };
    } catch (err) { return { ok: false, message: String(err && err.message || err).slice(0, 140) }; }
  });
  setupUpdater();
  createWindow();

  // 冒烟模式：CM_SMOKE=1 时启动后自检并退出（本机验证用）
  // 探针含交互验证：模拟点击「开始配置」必须能翻到第 2 步（v1.0.1 起，防"按钮死"回归）；
  // console-error 级消息视为失败（捕获向导/应用启动异常）。
  if (process.env.CM_SMOKE) {
    const consoleErrors = [];
    win.webContents.on('console-message', function (e, level, message) {
      if (level >= 3) consoleErrors.push(String(message).slice(0, 200));
    });
    setTimeout(function () {
      const ok = win && !win.isDestroyed();
      console.log('[CM_SMOKE] window=' + (ok ? 'ok' : 'missing'));
      console.log('[CM_SMOKE] userData=' + app.getPath('userData'));
      console.log('[CM_SMOKE] version=' + app.getVersion());
      if (ok) {
        win.webContents.executeJavaScript(
          '(async function(){' +
          '  const r = {};' +
          '  r.ready = document.readyState;' +
          '  r.title = document.title;' +
          '  r.desktopFlag = !!window.__CM_DESKTOP;' +
          '  r.loginOverlay = !!document.getElementById("loginOverlay");' +
          '  r.appShell = !!document.querySelector(".app");' +
          '  r.versionTag = (document.querySelector(".login-version")||{}).textContent;' +
          '  const wiz = document.querySelector(".cmDesk-wizard");' +
          '  r.wizardShown = !!wiz;' +
          '  const next = document.getElementById("cmWizNext");' +
          '  r.nextBtn = !!next;' +
          '  if (next) {' +
          '    next.click();' +
          '    await new Promise(function(res){ setTimeout(res, 400); });' +
          '    const step = document.querySelector(".cmDesk-wstep");' +
          '    r.stepAfterClick = step ? step.textContent : null;' +
          '    r.stepAdvanced = !!(step && step.textContent.indexOf("第 2 步") >= 0);' +
          '  }' +
          '  return JSON.stringify(r);' +
          '})()'
        ).then(function (s) {
          console.log('[CM_SMOKE] page=' + s);
          const r = JSON.parse(s);
          const wantTag = 'v' + app.getVersion() + ' 桌面版';
          const baseOk = r.ready === 'complete' && r.desktopFlag === true && r.loginOverlay && r.appShell && r.versionTag === wantTag;
          const wizardOk = r.wizardShown === true && r.nextBtn === true && r.stepAdvanced === true;
          const pass = baseOk && wizardOk && consoleErrors.length === 0;
          console.log('[CM_SMOKE] wizardInteractive=' + wizardOk);
          console.log('[CM_SMOKE] consoleErrors=' + JSON.stringify(consoleErrors));
          console.log('[CM_SMOKE] verdict=' + (pass ? 'PASS' : 'FAIL'));
          // 截图存档（按钮排版人工复核用）
          win.webContents.capturePage().then(function (img) {
            const out = process.env.CM_SMOKE_SHOT || path.join(__dirname, 'out', '_smoke.png');
            try { require('fs').mkdirSync(path.dirname(out), { recursive: true }); } catch (e) {}
            require('fs').writeFileSync(out, img.toPNG());
            console.log('[CM_SMOKE] shot=' + out);
            app.exit(pass ? 0 : 1);
          }).catch(function () { app.exit(pass ? 0 : 1); });
        }).catch(function (e) {
          console.log('[CM_SMOKE] page-probe-error=' + e.message);
          app.exit(1);
        });
      } else {
        app.exit(1);
      }
    }, 5000);
  }
});

app.on('window-all-closed', function () { app.quit(); });
app.on('web-contents-created', function (e, contents) {
  // 双保险：禁 ServiceWorker 注册（构建期已桩掉页面侧注册）
  contents.session.setPermissionRequestHandler(function (wc, permission, cb) {
    cb(permission === 'clipboard-read');
  });
});
