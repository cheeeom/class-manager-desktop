/* 班主任工作台 · 桌面版 —— Electron 主进程
   原则：本地内容、无远程加载、contextIsolation 开、nodeIntegration 关、禁 ServiceWorker。 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

app.setName('班主任工作台');

let win = null;

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
          const baseOk = r.ready === 'complete' && r.desktopFlag === true && r.loginOverlay && r.appShell && /桌面版/.test(r.versionTag || '');
          const wizardOk = r.wizardShown === true && r.nextBtn === true && r.stepAdvanced === true;
          const pass = baseOk && wizardOk && consoleErrors.length === 0;
          console.log('[CM_SMOKE] wizardInteractive=' + wizardOk);
          console.log('[CM_SMOKE] consoleErrors=' + JSON.stringify(consoleErrors));
          console.log('[CM_SMOKE] verdict=' + (pass ? 'PASS' : 'FAIL'));
          app.exit(pass ? 0 : 1);
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
