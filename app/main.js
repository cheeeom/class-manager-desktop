/* 班主任工作台 · 桌面版 —— Electron 主进程
   原则：本地内容、无远程加载、contextIsolation 开、nodeIntegration 关、禁 ServiceWorker。 */
const { app, BrowserWindow, shell, ipcMain, session, net } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('班主任工作台');

/* ---------- 更新源智能择优（v1.0.8） ----------
   实测（2026-10-07 本机）：github.com 直连 TCP 超时（ERR_CONNECTION_TIMED_OUT 根因），
   而 electron-updater 的 GitHub 源把检查+下载全绑死在 github.com 域；api.github.com
   虽直连通但用不上。解法：改 generic 源 + releases/latest/download 固定路径，
   检查前并发探测候选源（镜像直连可达优先，官方兜底），选首个返回合法 latest.yml 的。
   注意：newUrlFromBase 用 new URL(path, base) 相对解析，base 必须以 / 结尾。 */
const FEEDS = [
  { name: 'gh-proxy 镜像', url: 'https://gh-proxy.com/https://github.com/cheeeom/class-manager-desktop/releases/latest/download/' },
  { name: 'ghfast 镜像',   url: 'https://ghfast.top/https://github.com/cheeeom/class-manager-desktop/releases/latest/download/' },
  { name: 'GitHub 官方',   url: 'https://github.com/cheeeom/class-manager-desktop/releases/latest/download/' }
];
function probeFeed(f) {
  return new Promise(function (resolve) {
    // 注意：Electron net.request 没有 Node 式 req.setTimeout（会同步抛错），用 JS 定时器兜底
    let done = false;
    const finish = function (r) { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(function () { try { req.abort(); } catch (e) {} finish(null); }, 6000);
    let req = null;
    try {
      req = net.request(f.url + 'latest.yml');
      let buf = '';
      req.on('response', function (res) {
        if (res.statusCode !== 200) { if (process.env.CM_SMOKE) console.log('[CM_SMOKE] probe ' + f.name + ' http ' + res.statusCode); res.resume(); finish(null); return; }
        res.on('data', function (c) { buf += c; });
        res.on('end', function () { if (process.env.CM_SMOKE) console.log('[CM_SMOKE] probe ' + f.name + ' end len=' + buf.length + ' head=' + JSON.stringify(buf.slice(0, 24))); finish(/^version:\s*\d/m.test(buf) ? f : null); });
      });
      req.on('error', function (e) { if (process.env.CM_SMOKE) console.log('[CM_SMOKE] probe ' + f.name + ' error: ' + e.message); finish(null); });
      req.end();
    } catch (e) { if (process.env.CM_SMOKE) console.log('[CM_SMOKE] probe ' + f.name + ' sync-throw: ' + e.message); finish(null); }
  });
}
async function pickFeed() {
  const probed = await Promise.all(FEEDS.map(probeFeed));
  for (const f of FEEDS) { if (probed.indexOf(f) >= 0) return f; }
  return null; // 全部超时/不可达
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
  if (!app.isPackaged && !process.env.CM_UPDTEST) return null; // dev 跳过；CM_UPDTEST=1 强制启用（择源端到端验证用）
  try {
    const { autoUpdater: au } = require('electron-updater');
    au.autoDownload = false;              // 发现新版先问用户（左下角弹窗），选「立即更新」才下载
    au.autoInstallOnAppQuit = true;      // 下载完成后用户正常退出应用时自动安装
    if (process.env.CM_UPDTEST) au.forceDevUpdateConfig = true; // dev 端到端验证：绕过 isPackaged 门
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

    async function cmCheck() {
      try {
        const feed = await pickFeed();
        if (!feed) return { ok: false, message: '镜像与官方源均不可达（网络受限，稍后再试）' };
        au.setFeedURL({ provider: 'generic', url: feed.url });
        console.log('[updater] feed = ' + feed.name);
        const r = await au.checkForUpdates();
        const ver = r && r.updateInfo ? r.updateInfo.version : null;
        return { ok: true, version: ver, feed: feed.name };
      }
      catch (e) { return { ok: false, message: String(e && e.message || e).slice(0, 140) }; }
    }
    ipcMain.handle('cm-upd-check', function () { return cmCheck(); });
    global.__cmUpdCheck = cmCheck;
    ipcMain.handle('cm-upd-download', async () => {
      try { await au.downloadUpdate(); return { ok: true }; }
      catch (e) { return { ok: false, message: String(e && e.message || e).slice(0, 140) }; }
    });
    // ① 静默安装（isSilent=true：沿用原安装目录自动覆盖，不弹 NSIS 向导页）
    // ② isForceRunAfter=true：装完自动重启，用户点一次「立即重启」后全程无需再操作
    ipcMain.handle('cm-upd-install', () => { try { au.quitAndInstall(true, true); } catch (e) {} });
    return au;
  } catch (e) {
    console.log('[updater] init skipped: ' + e.message);
    return null;
  }
}

/* ---------- 反馈邮件（v1.0.11）：设置页反馈卡 → 唤起系统邮件客户端 ----------
   收件人/主题在主进程拼死，页面侧传不进任意 URL（受控桥原则）。 */
const FEEDBACK_MAIL = '846699191@qq.com';
ipcMain.handle('cm-feedback-mail', function () {
  const subject = encodeURIComponent('班主任工作台 · 桌面版反馈（v' + app.getVersion() + '）');
  const body = encodeURIComponent('作者您好：\n\n\n\n—— 来自班主任工作台桌面版 v' + app.getVersion() + ' / ' + process.platform);
  return shell.openExternal('mailto:' + FEEDBACK_MAIL + '?subject=' + subject + '&body=' + body)
    .then(function () { return { ok: true }; })
    .catch(function (e) { return { ok: false, message: String(e && e.message || e).slice(0, 140) }; });
});

/* ---------- Pro 授权（v1.1.0）：离线 Ed25519 验签 + 设备绑定 + 双存储 ----------
   验签/激活/取码实现全部在 src/pro.core.cjs（探针共用同一实现，测的是真代码）。
   CM_PRO_PUB 上线前用 KeyGen 生成的真公钥替换；测试可用 CM_PRO_PUB_DEV 覆盖（仅非打包环境生效）。 */
const proCore = require('./src/pro.core.cjs');
const CM_PRO_PUB = '';
const CM_PRO_CLAIM_API = '';   // 自动取码云函数地址（部署后填；未填=自动取码关闭，走手动发码）
let proPubCache = '';
function proPub() {
  if (!proPubCache) proPubCache = (!app.isPackaged && process.env.CM_PRO_PUB_DEV) ? process.env.CM_PRO_PUB_DEV : CM_PRO_PUB;
  return proPubCache;
}
proCore.register({ ipcMain, app, fs, path, net, pub: proPub, claimApi: CM_PRO_CLAIM_API });

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
  // 代理策略（v1.0.8）：不再强制直连，默认会话跟随系统代理（镜像源直连可达为主源，
  //   系统代理存在时官方源也能通）。保留 v1.0.5 代理残留清理——死代理曾是
  //   net::ERR_CONNECTION_TIMED_OUT 的另一根因。
  try {
    const leftoverProxy = path.join(app.getPath('userData'), 'updater-proxy.json');
    if (fs.existsSync(leftoverProxy)) {
      fs.unlinkSync(leftoverProxy);
      console.log('[updater] 已清理 v1.0.5 代理残留 updater-proxy.json');
    }
  } catch (e) { console.log('[updater] leftover cleanup skipped: ' + e.message); }
  setupUpdater();
  createWindow();

  // CM_UPDTEST=1：择源 + setFeedURL + checkForUpdates 端到端验证（dev，独立于冒烟）
  if (process.env.CM_UPDTEST) {
    setTimeout(function () {
      global.__cmUpdCheck().then(function (r) {
        console.log('[CM_UPDTEST] result=' + JSON.stringify(r));
        app.exit(0);
      }).catch(function (e) { console.log('[CM_UPDTEST] err=' + e.message); app.exit(1); });
    }, 1500);
    return;
  }

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
      session.defaultSession.resolveProxy('https://api.github.com/').then(function (via) {
        console.log('[CM_SMOKE] updaterRoute=' + via.trim());
      });
      const feedP = pickFeed();
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
          // 截图存档（按钮排版人工复核用）；先等择源定论再退出
          feedP.then(function (f) {
            console.log('[CM_SMOKE] feed=' + (f ? f.name : 'none-reachable'));
            return win.webContents.capturePage();
          }).then(function (img) {
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
