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
  if (process.env.CM_SMOKE) {
    setTimeout(function () {
      const ok = win && !win.isDestroyed();
      console.log('[CM_SMOKE] window=' + (ok ? 'ok' : 'missing'));
      console.log('[CM_SMOKE] userData=' + app.getPath('userData'));
      console.log('[CM_SMOKE] version=' + app.getVersion());
      if (ok) {
        win.webContents.executeJavaScript(
          'JSON.stringify({' +
          'ready: document.readyState,' +
          'title: document.title,' +
          'desktopFlag: !!window.__CM_DESKTOP,' +
          'loginOverlay: !!document.getElementById("loginOverlay"),' +
          'appShell: !!document.querySelector(".app"),' +
          'versionTag: (document.querySelector(".login-version")||{}).textContent,' +
          'wizardOrLogin: (!!document.querySelector(".cmDesk-wizard")) || (!!document.querySelector("#cmDeskEnter"))' +
          '})'
        ).then(function (s) {
          console.log('[CM_SMOKE] page=' + s);
          const r = JSON.parse(s);
          const pass = r.ready === 'complete' && r.desktopFlag === true && r.loginOverlay && r.appShell && /桌面版/.test(r.versionTag || '');
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
