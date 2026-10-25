/* 班主任工作台 · 桌面版注入层（仅桌面构建加载；线上版不含本文件，零影响）
   职责：首启向导（密码可跳=零密码模式）/ 无密码登录面板 / 清空数据管理员闸 /
        云同步界面裁剪 / 桌面版安全设置卡 / 关于卡版权增强 /
        数据分析图表引擎（v1.3.0：成绩 tab ECharts 重设计，cmInk 主题）。
   依赖：主应用脚本已在本文件之前加载（hashPwd/enterApp/importData/saveData 等全局可用）。 */
(function () {
  'use strict';
  if (!window.__CM_DESKTOP) return;              // 非桌面环境（理论不会发生，双保险）
  if (window.__CM_DESK_LAYER__) return;          // 防双跑
  window.__CM_DESK_LAYER__ = true;

  var D = window.__CM_DESKTOP;
  /* v1.6.0 学生查询端：学生入口链接固定为 GitHub Pages（file:// 协议下 location.origin 是 file:///，
     生成的二维码/链接学生手机打不开。桌面只负责「发布」，学生端仍在网页版 Pages 上）。 */
  window.portalStudentUrl = function (owner, gistId) {
    return 'https://cheeeom.github.io/class-manager/portal/?o=' + encodeURIComponent(owner || '') +
           '&g=' + encodeURIComponent(gistId || '');
  };
  var LS_ONBOARD = 'cm_onboarded';
  var LS_NOPWD = 'cm_nopwd';
  var K_LOGIN = 'classManagerLoginPwd';
  var K_ADMIN = 'classManagerAdminPwd';
  var USER_SET_ADMIN = 'cm_admin_user_set';

  /* ---------- 纯函数（导出给桌面测试沙箱） ---------- */
  function isSixDigits(s) { return /^\d{6}$/.test(String(s || '')); }
  function weakPattern(s) { return /^(?:([0-9])\1{5})$/.test(s) || s === '123456' || s === '654321'; } // 弱口令提示（不拦截）
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  window.__CM_DESK_TEST = { isSixDigits: isSixDigits, weakPattern: weakPattern, lsGet: lsGet, lsSet: lsSet, lsDel: lsDel };

  /* ---------- 工具 ---------- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function appFn(name) { return typeof window[name] === 'function' ? window[name] : null; }
  function userLoginPwdSet() { return !!lsGet(K_LOGIN); }
  function userAdminPwdSet() { return !!lsGet(K_ADMIN) || lsGet(USER_SET_ADMIN) === '1'; }
  var COPYRIGHT = '© 2026 chee · 班主任工作台 · 保留所有权利';
  var cmUpdDeclined = false;   // 本次会话内用户点过「暂不」→ 不再自动弹窗（手动检查仍会弹）
  var cmUpdManual = false;
  var cmUpdReadyToasted = false;

  /* ---------- 左下角更新弹窗（用户选择：立即更新 / 暂不；就绪后：重启安装 / 稍后） ---------- */
  function cmUpdCloseToast() {
    var t = document.getElementById('cmDeskUpdToast');
    if (t) t.remove();
  }
  function cmUpdToast(ev) {
    var old = document.getElementById('cmDeskUpdToast');
    if (old && old.getAttribute('data-state') === ev.state && ev.state === 'downloading') {
      // 下载中：只刷新进度
      var d = old.querySelector('.cmUpdD');
      if (d) d.textContent = '正在下载新版本… ' + ev.percent + '%（' + ev.mb + ' MB）';
      var bar = old.querySelector('.cmUpdBar i');
      if (bar) bar.style.width = ev.percent + '%';
      return;
    }
    cmUpdCloseToast();
    var box = el('div', 'cmDeskUpdToast');
    box.id = 'cmDeskUpdToast';
    box.setAttribute('data-state', ev.state);
    var html = '';
    if (ev.state === 'available') {
      html = '<div class="t">🚀 发现新版本 v' + ev.version + '</div>' +
        '<div class="d">新版约 78MB，下载完成后重启应用即可完成安装。<br>你也可以继续使用当前版本，之后可在 设置 → 关于本系统 手动检查。</div>' +
        '<div class="r"><button class="btn btn-outline" id="cmUpdLater">暂不更新</button><button class="btn btn-primary" id="cmUpdNow">立即更新</button></div>';
    } else if (ev.state === 'downloading') {
      html = '<div class="t">⬇️ 正在下载新版本</div>' +
        '<div class="d cmUpdD">正在下载新版本… ' + ev.percent + '%（' + ev.mb + ' MB）</div>' +
        '<div class="cmUpdBar"><i style="width:' + ev.percent + '%"></i></div>' +
        '<div class="r"><button class="btn btn-outline" id="cmUpdHide">收起</button></div>';
    } else if (ev.state === 'ready') {
      html = '<div class="t">✅ 新版 v' + ev.version + ' 已就绪</div>' +
        '<div class="d">点击「立即重启」：自动关闭 → 沿用原目录静默覆盖安装 → 自动重启新版，全程无需其他操作。</div>' +
        '<div class="r"><button class="btn btn-outline" id="cmUpdLater2">稍后</button><button class="btn btn-primary" id="cmUpdInstall">立即重启</button></div>';
    } else if (ev.state === 'error') {
      html = '<div class="t">⚠️ 更新未完成</div>' +
        '<div class="d">' + (ev.message || '网络问题，稍后再试。') + '</div>' +
        '<div class="r"><button class="btn btn-outline" id="cmUpdHide">关闭</button></div>';
    }
    box.innerHTML = html;
    document.body.appendChild(box);
    var bind = function (id, fn) { var b = box.querySelector('#' + id); if (b) b.onclick = fn; };
    bind('cmUpdNow', function () {
      box.setAttribute('data-state', 'downloading');
      box.querySelector('.r').innerHTML = '<div class="d cmUpdD">正在连接更新源…</div><div class="cmUpdBar"><i style="width:2%"></i></div>';
      window.__CM_UPDATER.download();
    });
    bind('cmUpdLater', function () { cmUpdDeclined = true; cmUpdCloseToast(); });
    bind('cmUpdHide', function () { cmUpdCloseToast(); });
    bind('cmUpdLater2', function () { cmUpdCloseToast(); });
    bind('cmUpdInstall', function () { window.__CM_UPDATER.install(); });
  }

  /* ---------- 1. 云同步界面裁剪 + 网页版专属设置区隐藏（桌面版无对应场景） ---------- */
  function stripCloudUI() {
    try {
      var hs = document.querySelectorAll('.settings-section h3');
      for (var i = 0; i < hs.length; i++) {
        var txt = hs[i].textContent;
        if (txt.indexOf('云同步') >= 0 ||
            txt.indexOf('修改登录密码') >= 0 ||      // 桌面版：改密统一走「🔐 安全（桌面版）」卡
            txt.indexOf('跨电脑使用指南') >= 0) {    // 桌面版：数据在本机，无"新设备登录"场景
          var sec = hs[i].closest('.settings-section');
          if (sec) sec.style.display = 'none';
        }
      }
      var btns = document.querySelectorAll('button[onclick*="restoreFromCloud"]');
      for (var j = 0; j < btns.length; j++) btns[j].style.display = 'none';
      var tks = document.querySelectorAll('button[onclick*="configSyncPwd"], button[onclick*="doPushToCloud"], button[onclick*="autoSyncFromCloud"]');
      for (var k = 0; k < tks.length; k++) tks[k].style.display = 'none';
      // 「登录密码仅限本机登录」是网页版多设备场景产物，桌面版无意义（整个区已隐藏，此处双保险）
      var chk = document.getElementById('pwdLocalOnlyChk');
      if (chk && chk.closest('label')) chk.closest('label').style.display = 'none';
      // 危险操作提示改为桌面版口径（原文提及"从云端恢复/同步清空云端"，桌面版无云端）
      for (var m = 0; m < hs.length; m++) {
        if (hs[m].textContent.indexOf('危险操作') >= 0) {
          var dsec = hs[m].closest('.settings-section');
          if (dsec) {
            var divs = dsec.querySelectorAll('div');
            for (var n = 0; n < divs.length; n++) {
              if (divs[n].textContent.indexOf('从云端恢复」会用') >= 0) {
                divs[n].innerHTML = '「清空数据」清空<b>本机全部数据</b>，且不可撤销。<br>执行前建议先「💾 导出数据」留一份备份（桌面版数据仅在本机，无云端副本）。';
              }
            }
          }
          break;
        }
      }
    } catch (e) {}
  }

  /* ---------- 2. 清空数据 · 管理员闸 ---------- */
  function adminGate(onPass) {
    if (userAdminPwdSet()) {
      cmDeskPrompt({
        title: '🔐 管理员密码确认',
        body: '此操作将<span style="color:var(--danger);font-weight:700">清空本机全部数据</span>，且不可撤销。请输入管理员密码：',
        type: 'password', maxlen: 20, okText: '确认清空',
        onOk: function (v) {
          if (window.verifyAdminPwd && window.verifyAdminPwd(v)) { onPass(); return true; }
          return '管理员密码错误';
        }
      });
    } else {
      cmDeskPrompt({
        title: '⚠️ 操作确认',
        body: '此操作将<span style="color:var(--danger);font-weight:700">清空本机全部数据</span>，且不可撤销。<br>你未设置管理员密码——请输入「<b>清空</b>」两字确认：',
        type: 'text', maxlen: 4, okText: '确认清空', placeholder: '输入 清空',
        onOk: function (v) {
          if (String(v).trim() === '清空') { onPass(); return true; }
          return '请输入「清空」两字';
        }
      });
    }
  }
  function wrapDangerousFns() {
    if (typeof window.clearData === 'function' && !window.clearData.__cmDeskGate) {
      var wrapped = function () { adminGate(function () { gxWipeLocal(); }); };
      wrapped.__cmDeskGate = true;
      window.clearData = wrapped;
    }
  }
  /* v1.4.1 桌面单机清空：复刻网页版 clearData 的 schema 重置段（15021-15036），
     砍掉两道原生 confirm（图四样式不统一根因）与「同步清空云端」链路（pushWipeToCloud
     的 Token toast = 老板看到的右上角弹窗）——桌面版完全单机，无云端可清。 */
  function gxWipeLocal() {
    var st = cmGxState();
    if (!st) return;
    try { localStorage.removeItem('classManagerData'); } catch (e) {}   // 先清旧快照（同网页版口径）
    var KEEP = { className: 1, classNameFull: 1, classMotto: 1, classAvatar: 1, scheduleImage: 1, schedule: 1, schemaVer: 1, catDeleted: 1, catDeletedAt: 1, catRevived: 1, reasonCatalog: 1 };
    var saved = {};
    Object.keys(KEEP).forEach(function (k) { saved[k] = st[k]; });
    var buildDefault = appFn('buildDefaultState');
    var defaults = buildDefault ? buildDefault() : {};
    Object.keys(defaults).forEach(function (k) { st[k] = defaults[k]; });
    Object.keys(KEEP).forEach(function (k) { if (saved[k] !== undefined) st[k] = saved[k]; });
    st.reasonScores = Object.assign({}, (typeof window.defaultReasonScores === 'object' && window.defaultReasonScores) || {});
    st.honorDeleted = {};
    st.studentDeleted = {};
    st.wipeAt = Date.now();
    if (appFn('saveData')) window.saveData();
    if (appFn('renderAll')) window.renderAll();
    if (window.showToast) window.showToast('本机数据已全部清空（桌面版单机存储，无云端）', 'success');
  }

  /* ---------- 3. 通用小模态（纸墨风，独立于 app 的 cmPrompt 以免耦合） ---------- */
  function cmDeskPrompt(opt) {
    var mask = el('div', 'cmDesk-mask');
    var box = el('div', 'cmDesk-modal');
    box.appendChild(el('div', 'cmDesk-title', opt.title || ''));
    var body = el('div', 'cmDesk-body', opt.body || '');
    box.appendChild(body);
    var input = null;
    if (opt.type) {
      input = document.createElement('input');
      input.className = 'cmDesk-input';
      input.type = opt.type === 'password' ? 'password' : 'text';
      input.maxLength = opt.maxlen || 20;
      if (opt.placeholder) input.placeholder = opt.placeholder;
      box.appendChild(input);
    }
    var row = el('div', 'cmDesk-row');
    var cancel = el('button', 'btn btn-outline', '取消');
    var ok = el('button', 'btn btn-primary', opt.okText || '确定');
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    mask.appendChild(box);
    document.body.appendChild(mask);
    function close() { gxCloseMask(mask); }
    cancel.onclick = function () { close(); };
    mask.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    ok.onclick = function () {
      var err = opt.onOk ? opt.onOk(input ? input.value : undefined) : true;
      if (err === true) close();
      else {
        var tip = body.querySelector('.cmDesk-err') || el('div', 'cmDesk-err');
        tip.textContent = err || '输入有误';
        if (!tip.parentNode) body.appendChild(tip);
      }
    };
    if (input) { input.focus(); input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); }); }
  }

  /* ---------- 4. 首启向导 ---------- */
  var wizState = { step: 0, loginP1: '', loginP2: '', adminP1: '', adminP2: '', loginSkip: false, adminSkip: false, imported: false };

  function wizardShell(title, bodyHtml, footHtml) {
    // 换步前清掉所有现存向导遮罩（防堆叠：半透明层叠加会逐层变暗，document 查询也会命中旧标题）
    var olds = document.querySelectorAll('.cmDesk-wizard');
    for (var i = 0; i < olds.length; i++) olds[i].remove();
    var mask = el('div', 'cmDesk-wizard');
    var card = el('div', 'cmDesk-wcard');
    card.appendChild(el('div', 'cmDesk-wstep', title));
    var body = el('div', 'cmDesk-wbody', bodyHtml);
    card.appendChild(body);
    var foot = el('div', 'cmDesk-wfoot', footHtml || '');
    card.appendChild(foot);
    mask.appendChild(card);
    document.body.appendChild(mask);
    return { mask: mask, body: body, foot: foot };
  }

  function keypad(onKey) {
    var wrap = el('div', 'login-keypad');
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
    keys.forEach(function (k) {
      var b = el('button', 'key' + (k === 'C' || k === '⌫' ? ' key-fn' : ''), k);
      b.type = 'button';
      b.onclick = function () { onKey(k); };
      wrap.appendChild(b);
    });
    return wrap;
  }
  function dots(len, target) {
    var d = el('div', 'login-pwd-display');
    d.id = 'cmDeskDots';
    for (var i = 0; i < (target || 6); i++) {
      d.appendChild(el('span', 'pwd-dot ' + (i < len ? 'pwd-dot-filled' : 'pwd-dot-empty')));
    }
    return d;
  }

  function stepWelcome() {
    var w = wizardShell('第 1 步 · 共 6 步',
      '<div class="cmDesk-logo">班</div>' +
      '<h2 style="font-family:var(--font-display);margin:10px 0 6px">欢迎使用班主任工作台</h2>' +
      '<div style="color:var(--text-secondary);font-size:13.5px;line-height:2">' +
      '<p>📌 这是一个<b>单机版</b>：你的全部数据只保存在这台电脑上，不经任何服务器。</p>' +
      '<p>🔑 接下来会引导你设置密码（也可以跳过，零密码直接使用）。</p>' +
      '<p>🧭 随时可以点击左下角「跳过向导」，之后在 设置 里完成配置。</p>' +
      '</div>' +
      '<div class="cmDesk-copy">© 2026 <b>chee</b> · 班主任工作台 · 保留所有权利<br>' +
      '<span style="color:var(--text-muted)">本软件版权归开发者所有，转发分享请完整保留开发者署名与本声明。</span></div>',
      '<button class="btn btn-outline" id="cmWizSkipAll">跳过向导</button>' +
      '<button class="btn btn-primary" id="cmWizNext"><span>开始配置</span></button>');
    w.foot.querySelector('#cmWizNext').onclick = function () { stepLoginPwd(); };
    w.foot.querySelector('#cmWizSkipAll').onclick = function () { finishWizard(); };
  }

  function stepLoginPwd() {
    wizState.loginP1 = ''; wizState.loginP2 = ''; wizState.loginSkip = false;
    var w = wizardShell('第 2 步 · 共 6 步',
      '<h2 style="font-family:var(--font-display)">设置登录密码</h2>' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">6 位数字，每次打开应用时输入。<br>⚠️ 桌面版密码<b>无法找回</b>，请务必记住；也可以跳过（零密码模式，打开即用）。</div>' +
      '<div style="text-align:center"><div id="cmDeskDotsWrap"></div></div>' +
      '<div id="cmDeskPad"></div>' +
      '<div id="cmDeskMsg" style="height:20px;font-size:12px;color:var(--danger);text-align:center"></div>',
      '<button class="btn btn-outline" id="cmWizBack"><span>上一步</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设密码）</button>' +
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span></button>');
    var wrap = w.body.querySelector('#cmDeskDotsWrap');
    var padWrap = w.body.querySelector('#cmDeskPad');
    var msg = w.body.querySelector('#cmDeskMsg');
    function redraw() {
      wrap.innerHTML = '';
      wrap.appendChild(dots(wizState.loginP1.length, 6));
    }
    redraw();
    padWrap.appendChild(keypad(function (k) {
      if (k === 'C') wizState.loginP1 = '';
      else if (k === '⌫') wizState.loginP1 = wizState.loginP1.slice(0, -1);
      else if (wizState.loginP1.length < 6) wizState.loginP1 += k;
      redraw();
    }));
    w.foot.querySelector('#cmWizSkipPwd').onclick = function () {
      wizState.loginSkip = true; lsSet(LS_NOPWD, '1'); lsDel(K_LOGIN); stepAdminPwd();
    };
    w.foot.querySelector('#cmWizBack').onclick = function () { stepWelcome(); };
    w.foot.querySelector('#cmWizNext').onclick = function () {
      if (!isSixDigits(wizState.loginP1)) { msg.textContent = '请输满 6 位数字'; return; }
      if (weakPattern(wizState.loginP1)) { msg.textContent = '该密码过于简单（重复/连号），换一个更安全的'; return; }
      // 第二遍
      var w2 = wizardShell('第 2 步 · 共 6 步',
        '<h2 style="font-family:var(--font-display)">再输一遍确认</h2>' +
        '<div style="text-align:center"><div id="cmDeskDotsWrap2"></div></div><div id="cmDeskPad2"></div>' +
        '<div id="cmDeskMsg2" style="height:20px;font-size:12px;color:var(--danger);text-align:center"></div>',
        '<button class="btn btn-outline" id="cmWizBack2"><span>重输</span></button>' +
        '<button class="btn btn-primary" id="cmWizOk">完成密码设置</button>');
      var wrap2 = w2.body.querySelector('#cmDeskDotsWrap2');
      var pad2 = w2.body.querySelector('#cmDeskPad2');
      var msg2 = w2.body.querySelector('#cmDeskMsg2');
      function redraw2() { wrap2.innerHTML = ''; wrap2.appendChild(dots(wizState.loginP2.length, 6)); }
      redraw2();
      pad2.appendChild(keypad(function (k) {
        if (k === 'C') wizState.loginP2 = '';
        else if (k === '⌫') wizState.loginP2 = wizState.loginP2.slice(0, -1);
        else if (wizState.loginP2.length < 6) wizState.loginP2 += k;
        redraw2();
      }));
      w2.foot.querySelector('#cmWizBack2').onclick = function () { w2.mask.remove(); stepLoginPwd(); };
      w2.foot.querySelector('#cmWizOk').onclick = function () {
        if (wizState.loginP2 !== wizState.loginP1) { msg2.textContent = '两次输入不一致，请重试'; wizState.loginP2 = ''; redraw2(); return; }
        if (window.hashPwd) { lsSet(K_LOGIN, window.hashPwd(wizState.loginP1)); lsDel(LS_NOPWD); w2.mask.remove(); stepAdminPwd(); }
        else { msg2.textContent = '系统函数未就绪，请重试'; }
      };
      w.mask.remove();
    };
  }

  function stepAdminPwd() {
    wizState.adminP1 = ''; wizState.adminP2 = '';
    var w = wizardShell('第 3 步 · 共 6 步',
      '<h2 style="font-family:var(--font-display)">设置管理员密码</h2>' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">用于敏感操作确认（如「清空数据」）。可跳过——未设置时，清空数据需输入「清空」二字确认。</div>' +
      '<div style="text-align:center"><div id="cmDeskDotsWrap"></div></div><div id="cmDeskPad"></div>' +
      '<div id="cmDeskMsg" style="height:20px;font-size:12px;color:var(--danger);text-align:center"></div>',
      '<button class="btn btn-outline" id="cmWizBack"><span>上一步</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设管理员密码）</button>' +
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span></button>');
    var wrap = w.body.querySelector('#cmDeskDotsWrap');
    var padWrap = w.body.querySelector('#cmDeskPad');
    var msg = w.body.querySelector('#cmDeskMsg');
    function redraw() { wrap.innerHTML = ''; wrap.appendChild(dots(wizState.adminP1.length, 6)); }
    redraw();
    padWrap.appendChild(keypad(function (k) {
      if (k === 'C') wizState.adminP1 = '';
      else if (k === '⌫') wizState.adminP1 = wizState.adminP1.slice(0, -1);
      else if (wizState.adminP1.length < 6) wizState.adminP1 += k;
      redraw();
    }));
    w.foot.querySelector('#cmWizSkipPwd').onclick = function () { stepClassName(); };
    w.foot.querySelector('#cmWizBack').onclick = function () { stepLoginPwd(); };
    w.foot.querySelector('#cmWizNext').onclick = function () {
      if (!isSixDigits(wizState.adminP1)) { msg.textContent = '请输满 6 位数字'; return; }
      if (wizState.adminP1 === wizState.loginP1 && !wizState.loginSkip) { msg.textContent = '管理员密码不建议与登录密码相同'; return; }
      var w2 = wizardShell('第 3 步 · 共 6 步',
        '<h2 style="font-family:var(--font-display)">再输一遍确认</h2>' +
        '<div style="text-align:center"><div id="cmDeskDotsWrap2"></div></div><div id="cmDeskPad2"></div>' +
        '<div id="cmDeskMsg2" style="height:20px;font-size:12px;color:var(--danger);text-align:center"></div>',
        '<button class="btn btn-outline" id="cmWizBack2"><span>重输</span></button>' +
        '<button class="btn btn-primary" id="cmWizOk">完成设置</button>');
      var wrap2 = w2.body.querySelector('#cmDeskDotsWrap2');
      var pad2 = w2.body.querySelector('#cmDeskPad2');
      var msg2 = w2.body.querySelector('#cmDeskMsg2');
      function redraw2() { wrap2.innerHTML = ''; wrap2.appendChild(dots(wizState.adminP2.length, 6)); }
      redraw2();
      pad2.appendChild(keypad(function (k) {
        if (k === 'C') wizState.adminP2 = '';
        else if (k === '⌫') wizState.adminP2 = wizState.adminP2.slice(0, -1);
        else if (wizState.adminP2.length < 6) wizState.adminP2 += k;
        redraw2();
      }));
      w2.foot.querySelector('#cmWizBack2').onclick = function () { w2.mask.remove(); stepAdminPwd(); };
      w2.foot.querySelector('#cmWizOk').onclick = function () {
        if (wizState.adminP2 !== wizState.adminP1) { msg2.textContent = '两次输入不一致，请重试'; wizState.adminP2 = ''; redraw2(); return; }
        if (window.hashPwd) {
          lsSet(K_ADMIN, window.hashPwd(wizState.adminP1));
          lsSet(USER_SET_ADMIN, '1');
          w2.mask.remove(); stepClassName();
        } else msg2.textContent = '系统函数未就绪，请重试';
      };
      w.mask.remove();
    };
  }

  function stepClassName() {
    var w = wizardShell('第 4 步 · 共 6 步',
      '<h2 style="font-family:var(--font-display)">班级名称</h2>' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">显示在首页与导出件上，可以留空以后在设置里改。</div>' +
      '<input class="cmDesk-input" id="cmWizClassName" placeholder="如：三年级2班 / 2026级幼儿保育1班" maxlength="30">',
      '<button class="btn btn-outline" id="cmWizBack"><span>上一步</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span></button>');
    var input = w.body.querySelector('#cmWizClassName');
    function saveAndGo() {
      var name = (input.value || '').trim();
      if (name) {
        try {
          var inp = document.getElementById('classNameInput');
          if (inp) { inp.value = name; }
          if (typeof window.saveClassName === 'function') window.saveClassName();
          else if (window.state) { window.state.className = name; if (typeof window.saveData === 'function') window.saveData(); }
        } catch (e) {}
      }
      stepImport();
    }
    w.foot.querySelector('#cmWizNext').onclick = saveAndGo;
    w.foot.querySelector('#cmWizSkip').onclick = function () { stepImport(); };
    w.foot.querySelector('#cmWizBack').onclick = function () { stepAdminPwd(); };
    input.focus();
  }

  /* 第 5 步：导入学生名单（v1.2.6 重做）——提供模板下载；选表格后自动识别列并注入；
     此步导入了学生 → 后续完成页不再提供示例数据体验（wizState.imported） */
  function stepImport() {
    var w = wizardShell('第 5 步 · 共 6 步',
      '<h2 style="font-family:var(--font-display)">导入学生名单（可选）</h2>' +
      '<div style="font-size:13px;color:var(--text-secondary);line-height:2;margin-bottom:12px">' +
      '下载导入模板，按模板填好学生名单，在这里选择表格文件——系统自动识别姓名、性别、家长电话、学号、寝室等列并注入。<br>' +
      '也可以先跳过，之后随时在 设置 → 学生管理 →「批量导入学生表格」导入。</div>' +
      '<div style="margin-bottom:4px"><button class="btn btn-outline btn-sm" id="cmWizStuTpl"><span>📥 下载导入模板</span></button> <span style="font-size:12px;color:var(--text-muted)">（Excel / WPS 可直接编辑的 CSV）</span></div>',
      '<button class="btn btn-outline" id="cmWizBack"><span>上一步</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-primary" id="cmWizImport"><span>📊 选择表格导入</span></button>');
    w.body.querySelector('#cmWizStuTpl').onclick = cmWizStuTpl;
    w.foot.querySelector('#cmWizImport').onclick = cmWizPickTable;
    w.foot.querySelector('#cmWizSkip').onclick = function () { stepTour(); };
    w.foot.querySelector('#cmWizBack').onclick = function () { stepClassName(); };
  }
  /* 导入模板：表头与网页版「批量导入学生表格」的列识别口径一致（姓名必填） */
  function cmWizStuTpl() {
    try {
      var head = '姓名,性别,家长电话,家长姓名,学号,寝室';
      var demo = '张三,男,13800000001,张父,S202601,1栋101室\n李四,女,13800000002,李母,S202602,走读';
      var csv = '\uFEFF' + head + '\n' + demo + '\n';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '学生导入模板.csv';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      if (window.showToast) window.showToast('模板已下载', 'success');
    } catch (e) { if (window.showToast) window.showToast('模板下载失败', 'error'); }
  }
  /* 向导里选表格：复用网页版解析链（pickStudentTableFile → handleStudentTableFile），
     劫持 openModal('studentImportModal') 跳过预览直接确认注入（向导语境要「自动」）。
     导入完成 → wizState.imported = true → 直接走完向导进入工作台。 */
  function cmWizPickTable() {
    var origOpen = window.openModal;
    if (typeof origOpen !== 'function') return;
    window.openModal = function (id) {
      if (id === 'studentImportModal') {
        window.openModal = origOpen;                      // 先还原，别影响用户之后在设置里的正常导入
        var origC = window.confirmStudentImport;
        window.confirmStudentImport = function () {
          window.confirmStudentImport = origC;
          var r = origC ? origC.apply(this, arguments) : undefined;
          wizState.imported = true;
          setTimeout(function () { finishWizard(false); }, 250);   // 注入完成 → 收尾进入工作台
          return r;
        };
        return window.confirmStudentImport();
      }
      return origOpen.apply(this, arguments);
    };
    var fn = appFn('pickStudentTableFile');
    if (fn) fn();
    else {
      window.openModal = origOpen;                        // 解析链不在（理论不会），回退提示
      if (window.showToast) window.showToast('导入功能未就绪，请进入工作台后在设置里导入', 'warning');
    }
  }

  function stepTour() {
    var mods = [
      ['home', '首页', '课表、今日实到、班级速览'],
      ['users', '学生档案', '56 人花名册、一人一档'],
      ['star', '学分银行', '加减分流水、月度汇总'],
      ['alarm-clock', '值日点名', '值周排班、课堂随机点名'],
      ['medal', '荣誉与公示', '荣誉墙、学分公示海报'],
      ['cloud', '导出备份', '设置里可随时导出 JSON 留存']
    ];
    var grid = '<div class="cmDesk-tour">';
    mods.forEach(function (m) {
      grid += '<div class="cmDesk-tcell"><div class="cmDesk-tic">' + gxIc(m[0]) + '</div><b>' + m[1] + '</b><span>' + m[2] + '</span></div>';
    });
    grid += '</div>';
    var w = wizardShell('第 6 步 · 共 6 步', '<h2 style="font-family:var(--font-display)">30 秒认识工作台</h2>' + grid,
      '<button class="btn btn-primary" id="cmWizNext"><span>完成</span></button>');
    w.foot.querySelector('#cmWizNext').onclick = function () { stepFinish(); };
  }

  function stepFinish() {
    var w = wizardShell('完成',
      '<div class="cmDesk-logo">班</div>' +
      '<h2 style="font-family:var(--font-display)">一切就绪！</h2>' +
      '<div style="color:var(--text-secondary);font-size:13.5px;line-height:2">' +
      (wizState.loginSkip ? '<p>🔓 当前为<b>零密码模式</b>：打开应用直接进入。想加密码可到「设置 → 🔐 安全」。</p>' : '<p>🔐 登录密码已设置，下次打开需输入。</p>') +
      (userAdminPwdSet() ? '' : '<p>🛡️ 未设管理员密码：清空数据时输入「清空」二字确认。</p>') +
      (wizState.imported
        ? '<p>📋 学生名单已导入，直接开工吧！缺的信息可随时在「学生管理」里补充。</p>'
        : '<p>🎓 拿不准从哪开始？可以<b>带示例数据体验</b>：每个功能配指引弹窗，走完自动清除示例，不留任何痕迹。</p>') +
      '<p>💾 建议：定期在「设置 → 导出数据」留一份备份。</p>' +
      '</div>' +
      '<div class="cmDesk-copy">© 2026 <b>chee</b> · 班主任工作台（桌面版 v' + D.version + '） · 保留所有权利</div>',
      wizState.imported
        ? '<button class="btn btn-primary" id="cmWizDone"><span>进入工作台</span></button>'
        : '<button class="btn btn-outline" id="cmWizSample"><span>🎓 带示例体验</span></button>' +
          '<button class="btn btn-primary" id="cmWizDone"><span>进入工作台</span></button>');
    if (!wizState.imported) w.foot.querySelector('#cmWizSample').onclick = function () { finishWizard(true); };
    w.foot.querySelector('#cmWizDone').onclick = function () { finishWizard(false); };
  }

  function finishWizard(withSample) {
    lsSet(LS_ONBOARD, String(Date.now()));
    var masks = document.querySelectorAll('.cmDesk-wizard');
    for (var i = 0; i < masks.length; i++) masks[i].remove();
    patchLogin();
    buildSecurityCard();
    if (withSample) cmSampleInject();
    if (userLoginPwdSet()) {
      // 正常登录页（密码已设置）：示例体验的工作台指引等登录后由 watch 触发
      if (withSample) cmTourWatch();
      if (typeof window.showToast === 'function') window.showToast('初始设置完成', 'success');
    } else {
      // 零密码模式：平滑过渡进入
      if (withSample) cmTourWatch();
      enterWithTransition(withSample ? '欢迎！先用示例数据逛一圈' : '初始设置完成（零密码模式）');
    }
  }

  /* ---------- 进入工作台平滑过渡（交叉淡化 cross-fade）：
     ①enterApp 先行——工作台在遮罩下方渲染，帧卡被遮罩盖住；
     ②遮罩顶回（不透明）→ 强制回流 → 淡出+微放大揭示，工作台悬浮浮现。
     直接切 display 的「白闪+导航帧卡」由此消除。 ---------- */
  function enterWithTransition(msg) {
    var overlay = document.getElementById('loginOverlay');
    var shell = document.querySelector('.app');
    if (typeof window.enterApp !== 'function') return;
    window.enterApp(msg);                                     // 1. 先渲染
    if (shell) { shell.classList.add('cmDesk-appin'); setTimeout(function () { shell.classList.remove('cmDesk-appin'); }, 700); }
    if (overlay && overlay.classList.contains('hidden')) {    // 2. 遮罩回顶淡出
      overlay.classList.remove('hidden');
      overlay.style.transition = 'none';
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';
      void overlay.offsetWidth;                               // 强制回流锁定起始态
      overlay.style.transition = 'opacity .6s ease, transform .6s ease';
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(1.045)';
      setTimeout(function () {
        overlay.classList.add('hidden');
        overlay.style.transition = ''; overlay.style.opacity = ''; overlay.style.transform = '';
      }, 620);
    }
  }

  /* ---------- 4b. 新手示例体验（v1.0.9）：示例数据 + 对应位置弹窗指引 + 完成/跳过自动清除 ----------
     安全设计：
     · 注入前把受影响字段快照进 sessionStorage（同一会话内可恢复；跨会话由 boot 幂等清扫兜底）；
     · 示例 id 全部落在 990001+ 区间，与真实自增 id（从 1 起）永不冲突；
     · 清除 = 恢复快照 + saveData + renderAll，用户在体验期间写入的真实数据一律保留。 ---------- */
  var CM_TOUR_FLAG = 'cmSampleTour';
  var CM_TOUR_SNAP = 'cmSampleSnap';
  var CM_TOUR_STEPS = [
    { page: 'dashboard', icon: '🏠', title: '工作台首页', text: '课表、班级人数、今日实到都在这里。示例班级「高2026级一班」已放好 6 名学生，学分分布图有真实形状。' },
    { page: 'students', icon: '👥', title: '学生名册', text: '示例学生列在这里。正式使用时到 设置 → 数据管理 →「批量导入学生表格」，Excel/CSV 一键导入真实名单。' },
    { page: 'credits', icon: '⭐', title: '学分管理', text: '点学生加减分，全程留痕。示例里已有 18 条流水可试撤销/恢复，「数据分析」的图表用的就是这份数据。' },
    { page: 'attendance', icon: '🗓️', title: '考勤请假', text: '登记请假自动算时长、销假自动恢复实到；值日、点名也从侧栏进入。' },
    { page: 'settings', icon: '⚙️', title: '设置 · 桌面版专属', text: '「🔐 安全（桌面版）」改密码、「关于本系统」检查更新、导出备份都在这里。' }
  ];

  function cmSampleInject() {
    try {
      var snap = {
        className: state.className,
        classNameFull: state.classNameFull,
        classMotto: state.classMotto,
        nextId: state.nextId,
        nextOpId: state.nextOpId,
        nextExamId: state.nextExamId,
        students: JSON.parse(JSON.stringify(state.students)),
        operations: JSON.parse(JSON.stringify(state.operations)),
        exams: JSON.parse(JSON.stringify(state.exams || []))
      };
      sessionStorage.setItem(CM_TOUR_SNAP, JSON.stringify(snap));
      lsSet(CM_TOUR_FLAG, '1');
      var names = ['陈曦', '林浩然', '苏雨桐', '王一鸣', '赵可欣', '周子墨'];
      for (var i = 0; i < names.length; i++) {
        state.students.push({ id: 990001 + i, sid: 'S2026' + ('0' + (i + 1)).slice(-2), name: names[i], credit: 100, tags: [] });
      }
      /* v1.3.0 示例升级：18 条流水铺满五档学分 + 一场期中考试（3 科，含 1 名两科不及格学生触发学业预警），
         让首页分布 / 数据分析（成绩+学分）/ 学分公示的图表开箱即有真实形状。
         不变式保持：credit = 100（基准）+ Σ本人流水；示例 id 全落 990001–990999；加分时总分均 ≥100 → coin 全额。 */
      var opsData = [
        [990001, 990001, '陈曦', 2, '课堂表现优秀', 0],
        [990002, 990001, '陈曦', 5, '作业按时完成', 1],
        [990003, 990001, '陈曦', 15, '期中考试进步显著', 3],
        [990004, 990002, '林浩然', 10, '值日认真负责', 0],
        [990005, 990002, '林浩然', 8, '帮同学讲解难题', 4],
        [990006, 990003, '苏雨桐', 20, '作文比赛一等奖', 1],
        [990007, 990003, '苏雨桐', 18, '期中考试年级前二十', 3],
        [990008, 990003, '苏雨桐', 12, '课堂笔记被评为示范', 5],
        [990009, 990003, '苏雨桐', 8, '主动帮忙布置教室', 6],
        [990010, 990004, '王一鸣', -15, '上课讲话', 2],
        [990011, 990004, '王一鸣', -12, '作业未交', 5],
        [990012, 990005, '赵可欣', 20, '数学竞赛一等奖', 0],
        [990013, 990005, '赵可欣', 20, '英语演讲比赛冠军', 2],
        [990014, 990005, '赵可欣', 20, '期中考试班级第一', 4],
        [990015, 990005, '赵可欣', 18, '运动会打破校纪录', 5],
        [990016, 990005, '赵可欣', 22, '被评为市级三好学生', 6],
        [990017, 990006, '周子墨', -20, '与同学冲突', 1],
        [990018, 990006, '周子墨', -25, '多次未交作业', 6]
      ];
      opsData.forEach(function (r) {
        state.operations.unshift({
          id: r[0], studentId: r[1], studentName: r[2], amount: r[3],
          coin: r[3] > 0 ? r[3] : 0,
          reason: r[4] + '（示例）', time: Date.now() - r[5] * 86400000 - (r[0] % 9) * 1800000
        });
      });
      var finalCredits = { 990001: 122, 990002: 118, 990003: 158, 990004: 73, 990005: 200, 990006: 55 };
      state.students.forEach(function (s) { if (finalCredits[s.id] !== undefined) s.credit = finalCredits[s.id]; });
      var sd = new Date(); sd.setDate(sd.getDate() - 3);
      var sdate = sd.getFullYear() + '-' + ('0' + (sd.getMonth() + 1)).slice(-2) + '-' + ('0' + sd.getDate()).slice(-2);
      state.exams = state.exams || [];
      state.exams.push({
        id: 990001, name: '期中考试（示例）', date: sdate, subjects: ['语文', '数学', '英语'],
        scores: {
          990001: { '语文': 88, '数学': 92, '英语': 85 },
          990002: { '语文': 76, '数学': 81, '英语': 79 },
          990003: { '语文': 91, '数学': 95, '英语': 93 },
          990004: { '语文': 65, '数学': 70, '英语': 68 },
          990005: { '语文': 84, '数学': 88, '英语': 90 },
          990006: { '语文': 48, '数学': 52, '英语': 61 }
        }
      });
      state.nextExamId = Math.max(state.nextExamId || 1, 990002);
      state.className = '高2026级一班';
      state.classNameFull = '高2026级一班';
      state.nextId = Math.max(state.nextId, 990007);
      state.nextOpId = Math.max(state.nextOpId, 990019);
      if (appFn('saveData')) saveData();
      if (appFn('renderAll')) renderAll();
      return true;
    } catch (e) { return false; }
  }

  function cmSampleCleanup(keepToast) {
    try {
      lsDel(CM_TOUR_FLAG);
      var raw = null;
      try { raw = sessionStorage.getItem(CM_TOUR_SNAP); } catch (e) {}
      if (raw) {
        var snap = JSON.parse(raw);
        state.className = snap.className;
        state.classNameFull = snap.classNameFull;
        state.classMotto = snap.classMotto;
        state.nextId = snap.nextId;
        state.nextOpId = snap.nextOpId;
        state.nextExamId = snap.nextExamId;
        state.students = JSON.parse(JSON.stringify(snap.students));
        state.operations = JSON.parse(JSON.stringify(snap.operations));
        state.exams = JSON.parse(JSON.stringify(snap.exams || []));
      } else {
        // 跨会话兜底：快照已不可得，按示例 id 区间（990001–990999）剔除
        state.students = state.students.filter(function (s) { return !(s.id >= 990001 && s.id <= 990999); });
        state.operations = state.operations.filter(function (o) { return !(o.id >= 990001 && o.id <= 990999); });
        state.exams = (state.exams || []).filter(function (e) { return !(e.id >= 990001 && e.id <= 990999); });
        state.nextId = state.students.reduce(function (m, s) { return Math.max(m, s.id + 1); }, 1);
        state.nextOpId = state.operations.reduce(function (m, o) { return Math.max(m, o.id + 1); }, 1);
        state.nextExamId = (state.exams || []).reduce(function (m, e) { return Math.max(m, e.id + 1); }, state.nextExamId || 1);
        state.classNameFull = '';
      }
      try { sessionStorage.removeItem(CM_TOUR_SNAP); } catch (e) {}
      if (appFn('saveData')) saveData();
      if (appFn('renderAll')) renderAll();
      if (!keepToast && appFn('showToast')) window.showToast('示例数据已清除，工作台已恢复空白，正式开始吧！', 'success');
    } catch (e) {}
  }

  function cmStartTour() {
    if (lsGet(CM_TOUR_FLAG) !== '1') return;
    var idx = 0;
    function detach() {
      var b = document.getElementById('cmDeskGuide');
      if (b) b.remove();
      var hls = document.querySelectorAll('.cmDesk-guide-hl');
      for (var i = 0; i < hls.length; i++) hls[i].classList.remove('cmDesk-guide-hl');
    }
    function stop() { detach(); cmSampleCleanup(false); }
    function show() {
      var st = CM_TOUR_STEPS[idx];
      var last = idx === CM_TOUR_STEPS.length - 1;
      var nav = appFn('navigateTo');
      if (nav) nav(st.page);
      detach();
      var anchor = document.querySelector('.nav-item[data-page="' + st.page + '"]');
      if (anchor) anchor.classList.add('cmDesk-guide-hl');
      var b = el('div', 'cmDesk-guide');
      b.id = 'cmDeskGuide';
      b.innerHTML =
        '<div class="cmDesk-gstep">' + st.icon + ' 新手指引 · ' + (idx + 1) + ' / ' + CM_TOUR_STEPS.length + '</div>' +
        '<div class="cmDesk-gtitle">' + st.title + '</div>' +
        '<div class="cmDesk-gtext">' + st.text + '</div>' +
        '<div class="cmDesk-gbtns">' +
        '<button class="btn btn-outline btn-sm" id="cmGuideSkip">跳过并清除示例</button>' +
        '<button class="btn btn-primary btn-sm" id="cmGuideNext"><span>' + (last ? '完成体验 ✓' : '下一步') + '</span></button>' +
        '</div>';
      document.body.appendChild(b);
      if (anchor) {
        var r = anchor.getBoundingClientRect();
        b.style.left = Math.max(12, Math.min(r.right + 12, window.innerWidth - 316)) + 'px';
        b.style.top = Math.max(12, Math.min(r.top - 6, window.innerHeight - 260)) + 'px';
      } else {
        b.style.left = '50%'; b.style.top = '90px'; b.style.transform = 'translateX(-50%)';
      }
      b.querySelector('#cmGuideSkip').onclick = function () { stop(); };
      b.querySelector('#cmGuideNext').onclick = function () {
        if (last) stop();
        else { idx++; show(); }
      };
    }
    show();
  }

  // 等工作台真正可见（零密码过渡 / 密码登录两条路都会被它接住）再起指引
  function cmTourWatch() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (lsGet(CM_TOUR_FLAG) !== '1') { clearInterval(t); return; }
      var ov = document.getElementById('loginOverlay');
      var overlayGone = !ov || ov.classList.contains('hidden');
      var appEl = document.querySelector('.app');
      if (overlayGone && appEl && appEl.offsetParent !== null) {
        clearInterval(t);
        setTimeout(cmStartTour, 700);
      } else if (tries > 240) { clearInterval(t); }
    }, 500);
  }

  /* ---------- 5. 无密码登录面板（自包含样式，禁用网页版 .login-card 横排双栏布局） ---------- */
  function patchLogin() {
    var overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    if (!userLoginPwdSet() && lsGet(LS_NOPWD) === '1') {
      overlay.innerHTML =
        '<div class="cmDesk-login-card">' +
        '<div class="cmDesk-logo">班</div>' +
        '<h2 class="cmDesk-login-title">班主任工作台</h2>' +
        '<div class="cmDesk-login-sub">🔓 无密码模式 · 数据仅保存在本机</div>' +
        '<button class="btn btn-primary" id="cmDeskEnter">直接进入</button>' +
        '<div class="cmDesk-login-sub" style="margin-top:14px">想加密码？设置 → 🔐 安全</div>' +
        '<div class="cmDesk-copy">© 2026 <b>chee</b> · 班主任工作台 · 保留所有权利</div>' +
        '</div>';
      var btn = overlay.querySelector('#cmDeskEnter');
      if (btn) btn.onclick = function () { enterWithTransition('欢迎回来！'); };
    }
  }

  /* ---------- 6. 桌面版安全设置卡（v1.4.1 v2：修改/关闭双操作 + 管理员授权链） ----------
     老板拍板：登录密码、管理员密码均可修改与关闭；管理员密码可授权修改/关闭登录密码。
     关闭登录密码 = 回零密码模式（打开即用）；关闭管理员密码 = 清空数据退回「清空」二字确认。 */
  function gxAdminVerify(onPass) {
    cmDeskPrompt({
      title: '🔐 管理员密码验证',
      body: '此操作涉及登录密码变更，请先输入管理员密码：',
      type: 'password', maxlen: 20, okText: '验证',
      onOk: function (v) {
        if (window.verifyAdminPwd && window.verifyAdminPwd(v)) { onPass(); return true; }
        return '管理员密码错误';
      }
    });
  }
  function gxPwdModal(title, apply) {
    var mask = el('div', 'cmDesk-mask');
    var box = el('div', 'cmDesk-modal');
    box.appendChild(el('div', 'cmDesk-title', title));
    var body = el('div', 'cmDesk-body');
    var i1 = el('input', 'cmDesk-input'); i1.type = 'password'; i1.maxLength = 6; i1.placeholder = '新密码（6 位数字）'; i1.style.width = '100%'; i1.style.boxSizing = 'border-box'; i1.style.marginBottom = '8px';
    var i2 = el('input', 'cmDesk-input'); i2.type = 'password'; i2.maxLength = 6; i2.placeholder = '再输一遍'; i2.style.width = '100%'; i2.style.boxSizing = 'border-box';
    body.appendChild(i1); body.appendChild(i2);
    box.appendChild(body);
    var row = el('div', 'cmDesk-row');
    var cancel = el('button', 'btn btn-outline', '取消');
    var ok = el('button', 'btn btn-primary', '保存');
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    mask.appendChild(box);
    document.body.appendChild(mask);
    function close() { gxCloseMask(mask); }
    cancel.onclick = function () { close(); };
    mask.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    ok.onclick = function () {
      var a = i1.value, b = i2.value;
      if (!isSixDigits(a)) { i1.value = ''; i1.focus(); return '请输满 6 位数字'; }
      if (a !== b) return '两次输入不一致';
      if (weakPattern(a)) return '密码过于简单（重复/连号）';
      apply(a);
      close();
    };
    i1.focus();
    i1.addEventListener('keydown', function (e) { if (e.key === 'Enter') i2.focus(); });
    i2.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); });
  }
  function buildSecurityCard() {
    if (document.getElementById('cmDeskSecurity')) return;
    var hs = document.querySelectorAll('.settings-section h3');
    var anchor = null;
    for (var i = 0; i < hs.length; i++) if (hs[i].textContent.indexOf('危险操作') >= 0) { anchor = hs[i].closest('.settings-section'); break; }
    if (!anchor) return;
    var card = el('div', 'settings-section');
    card.id = 'cmDeskSecurity';
    card.innerHTML =
      '<h3>' + gxIc('lock') + ' 安全（桌面版）</h3>' +
      '<div class="gxSec-hint">登录密码 = 打开应用时输入；管理员密码 = 敏感操作授权（清空数据、改登录密码）。均不可找回，请牢记。</div>' +
      '<div class="gxSec-row"><span class="gxSec-k">登录密码</span><span class="gxSec-state" id="gxSecLoginState"></span>' +
      '<span class="gxSec-acts"><button class="btn btn-outline btn-sm" id="gxSecLoginEdit">' + gxIc('pen-line') + ' 修改</button>' +
      '<button class="btn btn-outline btn-sm" id="gxSecLoginOff" style="color:var(--danger,#B42318)">' + gxIc('x') + ' 关闭</button></span></div>' +
      '<div class="gxSec-row"><span class="gxSec-k">管理员密码</span><span class="gxSec-state" id="gxSecAdminState"></span>' +
      '<span class="gxSec-acts"><button class="btn btn-outline btn-sm" id="gxSecAdminEdit">' + gxIc('pen-line') + ' 修改</button>' +
      '<button class="btn btn-outline btn-sm" id="gxSecAdminOff" style="color:var(--danger,#B42318)">' + gxIc('x') + ' 关闭</button></span></div>' +
      '<div class="gxSec-note">修改/关闭「登录密码」时若已设置管理员密码，需先验证管理员密码；关闭登录密码后回到零密码模式（打开即用）。</div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">© 2026 chee · 班主任工作台 · 保留所有权利</div>';
    anchor.parentNode.insertBefore(card, anchor);
    function gxSec(name) { return document.getElementById(name); }
    function refreshState() {
      gxSec('gxSecLoginState').textContent = userLoginPwdSet() ? '已设置' : '未设置（零密码模式）';
      gxSec('gxSecAdminState').textContent = userAdminPwdSet() ? '已设置' : '未设置（清空数据用「清空」二字确认）';
      gxSec('gxSecLoginEdit').style.visibility = '';
      gxSec('gxSecLoginOff').style.visibility = userLoginPwdSet() ? '' : 'hidden';
      gxSec('gxSecAdminOff').style.visibility = userAdminPwdSet() ? '' : 'hidden';
    }
    function doSetLogin(a) {
      lsSet(K_LOGIN, window.hashPwd(a)); lsDel(LS_NOPWD); refreshState();
      if (window.showToast) window.showToast('登录密码已更新，下次打开生效', 'success');
    }
    function doOffLogin() {
      lsDel(K_LOGIN); lsSet(LS_NOPWD, '1'); refreshState();
      if (window.showToast) window.showToast('登录密码已关闭：下次打开直接进入（零密码模式）', 'success');
    }
    function doSetAdmin(a) {
      lsSet(K_ADMIN, window.hashPwd(a)); lsSet(USER_SET_ADMIN, '1'); refreshState();
      if (window.showToast) window.showToast('管理员密码已更新', 'success');
    }
    function doOffAdmin() {
      lsDel(K_ADMIN); lsDel(USER_SET_ADMIN); refreshState();
      if (window.showToast) window.showToast('管理员密码已关闭：敏感操作退回「清空」二字确认', 'success');
    }
    gxSec('gxSecLoginEdit').onclick = function () {
      if (userAdminPwdSet()) gxAdminVerify(function () { gxPwdModal('修改登录密码', doSetLogin); });
      else gxPwdModal('设置登录密码', doSetLogin);
    };
    gxSec('gxSecLoginOff').onclick = function () {
      if (userAdminPwdSet()) gxAdminVerify(function () {
        cmDeskPrompt({ title: '关闭登录密码', body: '关闭后<b>打开应用不再需要密码</b>（零密码模式）。确认关闭？', okText: '确认关闭', onOk: function () { doOffLogin(); return true; } });
      });
      else cmDeskPrompt({ title: '关闭登录密码', body: '关闭后<b>打开应用不再需要密码</b>（零密码模式）。确认关闭？', okText: '确认关闭', onOk: function () { doOffLogin(); return true; } });
    };
    gxSec('gxSecAdminEdit').onclick = function () {
      if (userAdminPwdSet()) gxAdminVerify(function () { gxPwdModal('修改管理员密码', doSetAdmin); });
      else gxPwdModal('设置管理员密码', doSetAdmin);
    };
    gxSec('gxSecAdminOff').onclick = function () {
      if (!userAdminPwdSet()) return;
      gxAdminVerify(function () {
        cmDeskPrompt({ title: '关闭管理员密码', body: '关闭后<b>清空数据等敏感操作退回「清空」二字确认</b>，保护等级降低。确认关闭？', okText: '确认关闭', onOk: function () { doOffAdmin(); return true; } });
      });
    };
    refreshState();
  }

  /* ---------- 7. 关于卡桌面版化（检查更新第一栏 + 介绍重写） ---------- */
  function enhanceAbout() {
    var about = document.getElementById('settingsAbout');
    if (!about || about.querySelector('.cmDeskAbout')) return;

    /* 检查更新栏：关于卡第一栏（紧随标题），按钮加大突出；
       Microsoft Store 版（v1.4.2）：不渲染检查更新按钮，改为商店渠道说明行。 */
    var btn = null, status = null;
    if (window.__CM_UPDATER && D.store) {
      var srow = el('div', 'cmDeskUpd');
      srow.style.cssText = 'margin:12px 0 4px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:var(--row-bg,#FBF8F1);border:1px solid var(--border,#E6DECD);border-radius:10px';
      var schip = el('span', 'cmDeskStoreBadge', 'Microsoft Store 版');
      schip.style.cssText = 'display:inline-flex;align-items:center;padding:4px 14px;border-radius:999px;background:rgba(201,162,39,.10);border:1px solid var(--gold,#C9A227);color:var(--gold,#C9A227);font-weight:700;font-size:12.5px;letter-spacing:.5px';
      status = el('span', 'cmDeskUpdStatus');
      status.style.cssText = 'font-size:13px;color:var(--text-secondary,#5F5E5A)';
      status.textContent = '当前版本 v' + D.version + ' · 更新由 Microsoft Store 自动管理';
      srow.appendChild(schip); srow.appendChild(status);
      var sah3 = about.querySelector('h3');
      if (sah3) sah3.parentNode.insertBefore(srow, sah3.nextSibling);
      else about.appendChild(srow);
    } else if (window.__CM_UPDATER) {
      var row = el('div', 'cmDeskUpd');
      row.style.cssText = 'margin:12px 0 4px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:var(--row-bg,#FBF8F1);border:1px solid var(--border,#E6DECD);border-radius:10px';
      btn = el('button', 'btn btn-primary', '🔄 检查更新');
      btn.style.cssText = 'padding:8px 20px;font-size:13.5px;position:relative;min-width:130px';
      status = el('span', 'cmDeskUpdStatus');
      status.style.cssText = 'font-size:13px;color:var(--text-secondary,#5F5E5A)';
      status.textContent = '当前版本 v' + D.version;
      row.appendChild(btn); row.appendChild(status);
      var ah3 = about.querySelector('h3');
      if (ah3) ah3.parentNode.insertBefore(row, ah3.nextSibling);
      else about.appendChild(row);
    }

    /* 桌面版介绍卡（v1.2.6 重写）：本版更新简要（≤100 字）+ 单机版一句话，不再出现网页版字样 */
    var intro = el('div', 'cmDeskAbout');
    intro.style.cssText = 'margin:10px 0 12px;padding:10px 12px;background:var(--row-bg,#FBF8F1);border:1px dashed var(--border,#E6DECD);border-radius:10px;font-size:12.5px;color:var(--text-secondary,#5F5E5A);line-height:1.9';
    intro.innerHTML =
      '📦 <b>桌面版 v' + D.version + ' 更新</b>：兑换商店大版本（15 件默认商品、扫码核销、补齐按钮）；新增学生查询端（学号+专属码，扫码卡一键查询）与学生自助兑换；学分批量按寝室加减分、劳动整改批量多选；查询提速至秒级。<br>' +
      '🖥️ 单机版：数据仅保存在这台电脑上；' + (D.store ? '通过 Microsoft Store 安装，更新由商店自动管理。' : '自动更新——发现新版左下角弹窗询问后进行。') + '<br>' +
      '<span style="color:var(--text-muted,#8C8577)">' + COPYRIGHT + ' · 转发分享请保留开发者署名</span>';
    var rows = about.querySelectorAll(':scope > div');
    var badgeRow = null;
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri].querySelector('span') && rows[ri].textContent.indexOf('🏷️') >= 0) { badgeRow = rows[ri]; break; }
    }
    if (badgeRow) badgeRow.parentNode.insertBefore(intro, badgeRow.nextSibling);
    else about.appendChild(intro);

    /* 桌面版 v1.0.9：移除「网页版近版更新速览」整块（桌面版无网页版语境，老板拍板撤下）。
       #settingsReleaseNotes 的 parentElement = 虚线容器（含折叠标题 + 速览正文），删它即整块摘除。 */
    var sn = document.getElementById('settingsReleaseNotes');
    if (sn && sn.parentElement) sn.parentElement.remove();

    /* 打赏入口（v1.0.10）：微信 + 支付宝双渠道，关于卡常驻卡 + 满 3 天一次性提醒。
       素材随构建分发，缺资产时按钮自动隐藏（见下方 CM_DONATE 模块注释）。 */
    buildDonateRow(about);

    /* 反馈卡（v1.0.11）：邮件直达作者 + 点邮箱一键复制 */
    buildFeedbackRow(about);

    /* 应用内更新逻辑（仅 NSIS 直装版接线；Microsoft Store 版 btn=null 跳过——更新由商店管理） */
    if (!window.__CM_UPDATER || !btn) return;

    function setStatus(txt, color) { status.textContent = txt; status.style.color = color || 'var(--text-muted)'; }
    var handling = false;
    var cmUpdFeed = null; // 最近一次检查实际使用的更新源（择源结果，供无更新分支显示）
    function checkNow(manual) {
      if (handling) return;
      handling = true;
      cmUpdManual = !!manual;
      setStatus('正在检查…');
      window.__CM_UPDATER.check().then(function (r) {
        handling = false;
        if (!r || !r.ok) { setStatus('检查失败：' + ((r && r.message) || '网络不通，稍后再试'), 'var(--danger)'); cmUpdCloseToast(); return; }
        cmUpdFeed = r.feed || cmUpdFeed;
        if (r.version && r.version === D.version) { setStatus('已是最新版本 v' + D.version + (cmUpdFeed ? '（源：' + cmUpdFeed + '）' : '')); cmUpdCloseToast(); }
      }).catch(function (e) {
        handling = false;
        setStatus('检查失败：' + String(e && e.message || e).slice(0, 60), 'var(--danger)');
      });
    }
    btn.onclick = function () { checkNow(true); };

    window.__CM_UPDATER.onEvent(function (ev) {
      if (!ev) return;
      if (ev.state === 'checking') setStatus('正在检查…');
      else if (ev.state === 'available') {
        setStatus('发现新版 v' + ev.version + '，等待选择');
        if (cmUpdManual || !cmUpdDeclined) cmUpdToast({ state: 'available', version: ev.version });
      } else if (ev.state === 'none') {
        setStatus('已是最新版本 v' + D.version + (cmUpdFeed ? '（源：' + cmUpdFeed + '）' : '')); cmUpdCloseToast();
      } else if (ev.state === 'downloading') {
        setStatus('正在下载新版… ' + ev.percent + '%（' + ev.mb + ' MB）');
        cmUpdToast({ state: 'downloading', percent: ev.percent, mb: ev.mb });
      } else if (ev.state === 'ready') {
        setStatus('✅ 新版 v' + ev.version + ' 已就绪：点「立即重启」自动安装并重启', 'var(--success)');
        cmUpdToast({ state: 'ready', version: ev.version });
        if (!cmUpdReadyToasted && typeof window.showToast === 'function') {
          cmUpdReadyToasted = true;
          window.showToast('新版本已就绪，重启应用即完成安装', 'success');
        }
      } else if (ev.state === 'error') {
        setStatus('更新出错：' + (ev.message || '网络问题，稍后再试'), 'var(--danger)');
        cmUpdToast({ state: 'error', message: ev.message });
      }
    });

    // 启动静默检查（一次，30 秒后——避开启动高峰与弱网首屏）
    setTimeout(function () { checkNow(false); }, 30000);
  }

  /* ---------- 打赏入口（微信 + 支付宝双渠道，自愿/零捆绑） ----------
     三处触点：①关于卡常驻「请作者喝杯奶茶」卡片 → 双渠道选择弹窗
              ②使用满 3 天起，每满 3 天弹一轮诙谐提醒（cmDonateNudgeAt 记上次弹出时间；
                弹窗「下次一定」只关本轮弹窗，下次启动到点再弹）
              ③（落地页另有同款，独立实现）
     渠道徽标色：微信 07C160 / 支付宝 1677FF。爱发电暂缓（老板拍板）。 ---------- */
  var CM_DONATE = { wechatImg: 'donate-wechat.png', alipayImg: 'donate-alipay.png' };
  var CM_NUDGE_AT = 'cmDonateNudgeAt';
  var CM_NUDGE_DAYS = 3;

  /* 双渠道选择弹窗：两张码并排，注明渠道让用户挑着扫 */
  function cmDonateModal() {
    var old = document.getElementById('cmDeskDonateModal');
    if (old) { old.remove(); return; }
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskDonateModal';
    m.innerHTML =
      '<div class="cmDesk-donate-card">' +
      '<button class="cmDesk-donate-close" id="cmDonateClose" aria-label="关闭">×</button>' +
      '<h3>🧧 请作者喝杯奶茶</h3>' +
      '<p class="cmDesk-donate-lead">微信还是支付宝，您挑顺手的扫。金额随意，心意收下。</p>' +
      '<div class="cmDesk-donate-duo">' +
      '<figure class="cmDesk-donate-ch"><img src="' + CM_DONATE.wechatImg + '" alt="微信收款码"><figcaption><i style="background:#07C160"></i>微信支付</figcaption></figure>' +
      '<figure class="cmDesk-donate-ch"><img src="' + CM_DONATE.alipayImg + '" alt="支付宝收款码"><figcaption><i style="background:#1677FF"></i>支付宝</figcaption></figure>' +
      '</div>' +
      '<p class="cmDesk-donate-note">免费功能永久免费，Pro 一次买断——这笔钱只影响作者期末夜的伙食质量。</p>' +
      '<div class="cmDesk-donate-actions"><button class="btn btn-outline btn-sm" id="cmDonateLater">下次一定</button></div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.id === 'cmDonateClose') m.remove();
    });
    var later = m.querySelector('#cmDonateLater');
    if (later) later.onclick = function () { m.remove(); };
  }

  /* 满天弹窗：一个班主任的小声叭叭（每满 3 天一轮；「下次一定」只关本轮弹窗） */
  function cmNudgeMaybe() {
    if (cmProActive()) return;   // 已买断：不再弹赞赏提醒（D 批复）
    var t0 = parseInt(lsGet(LS_ONBOARD), 10);
    if (!t0 || Date.now() - t0 < CM_NUDGE_DAYS * 86400000) return;
    var last = parseInt(lsGet(CM_NUDGE_AT), 10) || 0;
    if (last && Date.now() - last < CM_NUDGE_DAYS * 86400000) return;
    /* 旧版（v1.0.10/11）一次性标记迁移：视为「刚提醒过」，3 天后进入周期提醒 */
    if (lsGet('cmDonateNudge') === '1') { lsSet(CM_NUDGE_AT, String(Date.now())); lsSet('cmDonateNudge', ''); return; }
    lsSet(CM_NUDGE_AT, String(Date.now()));   // 无论后续选哪边，本轮已打扰，隔 3 天再来
    var old = document.getElementById('cmDeskNudge');
    if (old) old.remove();
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskNudge';
    m.innerHTML =
      '<div class="cmDesk-donate-card cmDesk-nudge">' +
      '<h3>📖 一个班主任的小声叭叭</h3>' +
      '<p class="cmDesk-nudge-p">这个工具没有广告、也不办会员；已发布的所有功能永久免费，新增的 Pro 是一次买断的升级，不搞订阅。</p>' +
      '<p class="cmDesk-nudge-p">它值多少钱，取决于它替你省了多少操心。如果某个期末夜，是它陪你熬过来的——</p>' +
      '<p class="cmDesk-nudge-p">可以考虑请作者喝杯奶茶。不请也完全没事，免费功能一分不减，作者照写不误，就是鸡腿会少一根。</p>' +
      '<div class="cmDesk-gbtns" style="justify-content:center;margin-top:14px">' +
      '<button class="btn btn-outline btn-sm" id="cmNudgeLater">下次一定</button>' +
      '<button class="btn btn-primary btn-sm" id="cmNudgeYes"><span>🧧 请作者喝一杯</span></button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    m.querySelector('#cmNudgeLater').onclick = close;
    m.querySelector('#cmNudgeYes').onclick = function () { close(); cmDonateModal(); };
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
  }

  /* 等工作台可见再弹（顺带避开新手示例体验期间） */
  function cmNudgeWatch() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ov = document.getElementById('loginOverlay');
      var overlayGone = !ov || ov.classList.contains('hidden');
      var appEl = document.querySelector('.app');
      var busy = lsGet('cmSampleTour') === '1' || document.getElementById('cmDeskNudge');
      if (overlayGone && appEl && appEl.offsetParent !== null && !busy) {
        clearInterval(t);
        setTimeout(cmNudgeMaybe, 8000);   // 进来先干活，8 秒后再小声说话
      } else if (tries > 480) { clearInterval(t); }
    }, 500);
  }

  /* 常驻卡片（v1.0.12 定稿）：设置页「关于本系统」上方单独成卡，常驻不消失。
     周期提醒由满天弹窗负责（每 3 天一轮），卡片本身不打扰。 */
  function buildDonateRow(about) {
    var hasAny = !!(CM_DONATE.wechatImg || CM_DONATE.alipayImg);
    if (cmProActive()) { if (about) buildProActiveCard(about); return; }   // D1：买断后换「Pro 已激活」卡
    if (!hasAny || !about) return;
    if (document.getElementById('cmDeskDonateSec')) return;
    var sec = el('div', 'settings-section cmDeskDonateSec');
    sec.id = 'cmDeskDonateSec';
    sec.innerHTML =
      '<h3>☕ 请作者喝杯奶茶</h3>' +
      '<div class="cmDeskDonate-t">自愿 · 无广告无订阅，已发布功能永久免费——但奶茶能让更新写得更快。</div>' +
      '<div class="cmDeskDonate-r">' +
      '<button class="btn btn-primary" id="cmDonateOpen" style="padding:10px 30px;font-size:14.5px;position:relative;min-width:150px"><span>🧧 打赏作者</span><span class="arr">→</span></button>' +
      '<span class="cmDeskDonate-hint">微信 / 支付宝均可</span>' +
      '</div>';
    sec.querySelector('#cmDonateOpen').onclick = cmDonateModal;
    about.parentNode.insertBefore(sec, about);
  }

  /* 反馈卡（v1.0.11；v1.2.6 独立成卡）：设置页独立 settings-section，排在「关于本系统」上方 */
  var CM_MAIL = '846699191@qq.com';
  function cmCopyFallback(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      var done = document.execCommand('copy');
      ta.remove(); return done;
    } catch (e) { return false; }
  }
  function cmCopyText(txt) {
    var ok = function () { if (window.showToast) window.showToast('邮箱已复制', 'success'); };
    var bad = function () { if (window.showToast) window.showToast('复制失败，请手动记录邮箱', 'error'); };
    cmProCopy(txt, ok, bad);
  }
  /* 统一复制（v1.1.1）：主进程 clipboard 直写（file:// 下 navigator.clipboard 不可靠）→ execCommand 兜底 */
  function cmProCopy(txt, ok, bad) {
    var fail = function () { (cmCopyFallback(txt) ? ok : bad)(); };
    try {
      if (window.__CM_CLIP && window.__CM_CLIP.write) {
        window.__CM_CLIP.write(txt).then(function (r) { (r && r.ok) ? ok() : fail(); }, fail);
      } else fail();
    } catch (e) { fail(); }
  }
  function buildFeedbackRow(about) {
    if (document.querySelector('.cmDeskFeedback')) return;
    var sec = el('div', 'settings-section cmDeskFeedback');
    sec.innerHTML =
      '<h3>✉️ 反馈与建议</h3>' +
      '<div class="cmDeskDonate-t">遇到问题、有想法，直接发邮件给作者——看到就会回。</div>' +
      '<div class="cmDeskDonate-r">' +
      '<button class="btn btn-outline btn-sm" id="cmFbMail"><span>✉ 写邮件给作者</span><span class="arr">→</span></button>' +
      '<span class="cmDeskFbMail" id="cmFbCopy" title="点击复制邮箱">' + CM_MAIL + '</span>' +
      '</div>';
    sec.querySelector('#cmFbMail').onclick = function () {
      if (window.__CM_FEEDBACK && window.__CM_FEEDBACK.mail) {
        window.__CM_FEEDBACK.mail();          // 桌面：唤起系统邮件客户端（收件人主进程定死）
      } else { cmCopyText(CM_MAIL); }         // 非桌面环境兜底：复制邮箱
    };
    sec.querySelector('#cmFbCopy').onclick = function () { cmCopyText(CM_MAIL); };
    if (about && about.parentNode) about.parentNode.insertBefore(sec, about);   // 独立卡：排在「关于本系统」上方
    else document.body.appendChild(sec);
  }

  /* ---------- Pro 授权（v1.1.0）：gate + 引导弹窗 + 激活 ----------
     原则：导出按钮 UI 不变，点击才拦；每会话每功能只弹一次引导框；
     验签在主进程（__CM_PRO 桥），渲染层只做展示与状态缓存。 */
  var CM_PRO_LS = 'cmProCache';
  var CM_PRO_BUY_URL = 'https://afdian.com/item/e4cf1936c3d611f19ca752540025c377';   // 爱发电 Pro 商品页（2026-10-09 老板开店后替换）
  /* v1.4.2 Microsoft Store 版合规：商店政策限制「应用内直链站外购买数字商品」——
     商店版构建把升级 Pro 的购买入口指向官网落地页（落地页有爱发电入口），NSIS 直装版保持直连爱发电。 */
  function cmBuyUrl() {
    return (window.__CM_DESKTOP && window.__CM_DESKTOP.store)
      ? 'https://cheeeom.github.io/class-manager-desktop/'
      : CM_PRO_BUY_URL;
  }
  var CM_PRO_SESSION = {};                                // 本会话已弹过的功能
  /* 开发者模式（v1.2.4）：渲染层模拟激活/未激活，不碰真实激活文件。
     入口 = 3 秒内连点侧栏版本文字 5 次；badge 常驻右下角，点开浮动面板。 */
  var cmDevOn = false, cmDevOverride = null, cmDevTaps = 0, cmDevTapTs = 0;
  function cmProCache() {
    try { return JSON.parse(lsGet(CM_PRO_LS) || '{}'); } catch (e) { return {}; }
  }
  function cmProActive() {
    if (cmDevOverride !== null) return cmDevOverride === true;   // 开发者模拟优先（仅渲染层）
    return cmProCache().active === true;
  }
  function cmProRefresh() {
    if (!window.__CM_PRO) return Promise.resolve({ active: false });
    return window.__CM_PRO.status().then(function (r) {
      var c = { active: !!r.active, tier: r.tier || '', sn: r.sn || 0, eh: r.eh || '', lic: r.lic || '' };
      lsSet(CM_PRO_LS, JSON.stringify(c));
      return c;
    });
  }
  function cmProReqCode() {
    var dev = lsGet('cmProDev');
    if (!dev || !/^[0-9a-f]{16}$/.test(dev)) {
      var a = new Uint8Array(8);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
      else for (var i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
      dev = ''; for (var j = 0; j < 8; j++) dev += a[j].toString(16).padStart(2, '0');
      lsSet('cmProDev', dev);
    }
    var h = 0x811c9dc5, src = (lsGet('cmProMail') || '').trim().toLowerCase();
    for (var k = 0; k < src.length; k++) { h ^= src.charCodeAt(k); h = (h * 0x01000193) >>> 0; }
    var eh = ('00000000' + h.toString(16)).slice(-8);
    var b = '';
    try { b = btoa(JSON.stringify({ v: 1, dev: dev, eh: eh })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (e) { b = ''; }
    return b;
  }
  function cmProMaskMail(eh) { return eh && eh !== '00000000' ? 'a***@' + (eh).slice(0, 2) + '（邮箱已加密存档）' : '未留邮箱'; }
  function cmWrapPro(fnName, label) {
    var orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = function () {
      if (cmProActive()) return orig.apply(this, arguments);
      cmProModal(label);
    };
  }
  /* ---------- v1.2.0 页面级 Pro 锁（v1.2.6 放宽：考勤请假/课堂点名转免费） ----------
     免费页 = 工作台首页 / 学生管理 / 班委管理 / 寝室管理 / 座次表 / 值日排班 / 考勤请假 / 课堂点名（导出另锁）/ 设置；
     其余页面进入即高斯模糊 + PRO 弹窗（介绍本页功能 + 引导买断）；关闭弹窗保留模糊 + 悬浮解锁按钮；
     班委协作模式（__cmRole）不受闸——激活是整机级的，班委随本机授权走。 */
  var CM_PRO_PAGES = {
    grades: ['成绩管理', '成绩录入 · 成绩条导出 · 班级对比分析'],
    todo: ['待办提醒', '待办事项 · 重要节点提醒，班务不漏项'],
    worklogs: ['工作留痕', '班务日志 · 图文留痕 · 月度导出，评优述职有据可查'],
    notices: ['通知', '家校通知 · 模板管理 · 一键发送'],
    credits: ['学分记录', '加扣分流水 · 学分币 · 撤销追踪，班级激励引擎'],
    bank: ['学分银行', '学分币钱包 · 商品兑换 · 月度结算，激励体系闭环'],
    publicity: ['学分公示', '公示海报 · 排行榜 · 学分周报，一键生成'],
    honors: ['荣誉墙', '荣誉证书 · 班级荣誉展示墙'],
    analytics: ['数据分析', '学分趋势 · 成绩深度分析 · 预警中心'],
    profiles: ['学生档案', '学生档案卡 · 德育记录 · 成长时间线，一人一档']
  };
  var cmGatePage = null;   // 当前被锁的页面（弹窗关闭后悬浮按钮据此重开）
  function cmBlurTarget(on) {
    var c = document.getElementById('content');
    if (c) c.classList.toggle('cmDesk-blurtarget', !!on);
  }
  function cmPageLockClear() {
    cmGatePage = null;
    cmBlurTarget(false);
    var p = document.getElementById('cmDeskPagePill');
    if (p) p.remove();
  }
  function cmPagePill() {
    if (document.getElementById('cmDeskPagePill')) return;
    var pill = el('button', 'cmDesk-pagepill');
    pill.id = 'cmDeskPagePill';
    pill.textContent = '🔒 解锁 PRO 完整功能';
    pill.onclick = function () {
      pill.remove();
      var info = CM_PRO_PAGES[cmGatePage] || ['学期报告', ''];
      cmProModal(info[0], { intro: info[1], gatePage: cmGatePage });
    };
    document.body.appendChild(pill);
  }
  /* 激活心跳（v1.2.3）：启动后静默复查订单，退款 → 删激活文件（主进程）+ 本地恢复锁态。
     断网/无码 → 主进程返回 checked:false，静默跳过，宁宽勿错。 */
  function cmProRevoke() {
    cmProRefresh().then(function () {
      buildNavPro();                            // 吊销：徽标摘下、角标回来（v1.2.6）
      if (window.showToast) window.showToast('Pro 激活已失效（订单退款或异常），已恢复基础版', 'error');
      var cur = null;
      Object.keys(CM_PRO_PAGES).forEach(function (k) {
        var p = document.getElementById('page-' + k);
        if (p && p.classList.contains('active')) cur = k;
      });
      if (cur && !cmProActive() && window.__cmRole !== 'committee') {
        var info = CM_PRO_PAGES[cur];
        cmGatePage = cur;
        cmBlurTarget(true);
        cmProModal(info[0], { intro: info[1], gatePage: cur });
      }
    });
  }
  function cmProHeartbeat() {
    if (!window.__CM_PRO || !window.__CM_PRO.heartbeat) return;
    window.__CM_PRO.heartbeat().then(function (r) {
      if (r && r.revoked) cmProRevoke();
    }).catch(function () {});
  }
  /* ---------- 开发者模式（v1.2.4）---------- */
  function cmDevCurPage() {
    var cur = null;
    Object.keys(CM_PRO_PAGES).forEach(function (k) {
      var p = document.getElementById('page-' + k);
      if (p && p.classList.contains('active')) cur = k;
    });
    return cur;
  }
  function cmDevApply() {
    var badge = document.getElementById('cmDeskDevBadge');
    if (cmDevOn) {
      if (!badge) {
        badge = el('button', 'cmDesk-devbadge'); badge.id = 'cmDeskDevBadge';
        badge.textContent = 'DEV';
        badge.onclick = function () { cmDevPanel(); };
        document.body.appendChild(badge);
      }
      badge.textContent = 'DEV · ' + (cmDevOverride === null ? '真实' : cmDevOverride ? '模拟已激活' : '模拟未激活');
    } else if (badge) badge.remove();
    buildNavPro();                              // 开发者模拟切换锁态 → 侧栏角标/徽标即时跟随（v1.2.6）
    var cur = cmDevCurPage();
    if (cur) {
      var locked = (cmDevOverride === false) || (cmDevOverride === null && !cmProCache().active);
      if (locked && window.__cmRole !== 'committee') {
        var info = CM_PRO_PAGES[cur];
        cmGatePage = cur;
        cmBlurTarget(true);
        var om = document.getElementById('cmDeskProModal');
        if (om) om.remove();
        cmProModal(info[0], { intro: info[1], gatePage: cur });
      } else {
        cmPageLockClear();
        var om2 = document.getElementById('cmDeskProModal');
        if (om2) om2.remove();
      }
    }
    cmDevRenderPanel();
  }
  function cmDevPanel() {
    var old = document.getElementById('cmDeskDevCard');
    if (old) { old.remove(); return; }
    var c = el('div', 'cmDesk-devcard'); c.id = 'cmDeskDevCard';
    c.innerHTML =
      '<h4>🛠 开发者模式</h4>' +
      '<div class="cmDesk-devrow"><button class="btn btn-outline btn-sm" id="cmDevNo">模拟未激活</button>' +
      '<button class="btn btn-outline btn-sm" id="cmDevYes">模拟已激活</button>' +
      '<button class="btn btn-outline btn-sm" id="cmDevReal">恢复真实</button></div>' +
      '<div class="cmDesk-devrow"><button class="btn btn-outline btn-sm" id="cmDevWiz">重播首启向导</button>' +
      '<button class="btn btn-ghost btn-sm" id="cmDevOff">关闭开发者模式</button></div>' +
      '<div class="cmDesk-devnote">仅影响本窗口显示，不改动真实激活数据</div>';
    document.body.appendChild(c);
    c.querySelector('#cmDevNo').onclick = function () { cmDevOverride = false; cmDevApply(); };
    c.querySelector('#cmDevYes').onclick = function () { cmDevOverride = true; cmDevApply(); };
    c.querySelector('#cmDevReal').onclick = function () { cmDevOverride = null; cmDevApply(); };
    c.querySelector('#cmDevWiz').onclick = function () { c.remove(); lsSet(LS_ONBOARD, ''); stepWelcome(); };
    c.querySelector('#cmDevOff').onclick = function () { cmDevOn = false; cmDevOverride = null; c.remove(); cmDevApply(); };
    cmDevRenderPanel();
  }
  function cmDevRenderPanel() {
    var c = document.getElementById('cmDeskDevCard');
    if (!c) return;
    [['#cmDevNo', cmDevOverride === false], ['#cmDevYes', cmDevOverride === true], ['#cmDevReal', cmDevOverride === null]].forEach(function (it) {
      var b = c.querySelector(it[0]);
      if (b) b.classList.toggle('active', it[1]);
    });
  }
  function cmDevTap() {
    var now = Date.now();
    if (now - cmDevTapTs > 3000) cmDevTaps = 0;
    cmDevTapTs = now;
    if (++cmDevTaps >= 5) {
      cmDevTaps = 0;
      if (cmDevOn) {   // 关闭免密
        cmDevOn = false; cmDevOverride = null;
        if (document.getElementById('cmDeskDevCard')) document.getElementById('cmDeskDevCard').remove();
        if (window.showToast) window.showToast('开发者模式已关闭', 'info');
        cmDevApply();
      } else cmDevKeyPrompt();   // 开启需密钥
    }
  }
  function cmDevKeyPrompt() {
    if (document.getElementById('cmDevKeyModal')) return;
    var ov = el('div', 'cmDesk-modal-overlay'); ov.id = 'cmDevKeyModal';
    ov.innerHTML =
      '<div class="cmDesk-modal">' +
      '<h3>🛠 开发者模式</h3>' +
      '<div class="cmDesk-pro-intro">此模式用于调试预览（模拟激活双态/重播向导），请输入开发者密钥。密钥遗失请联系作者重置。</div>' +
      '<input id="cmDevKeyIn" type="password" placeholder="开发者密钥（形如 CMDEV-XXXX-XXXX-XXXX-XXXX）" style="width:100%;font-family:monospace;font-size:12px;padding:9px 11px;border:1px solid var(--border,#E6DECD);border-radius:8px;box-sizing:border-box">' +
      '<div id="cmDevKeyMsg" style="font-size:12px;color:#B04A3A;min-height:16px;margin-top:6px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-outline btn-sm" id="cmDevKeyCancel">取消</button><button class="btn btn-primary btn-sm" id="cmDevKeyGo">验证并开启</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    var done = false;
    ov.querySelector('#cmDevKeyCancel').onclick = function () { done = true; ov.remove(); };
    ov.addEventListener('click', function (ev) { if (ev.target === ov && !done) { done = true; ov.remove(); } });
    function tryGo() {
      if (done) return;
      var v = ov.querySelector('#cmDevKeyIn').value.trim();
      if (!v) { ov.querySelector('#cmDevKeyMsg').textContent = '请输入密钥'; return; }
      if (!window.__CM_DEV || !window.__CM_DEV.checkKey) { ov.querySelector('#cmDevKeyMsg').textContent = '校验不可用'; return; }
      window.__CM_DEV.checkKey(v).then(function (ok) {
        if (done) return;
        if (ok) {
          done = true; ov.remove();
          cmDevOn = true;
          if (window.showToast) window.showToast('🛠 开发者模式已开启（右下角 DEV）', 'success');
          cmDevApply();
        } else ov.querySelector('#cmDevKeyMsg').textContent = '密钥不正确';
      }).catch(function () { ov.querySelector('#cmDevKeyMsg').textContent = '校验失败，重试'; });
    }
    ov.querySelector('#cmDevKeyGo').onclick = tryGo;
    ov.querySelector('#cmDevKeyIn').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tryGo(); });
    setTimeout(function () { var i = ov.querySelector('#cmDevKeyIn'); if (i) i.focus(); }, 60);
  }
  function wrapNavigatePro() {
    var origNav = window.navigateTo;
    if (typeof origNav !== 'function' || wrapNavigatePro._done) return;
    wrapNavigatePro._done = 1;
    window.navigateTo = function (page) {
      var r = origNav.apply(this, arguments);
      if (cmProActive() || window.__cmRole === 'committee') return r;
      if (CM_PRO_PAGES[page]) {
        var info = CM_PRO_PAGES[page];
        cmGatePage = page;
        cmBlurTarget(true);
        cmProModal(info[0], { intro: info[1], gatePage: page });
      } else if (cmGatePage) {
        cmPageLockClear();
      }
      return r;
    };
  }
  function cmProModal(label, opts) {
    if (!label) label = '这个功能';
    if (document.getElementById('cmDeskProModal')) return;
    CM_PRO_SESSION[label] = 1;
    opts = opts || {};
    if (opts.gatePage) cmGatePage = opts.gatePage;
    var req = cmProReqCode();
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskProModal';
    m.innerHTML =
      '<div class="cmDesk-donate-card cmDesk-pro">' +
      '<button class="cmDesk-donate-close" id="cmProClose" aria-label="关闭">×</button>' +
      '<h3>✨ ' + label + ' 是 Pro 功能</h3>' +
      '<div class="cmDesk-pro-list">' +
      (opts.intro ? '<div class="cmDesk-pro-intro">' + opts.intro + '</div>' : '') +
      '<div>🎓 学期报告引擎：个人 + 班级报告，PDF / 长图一键导出</div>' +
      '<div>🖼️ 座次表 · 值日表 · 成绩条，排版打印不发愁</div>' +
      '<div>📊 数据分析深度版：趋势 · 预警 · 导出</div>' +
      '<div>🌟 进步之星榜 · 零扣分续航榜 海报导出</div>' +
      '</div>' +
      '<div class="cmDesk-pro-price"><s>¥69</s> <b>¥49</b> <span>早鸟限量 100 份 · 一次买断 · 无订阅</span></div>' +
      '<div class="cmDesk-pro-mail"><span>✉ 邮箱（选填）</span><input id="cmProMailIn" type="email" placeholder="换机重置时自动核对身份 · 只存加密指纹，本机不存明文"></div>' +
      '<div class="cmDesk-pro-req"><span>① 复制申请码（已含本机标识）</span><button class="btn btn-primary btn-sm" id="cmProReqCopy">复制</button></div>' +
      '<input id="cmProReq" readonly value="' + req + '">' +
      '<div class="cmDesk-pro-act">' +
      '<a class="btn btn-primary" id="cmProBuy" href="' + cmBuyUrl() + (window.__CM_DESKTOP && window.__CM_DESKTOP.store ? '' : '?custom_order_id=' + encodeURIComponent(req)) + '" target="_blank" rel="noopener">🛒 ' + (window.__CM_DESKTOP && window.__CM_DESKTOP.store ? '升级 Pro · 前往官网' : '购买激活（微信 / 支付宝）') + '</a>' +
      '<button class="btn btn-outline" id="cmProClaim">② 我已付款 · 自动获取激活码</button>' +
      '</div>' +
      '<div class="cmDesk-pro-manual"><button class="btn btn-outline btn-sm" id="cmProPaste">我已有激活码 · 从剪贴板粘贴</button><input id="cmProLic" placeholder="或手动贴入 CMPRO1.xxxx…"></div>' +
      '<button class="btn btn-primary" id="cmProGo">激活</button>' +
      '<div class="cmDesk-pro-msg" id="cmProMsg">付款后点「② 我已付款 · 自动获取激活码」即可自动激活，一般几秒内到码；没取到也可复制激活码手动贴入。激活全程离线验签，数据不出这台电脑。</div>' +
      '<div class="cmDesk-donate-actions"><button class="btn btn-outline btn-sm" id="cmProLater">下次再说</button></div>' +
      '</div>';
    document.body.appendChild(m);
    function closeModal() {
      m.remove();
      if (opts.gatePage && !cmProActive()) cmPagePill();   // 页面锁：关弹窗仍保留模糊 + 悬浮解锁
    }
    m.querySelector('#cmProClose').onclick = closeModal;
    m.querySelector('#cmProLater').onclick = closeModal;
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    m.querySelector('#cmProReqCopy').onclick = function () {
      cmProCopy(req, function () { if (window.showToast) window.showToast('申请码已复制，下单时粘贴到留言', 'success'); }, function () { if (window.showToast) window.showToast('复制失败，请长按手动复制', 'error'); });
    };
    /* 可选邮箱（v1.2.6）：填了就进申请码指纹（eh），重签时 KeyGen 自动核对；
       改邮箱 → 申请码/购买链接即时重算（复制/下单都拿新的） */
    var mailIn = m.querySelector('#cmProMailIn');
    mailIn.value = lsGet('cmProMail') || '';
    mailIn.onchange = function () {
      var v = (mailIn.value || '').trim().toLowerCase();
      var msgEl = m.querySelector('#cmProMsg');
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msgEl.textContent = '邮箱格式看起来不对，改一下再回车'; return; }
      lsSet('cmProMail', v);
      req = cmProReqCode();
      m.querySelector('#cmProReq').value = req;
      m.querySelector('#cmProBuy').href = cmBuyUrl() + (window.__CM_DESKTOP && window.__CM_DESKTOP.store ? '' : '?custom_order_id=' + encodeURIComponent(req));
      msgEl.textContent = v ? '✉ 邮箱已记入（只存加密指纹），申请码已更新——请重新复制' : '邮箱已清除，申请码已更新';
    };
    m.querySelector('#cmProPaste').onclick = function () {
      var msg = m.querySelector('#cmProMsg');
      if (!window.__CM_CLIP || !window.__CM_CLIP.read) { msg.textContent = '当前环境不支持自动粘贴，请手动贴入激活码。'; return; }
      msg.textContent = '正在读取剪贴板…';
      window.__CM_CLIP.read().then(function (r) {
        var t = ((r && r.text) || '').trim();
        if (/^CMPRO1\./.test(t)) {
          m.querySelector('#cmProLic').value = t;
          msg.textContent = '已从剪贴板填入激活码，正在验签…';
          m.querySelector('#cmProGo').click();
        } else {
          msg.textContent = '剪贴板里没有激活码（应以 CMPRO1. 开头）——先复制作者发给你的激活码，再点本按钮。';
        }
      });
    };
    m.querySelector('#cmProClaim').onclick = function () {
      var msg = m.querySelector('#cmProMsg');
      if (!window.__CM_PRO) { msg.textContent = '自动获取不可用，请手动贴码或联系作者。'; return; }
      msg.textContent = '正在向作者服务器查询你的激活码…';
      window.__CM_PRO.claim(req).then(function (r) {
        if (r && r.ok) { m.querySelector('#cmProLic').value = r.lic; m.querySelector('#cmProGo').click(); }
        else msg.textContent = r && r.why === 'AUTO_OFF' ? '自动获取暂未开通——请把申请码发给作者（爱发电留言 / 邮箱），收到激活码贴在下方。' : '暂未查到订单：确认已付款、申请码已填进爱发电留言，几秒后可再点一次；仍未到码请联系作者（846699191@qq.com）。';
      });
    };
    m.querySelector('#cmProGo').onclick = function () {
      var msg = m.querySelector('#cmProMsg');
      var lic = m.querySelector('#cmProLic').value.trim();
      if (!lic) { msg.textContent = '请先粘贴激活码。'; return; }
      msg.textContent = '正在验签…';
      window.__CM_PRO.activate({ req: req, lic: lic }).then(function (r) {
        if (r && r.ok) {
          cmProRefresh().then(function () {
            m.remove();
            if (window.showToast) window.showToast('🎉 Pro 已激活' + (r.tier === 'early' ? '（早鸟纪念 #' + r.sn + '/100）' : ''), 'success');
            buildNavPro();                          // 侧栏：去角标、亮 PRO 徽标（v1.2.6）
            var old = document.getElementById('cmDeskDonateSec');
            if (old) old.remove();
            var about = document.getElementById('settingsAbout');
            if (about) buildDonateRow(about);
            if (opts.gatePage) cmPageLockClear();   // 激活成功：解除本页模糊
          });
        } else {
          msg.textContent = '❌ ' + ((r && r.why) || '激活失败') + '（连续失败可邮件联系作者：846699191@qq.com）';
        }
      });
    };
  }
  /* Pro 已激活卡（v1.2.6 B 印章式定稿）：暖黑底 + 金色发丝边框 + 早鸟钢印，右下角开发者署名。
     v1.2.6 二审：授权邮箱行撤下（本机从不存明文、实际也留不了邮箱），
     换成金宋体身份行「早鸟 №042 · 正版授权」——铭牌感直接给足。 */
  function buildProActiveCard(about) {
    var c = cmProCache();
    var sec = el('div', 'settings-section cmDeskDonateSec');
    sec.id = 'cmDeskDonateSec';
    var early = c.tier === 'early';
    var sn = ('00' + (c.sn || 0)).slice(-3);
    sec.innerHTML =
      '<div class="cmDesk-procard">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
      '<span class="chip">✦ PRO</span><span>已激活 · 终身有效</span>' +
      '</div>' +
      (early ? '<div class="seal"><i>早鸟</i><b>№' + sn + '</b><s>共100份</s></div>' : '') +
      '<div class="bd">' +
      '<div class="lic">' + (early ? '早鸟 №' + sn + ' · 正版授权' : '正版授权') + '</div>' +
      '<div>一次买断，全部 Pro 功能永久可用</div>' +
      '<div class="mut">换机重置：每年 3 次免费 · 846699191@qq.com</div>' +
      '<button class="cmDesk-procard-copy" id="cmProLicCopy" title="换机/清数据后把它和新的申请码一起发给作者，即可免费重签">📋 复制激活码（换机重签用）</button>' +
      '</div>' +
      '<div class="ft"><span>' + (early ? '感谢你成为前 100 位支持者' : '感谢支持独立开发') + '</span><span class="sig">BY: chee</span></div>' +
      '</div>';
    var licBtn = sec.querySelector('#cmProLicCopy');
    licBtn.onclick = function () {
      function send(l) {
        if (l) cmProCopy(l, function () { if (window.showToast) window.showToast('激活码已复制，连同新申请码一起发给作者即可重签', 'success'); }, function () { if (window.showToast) window.showToast('复制失败，请邮件联系作者', 'error'); });
        else if (window.showToast) window.showToast('本机未找到激活码，请邮件联系作者：846699191@qq.com', 'error');
      }
      var lic = (cmProCache() || {}).lic || '';
      if (lic) send(lic);
      else if (window.__CM_PRO && window.__CM_PRO.status) window.__CM_PRO.status().then(function (r) { send((r && r.lic) || ''); });
      else send('');
    };
    about.parentNode.insertBefore(sec, about);
  }

  /* ---------- M3 学期报告引擎（v1.1.0 Pro 核心）：个人 + 班级，长图 / PDF ----------
     数据只用网页版 state（流水/请假/成绩），统计一律走 liveOps 过滤撤销；
     学期起点与公示页同口径（手动设置优先，回退 3/1、9/1 自动推断）；
     导出两条路：canvas 自绘长图（复用页面 pngExport）+ 主进程 printToPDF。 */
  var CM_RPT_BG = '#FDFBF7', CM_RPT_BRAND = '#A63A2B', CM_RPT_INK = '#2B2B33',
      CM_RPT_SUB = '#6B6B75', CM_RPT_LINE = '#E5E0D8';
  function cmReportSemStart() {
    var t = 0;
    try {
      var v = loadPubSetting('semesterStart');
      if (v) { var d = new Date(v + 'T00:00:00'); if (!isNaN(d.getTime())) t = d.getTime(); }
    } catch (e) {}
    if (!t) {
      var now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
      var sy = (m >= 9) ? y : (m <= 2 ? y - 1 : y), sm = (m >= 3 && m <= 8) ? 3 : 9;
      t = new Date(sy, sm - 1, 1).getTime();
    }
    return t;
  }
  function cmReportSemName() {
    try { var c = pubRangeCaption('semester'); if (c) return c; } catch (e) {}
    var now = new Date(), m = now.getMonth() + 1;
    return now.getFullYear() + ' 年' + ((m >= 3 && m <= 8) ? '春' : '秋') + '学期';
  }
  function cmReportDstr(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function cmReportCatOf(reason) {
    try { return REASON_CATALOG_FLAT[reason] || '其他'; } catch (e) { return '其他'; }
  }
  function cmReportClassTitle() {
    try { return (state.className || '').trim(); } catch (e) { return ''; }
  }
  function cmReportLiveStudents() {
    return (state.students || []).filter(function (s) { return !(state.studentDeleted && state.studentDeleted[s.id]); });
  }
  function cmReportDormOf(stu) {
    var tags = stu.tags || [];
    for (var i = 0; i < tags.length; i++) if (/^\d+栋-?\d+室$/.test(tags[i])) return tags[i];
    return tags.indexOf('走读') >= 0 ? '走读' : '';
  }
  var CM_RPT_POSTS = { banzhang: '班长', fubanzhang: '副班长', jilv: '纪律委员', xuexi: '学习委员', tiyu: '体育委员', shenghuo: '生活委员', wenyi: '文艺委员', xinxi: '信息委员' };
  function cmReportPostOf(stuId) {
    try {
      var cm = state.committee || {};
      for (var k in cm) if (cm[k] === stuId) return CM_RPT_POSTS[k] || k;
    } catch (e) {}
    return '';
  }
  function cmReportLatestExam() {
    var ex = (state.exams || []).slice().filter(function (e) { return e && e.scores; });
    if (!ex.length) return null;
    ex.sort(function (a, b) { return (a.date < b.date ? -1 : 1); });
    return ex[ex.length - 1];
  }
  function cmReportExamTotals(exam) {
    var subs = exam.subjects || [], rows = [];
    cmReportLiveStudents().forEach(function (s) {
      var sc = exam.scores[s.id]; if (!sc) return;
      var t = 0, c = 0;
      subs.forEach(function (su) { var v = sc[su]; if (typeof v === 'number') { t += v; c++; } });
      if (c === subs.length && subs.length) rows.push({ id: s.id, name: s.name, total: t });
    });
    rows.sort(function (a, b) { return b.total - a.total; });
    return rows;
  }
  /* 个人数据聚合 */
  function cmReportStuData(stu) {
    var t0 = cmReportSemStart(), t0s = cmReportDstr(t0);
    var ops = liveOps(state.operations).filter(function (o) { return o.studentId === stu.id && Number(o.time) >= t0; });
    var d = { stu: stu, sem: cmReportSemName(), cls: cmReportClassTitle(), add: 0, sub: 0, addCnt: 0, subCnt: 0, coin: 0, cats: [], lv: null, exam: null, rank: 0, examCnt: 0 };
    var byCat = {};
    ops.forEach(function (o) {
      if (o.amount >= 0) { d.add += o.amount; d.addCnt++; } else { d.sub += o.amount; d.subCnt++; }
      d.coin += Number(o.coin || 0);
      var c = cmReportCatOf(o.reason);
      if (!byCat[c]) byCat[c] = { name: c, add: 0, sub: 0, cnt: 0 };
      byCat[c].cnt++;
      if (o.amount >= 0) byCat[c].add += o.amount; else byCat[c].sub += o.amount;
    });
    d.cats = Object.keys(byCat).map(function (k) { return byCat[k]; })
      .sort(function (a, b) { return (b.add - b.sub) - (a.add - a.sub) || b.cnt - a.cnt; });
    var leaves = (state.leaves || []).filter(function (l) { return l.studentId === stu.id && l.startDate && l.startDate >= t0s; });
    var lv = { total: leaves.length, days: 0, sick: 0, personal: 0, official: 0 };
    leaves.forEach(function (l) {
      lv.days += Number(l.duration) || 0;
      if (l.type === 'sick') lv.sick++; else if (l.type === 'personal') lv.personal++; else if (l.type === 'official') lv.official++;
    });
    d.lv = lv;
    var exam = cmReportLatestExam();
    if (exam) {
      var rows = cmReportExamTotals(exam);
      for (var i = 0; i < rows.length; i++) if (rows[i].id === stu.id) {
        d.exam = { name: exam.name, date: exam.date, total: rows[i].total, avg: 0, rank: i + 1, cnt: rows.length };
        break;
      }
      if (d.exam) {
        var sum = 0; rows.forEach(function (r) { sum += r.total; });
        d.exam.avg = rows.length ? Math.round(sum / rows.length * 10) / 10 : 0;
      }
    }
    return d;
  }
  /* 班级数据聚合 */
  function cmReportClassData() {
    var t0 = cmReportSemStart(), t0s = cmReportDstr(t0);
    var ops = liveOps(state.operations).filter(function (o) { return Number(o.time) >= t0; });
    var d = { sem: cmReportSemName(), cls: cmReportClassTitle(), n: 0, opCnt: ops.length, per: {}, top: [], clean: [], lvTotal: 0, lvDays: 0, exam: null };
    var stus = cmReportLiveStudents();
    d.n = stus.length;
    ops.forEach(function (o) {
      var p = d.per[o.studentId]; if (!p) p = d.per[o.studentId] = { add: 0, sub: 0 };
      if (o.amount >= 0) p.add += o.amount; else p.sub += o.amount;
    });
    var rows = stus.map(function (s) {
      var p = d.per[s.id] || { add: 0, sub: 0 };
      return { name: s.name, sid: s.sid, add: p.add, sub: p.sub, net: p.add + p.sub };
    });
    d.top = rows.slice().sort(function (a, b) { return b.net - a.net || b.add - a.add; }).slice(0, 10);
    d.clean = rows.filter(function (r) { return r.sub === 0; }).slice(0, 20);
    (state.leaves || []).forEach(function (l) {
      if (l.startDate && l.startDate >= t0s) { d.lvTotal++; d.lvDays += Number(l.duration) || 0; }
    });
    var exam = cmReportLatestExam();
    if (exam) {
      var tot = cmReportExamTotals(exam), sum = 0;
      tot.forEach(function (r) { sum += r.total; });
      if (tot.length) d.exam = { name: exam.name, date: exam.date, cnt: tot.length, avg: Math.round(sum / tot.length * 10) / 10, max: tot[0].total, min: tot[tot.length - 1].total, first: tot[0].name };
    }
    return d;
  }
  /* canvas 小工具 */
  function cmRr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /* canvas 小工具：定高裁切（直接改 height 会重置 context 抹掉全部绘制） */
  function cmCrop(c, h) {
    var c2 = document.createElement('canvas');
    c2.width = 750; c2.height = h;
    c2.getContext('2d').drawImage(c, 0, 0);
    return c2;
  }
  function cmWrapText(ctx, text, x, y, maxW, lh) {
    var line = '';
    for (var i = 0; i < text.length; i++) {
      if (ctx.measureText(line + text[i]).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = text[i]; }
      else line += text[i];
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
    return y;
  }
  function cmRptHead(ctx, title, sub, y) {
    ctx.fillStyle = CM_RPT_BG; ctx.fillRect(0, 0, 750, y);
    ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 26px sans-serif'; ctx.fillText(title, 40, y - 46);
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '13px sans-serif'; ctx.fillText(sub, 40, y - 20);
    ctx.fillStyle = CM_RPT_BRAND; cmRr(ctx, 640, y - 52, 70, 26, 13); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('PRO', 657, y - 34);
    ctx.strokeStyle = CM_RPT_LINE; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(710, y); ctx.stroke();
    return y + 26;
  }
  function cmRptStat(ctx, x, y, w, label, value, color) {
    ctx.fillStyle = '#FFFFFF'; cmRr(ctx, x, y, w, 64, 10); ctx.fill();
    ctx.strokeStyle = CM_RPT_LINE; cmRr(ctx, x, y, w, 64, 10); ctx.stroke();
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '12px sans-serif'; ctx.fillText(label, x + 14, y + 24);
    ctx.fillStyle = color || CM_RPT_INK; ctx.font = 'bold 22px sans-serif'; ctx.fillText(value, x + 14, y + 50);
  }
  function cmRptFoot(ctx, h) {
    ctx.strokeStyle = CM_RPT_LINE; ctx.beginPath(); ctx.moveTo(40, h - 52); ctx.lineTo(710, h - 52); ctx.stroke();
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '11px sans-serif';
    ctx.fillText('班主任工作台 · ' + cmReportSemName() + '学期报告', 40, h - 30);
    ctx.fillText('生成于 ' + localDateStr(), 710 - ctx.measureText('生成于 ' + localDateStr()).width, h - 30);
  }
  /* 个人报告长图 */
  function cmReportStuCanvas(d, comment) {
    var stu = d.stu, y = 0;
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    c.width = 750; c.height = 1400;
    ctx.fillStyle = CM_RPT_BG; ctx.fillRect(0, 0, 750, c.height);
    y = cmRptHead(ctx, '学期个人报告', d.sem + (d.cls ? ' · ' + d.cls : ''), 92);
    ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 30px sans-serif'; ctx.fillText(stu.name, 40, y + 34);
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '13px sans-serif';
    var meta = '学号 ' + (stu.sid || '-');
    if (cmReportDormOf(stu)) meta += ' · ' + cmReportDormOf(stu);
    if (cmReportPostOf(stu.id)) meta += ' · ' + cmReportPostOf(stu.id);
    ctx.fillText(meta, 40, y + 58);
    y += 84;
    var base = (typeof stu.creditBase === 'number') ? stu.creditBase : null;
    cmRptStat(ctx, 40, y, 202, '期初基线', base === null ? '-' : String(base), CM_RPT_INK);
    cmRptStat(ctx, 274, y, 202, '当前学分', String(stu.credit), CM_RPT_BRAND);
    cmRptStat(ctx, 508, y, 202, '学期净变化', (d.add + d.sub >= 0 ? '+' : '') + (d.add + d.sub), d.add + d.sub >= 0 ? '#2E7D32' : '#B23B3B');
    y += 84;
    cmRptStat(ctx, 40, y, 202, '学期加分', '+' + d.add + '（' + d.addCnt + ' 次）', '#2E7D32');
    cmRptStat(ctx, 274, y, 202, '学期扣分', d.sub + '（' + d.subCnt + ' 次）', '#B23B3B');
    cmRptStat(ctx, 508, y, 202, '累计学分币', String(d.coin), CM_RPT_INK);
    y += 106;
    if (d.cats.length) {
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('本学期表现分布', 40, y);
      y += 18;
      var maxNet = 1;
      d.cats.forEach(function (cat) { maxNet = Math.max(maxNet, Math.abs(cat.add + cat.sub)); });
      d.cats.slice(0, 6).forEach(function (cat) {
        var net = cat.add + cat.sub;
        y += 30;
        ctx.fillStyle = CM_RPT_INK; ctx.font = '13px sans-serif'; ctx.fillText(cat.name, 40, y + 4);
        var bw = Math.round(Math.abs(net) / maxNet * 380);
        ctx.fillStyle = net >= 0 ? '#2E7D32' : '#B23B3B';
        if (bw > 0) { cmRr(ctx, 150, y - 8, Math.max(bw, 6), 14, 7); ctx.fill(); }
        ctx.fillStyle = CM_RPT_SUB; ctx.font = '12px sans-serif';
        ctx.fillText((net >= 0 ? '+' : '') + net + ' 分 · ' + cat.cnt + ' 次', 150 + Math.max(bw, 6) + 12, y + 4);
      });
      y += 34;
    }
    ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('请假记录', 40, y);
    y += 24;
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '13px sans-serif';
    ctx.fillText(d.lv.total ? ('病假 ' + d.lv.sick + ' 次 · 事假 ' + d.lv.personal + ' 次 · 公假 ' + d.lv.official + ' 次 · 合计 ' + d.lv.days + ' 天') : '本学期无请假记录', 40, y);
    y += 40;
    if (d.exam) {
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('最近考试 · ' + d.exam.name, 40, y);
      y += 24;
      ctx.fillStyle = CM_RPT_SUB; ctx.font = '13px sans-serif';
      ctx.fillText('总分 ' + d.exam.total + '（班级均分 ' + d.exam.avg + '，第 ' + d.exam.rank + ' / ' + d.exam.cnt + ' 名）', 40, y);
      y += 40;
    }
    if (comment) {
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('老师寄语', 40, y);
      y += 26;
      ctx.fillStyle = CM_RPT_INK; ctx.font = '14px sans-serif';
      y = cmWrapText(ctx, comment, 40, y, 670, 22);
      y += 14;
    }
    cmRptFoot(ctx, y + 76);
    return cmCrop(c, y + 76);
  }
  /* 班级报告长图 */
  function cmReportClassCanvas(d) {
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    c.width = 750; c.height = 1600;
    ctx.fillStyle = CM_RPT_BG; ctx.fillRect(0, 0, 750, c.height);
    var y = cmRptHead(ctx, '学期班级报告', d.sem + (d.cls ? ' · ' + d.cls : ''), 92);
    cmRptStat(ctx, 40, y, 202, '班级人数', d.n + ' 人', CM_RPT_INK);
    cmRptStat(ctx, 274, y, 202, '学期流水', d.opCnt + ' 条', CM_RPT_INK);
    cmRptStat(ctx, 508, y, 202, '请假合计', d.lvDays + ' 天（' + d.lvTotal + ' 次）', CM_RPT_INK);
    y += 88;
    ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('学分排行 TOP10（按学期净变化）', 40, y);
    y += 14;
    ctx.fillStyle = CM_RPT_SUB; ctx.font = '12px sans-serif';
    ctx.fillText('名次', 40, y + 26); ctx.fillText('姓名', 100, y + 26);
    ctx.fillText('加分', 220, y + 26); ctx.fillText('扣分', 310, y + 26); ctx.fillText('净变化', 400, y + 26);
    y += 36;
    d.top.forEach(function (r, i) {
      ctx.fillStyle = i < 3 ? CM_RPT_BRAND : CM_RPT_INK; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(String(i + 1), 40, y + 20);
      ctx.fillStyle = CM_RPT_INK; ctx.font = '13px sans-serif';
      ctx.fillText(r.name, 100, y + 20);
      ctx.fillStyle = '#2E7D32'; ctx.fillText('+' + r.add, 220, y + 20);
      ctx.fillStyle = r.sub ? '#B23B3B' : CM_RPT_SUB; ctx.fillText(String(r.sub), 310, y + 20);
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 13px sans-serif';
      ctx.fillText((r.net >= 0 ? '+' : '') + r.net, 400, y + 20);
      ctx.strokeStyle = CM_RPT_LINE; ctx.beginPath(); ctx.moveTo(40, y + 30); ctx.lineTo(710, y + 30); ctx.stroke();
      y += 38;
    });
    y += 18;
    if (d.clean.length) {
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('零扣分名单（本学期）', 40, y);
      y += 26;
      ctx.fillStyle = CM_RPT_INK; ctx.font = '13px sans-serif';
      y = cmWrapText(ctx, d.clean.map(function (r) { return r.name; }).join(' · '), 40, y, 670, 24);
    }
    y += 16;
    if (d.exam) {
      ctx.fillStyle = CM_RPT_INK; ctx.font = 'bold 16px sans-serif'; ctx.fillText('最近考试 · ' + d.exam.name, 40, y);
      y += 24;
      ctx.fillStyle = CM_RPT_SUB; ctx.font = '13px sans-serif';
      ctx.fillText('参考 ' + d.exam.cnt + ' 人 · 均分 ' + d.exam.avg + ' · 最高 ' + d.exam.max + '（' + d.exam.first + '）· 最低 ' + d.exam.min, 40, y);
      y += 40;
    }
    cmRptFoot(ctx, y + 76);
    return cmCrop(c, y + 76);
  }
  /* PDF HTML（A4 自包含，禁止脚本已由主进程校验） */
  function cmRptPdfShell(title, bodyHtml) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' +
      'body{font-family:"Microsoft YaHei",sans-serif;color:#2B2B33;margin:0;padding:24px 28px;background:#FDFBF7;font-size:12px;}' +
      'h1{font-size:22px;margin:0 0 4px;}h2{font-size:14px;margin:18px 0 8px;border-bottom:1px solid #E5E0D8;padding-bottom:6px;}' +
      '.sub{color:#6B6B75;font-size:11px;}.pro{display:inline-block;background:#A63A2B;color:#fff;border-radius:9px;padding:1px 9px;font-size:9px;font-weight:bold;vertical-align:middle;}' +
      '.stat{display:inline-block;width:30%;background:#fff;border:1px solid #E5E0D8;border-radius:8px;padding:8px 10px;margin:4px 1% 4px 0;}' +
      '.stat b{display:block;font-size:17px;margin-top:3px;}.stat span{color:#6B6B75;font-size:10px;}' +
      'table{width:100%;border-collapse:collapse;}td,th{border-bottom:1px solid #E5E0D8;padding:5px 6px;text-align:left;font-size:12px;}' +
      '.pos{color:#2E7D32;}.neg{color:#B23B3B;}.foot{margin-top:26px;border-top:1px solid #E5E0D8;padding-top:8px;color:#6B6B75;font-size:10px;}' +
      '</style></head><body>' + bodyHtml +
      '<div class="foot">班主任工作台 · ' + cmReportSemName() + '学期报告 · 生成于 ' + localDateStr() + '</div></body></html>';
  }
  function cmReportStuPdf(d, comment) {
    var stu = d.stu, h = '<h1>学期个人报告 <span class="pro">PRO</span></h1>' +
      '<div class="sub">' + d.sem + (d.cls ? ' · ' + d.cls : '') + '</div><h2>' + stu.name +
      (stu.sid ? '（学号 ' + stu.sid + '）' : '') + (cmReportDormOf(stu) ? ' · ' + cmReportDormOf(stu) : '') + (cmReportPostOf(stu.id) ? ' · ' + cmReportPostOf(stu.id) : '') + '</h2>' +
      '<div><span class="stat">期初基线<b>' + ((typeof stu.creditBase === 'number') ? stu.creditBase : '-') + '</b><span>期初基线</span></span>' +
      '<span class="stat">当前学分<b class="neg">' + stu.credit + '</b><span>当前学分</span></span>' +
      '<span class="stat">学期净变化<b class="' + (d.add + d.sub >= 0 ? 'pos' : 'neg') + '">' + (d.add + d.sub >= 0 ? '+' : '') + (d.add + d.sub) + '</b><span>学期净变化</span></span>' +
      '<span class="stat">学期加分<b class="pos">+' + d.add + '</b><span>' + d.addCnt + ' 次</span></span>' +
      '<span class="stat">学期扣分<b class="neg">' + d.sub + '</b><span>' + d.subCnt + ' 次</span></span>' +
      '<span class="stat">累计学分币<b>' + d.coin + '</b><span>累计学分币</span></span></div>';
    if (d.cats.length) {
      h += '<h2>本学期表现分布</h2><table><tr><th>大类</th><th>加分</th><th>扣分</th><th>净变化</th><th>次数</th></tr>';
      d.cats.forEach(function (cat) {
        h += '<tr><td>' + cat.name + '</td><td class="pos">' + (cat.add ? '+' + cat.add : '-') + '</td><td class="neg">' + (cat.sub || '-') + '</td><td><b>' + (cat.add + cat.sub >= 0 ? '+' : '') + (cat.add + cat.sub) + '</b></td><td>' + cat.cnt + '</td></tr>';
      });
      h += '</table>';
    }
    h += '<h2>请假记录</h2><div>' + (d.lv.total ? '病假 ' + d.lv.sick + ' 次 · 事假 ' + d.lv.personal + ' 次 · 公假 ' + d.lv.official + ' 次 · 合计 ' + d.lv.days + ' 天' : '本学期无请假记录') + '</div>';
    if (d.exam) h += '<h2>最近考试 · ' + d.exam.name + '</h2><div>总分 <b>' + d.exam.total + '</b>（班级均分 ' + d.exam.avg + '，第 ' + d.exam.rank + ' / ' + d.exam.cnt + ' 名）</div>';
    if (comment) h += '<h2>老师寄语</h2><div>' + comment.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
    return cmRptPdfShell('学期个人报告 · ' + stu.name, h);
  }
  function cmReportClassPdf(d) {
    var h = '<h1>学期班级报告 <span class="pro">PRO</span></h1>' +
      '<div class="sub">' + d.sem + (d.cls ? ' · ' + d.cls : '') + '</div>' +
      '<div><span class="stat">班级人数<b>' + d.n + '</b><span>班级人数</span></span>' +
      '<span class="stat">学期流水<b>' + d.opCnt + '</b><span>条</span></span>' +
      '<span class="stat">请假合计<b>' + d.lvDays + ' 天</b><span>' + d.lvTotal + ' 次</span></span></div>' +
      '<h2>学分排行 TOP10（按学期净变化）</h2><table><tr><th>名次</th><th>姓名</th><th>加分</th><th>扣分</th><th>净变化</th></tr>';
    d.top.forEach(function (r, i) {
      h += '<tr><td>' + (i + 1) + '</td><td>' + r.name + '</td><td class="pos">+' + r.add + '</td><td class="neg">' + (r.sub || '-') + '</td><td><b>' + (r.net >= 0 ? '+' : '') + r.net + '</b></td></tr>';
    });
    h += '</table>';
    if (d.clean.length) h += '<h2>零扣分名单（本学期）</h2><div>' + d.clean.map(function (r) { return r.name; }).join(' · ') + '</div>';
    if (d.exam) h += '<h2>最近考试 · ' + d.exam.name + '</h2><div>参考 ' + d.exam.cnt + ' 人 · 均分 ' + d.exam.avg + ' · 最高 ' + d.exam.max + '（' + d.exam.first + '）· 最低 ' + d.exam.min + '</div>';
    return cmRptPdfShell('学期班级报告', h);
  }
  /* 报告面板 */
  var CM_RPT_LS_CMT = 'cmReportCmt';
  function cmReportComments() { try { return JSON.parse(lsGet(CM_RPT_LS_CMT) || '{}'); } catch (e) { return {}; } }
  function cmReportOpen() {
    if (!cmProActive()) { cmProModal('学期报告引擎'); return; }
    if (document.getElementById('cmDeskReport')) return;
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskReport';
    var stus = cmReportLiveStudents().slice().sort(function (a, b) { return (a.sid || '') < (b.sid || '') ? -1 : 1; });
    var opts = stus.map(function (s) { return '<option value="' + s.id + '">' + (s.sid ? s.sid + ' ' : '') + s.name + '</option>'; }).join('');
    m.innerHTML =
      '<div class="cmDesk-donate-card cmDesk-report-panel">' +
      '<button class="cmDesk-donate-close" id="cmRptClose" aria-label="关闭">×</button>' +
      '<h3>🎓 学期报告引擎 <span class="cmDesk-pro-badge">PRO</span></h3>' +
      '<div class="cmDesk-rp-tabs"><button class="cmDesk-rp-tab active" id="cmRptTabStu">个人报告</button><button class="cmDesk-rp-tab" id="cmRptTabCls">班级报告</button></div>' +
      '<div class="cmDesk-rp-row" id="cmRptStuRow"><label>选择学生</label><select id="cmRptStu">' + opts + '</select>' +
      '<textarea id="cmRptCmt" rows="2" placeholder="老师寄语（可选，随报告导出，自动保存）"></textarea></div>' +
      '<div class="cmDesk-rp-actions"><button class="btn btn-primary" id="cmRptGen">生成报告</button>' +
      '<button class="btn btn-outline" id="cmRptPng" disabled>导出长图 PNG</button>' +
      '<button class="btn btn-outline" id="cmRptPdf" disabled>导出 PDF</button></div>' +
      '<div class="cmDesk-rp-preview" id="cmRptPrev"><div class="cmDesk-rp-empty">选择学生或直接生成班级报告，预览将显示在这里。</div></div>' +
      '<div class="cmDesk-rp-msg" id="cmRptMsg"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('#cmRptClose').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var tabS = m.querySelector('#cmRptTabStu'), tabC = m.querySelector('#cmRptTabCls'),
        stuRow = m.querySelector('#cmRptStuRow'), mode = 'stu';
    var lastCanvas = null, lastName = '学期报告';
    function setTab(t) {
      mode = t;
      tabS.classList.toggle('active', t === 'stu');
      tabC.classList.toggle('active', t === 'cls');
      stuRow.style.display = t === 'stu' ? '' : 'none';
    }
    tabS.onclick = function () { setTab('stu'); };
    tabC.onclick = function () { setTab('cls'); };
    var sel = m.querySelector('#cmRptStu'), cmtBox = m.querySelector('#cmRptCmt');
    var cmts = cmReportComments();
    sel.onchange = function () {
      var c = cmts[sel.value]; cmtBox.value = c ? c.t : '';
    };
    if (stus.length && cmts[stus[0].id]) cmtBox.value = cmts[stus[0].id].t;
    var msg = m.querySelector('#cmRptMsg'), prev = m.querySelector('#cmRptPrev'),
        btnPng = m.querySelector('#cmRptPng'), btnPdf = m.querySelector('#cmRptPdf');
    m.querySelector('#cmRptGen').onclick = function () {
      try {
        if (!cmReportLiveStudents().length) { msg.textContent = '还没有学生数据。'; return; }
        var canvas;
        if (mode === 'stu') {
          var stu = null;
          cmReportLiveStudents().forEach(function (s) { if (s.id === Number(sel.value)) stu = s; });
          if (!stu) { msg.textContent = '请选择学生。'; return; }
          cmts[stu.id] = { t: cmtBox.value.trim(), at: Date.now() };
          lsSet(CM_RPT_LS_CMT, JSON.stringify(cmts));
          var d = cmReportStuData(stu);
          canvas = cmReportStuCanvas(d, cmtBox.value.trim());
          lastName = '学期个人报告-' + stu.name;
        } else {
          var cd = cmReportClassData();
          canvas = cmReportClassCanvas(cd);
          lastName = '学期班级报告';
        }
        lastCanvas = canvas;
        prev.innerHTML = '';
        prev.appendChild(canvas);
        btnPng.disabled = false; btnPdf.disabled = false;
        msg.textContent = '';
      } catch (err) { msg.textContent = '生成失败：' + String((err && err.message) || err).slice(0, 100); }
    };
    btnPng.onclick = function () {
      if (!lastCanvas) return;
      pngExport(lastCanvas, lastName + '.png', '长图已导出');
    };
    btnPdf.onclick = function () {
      if (!lastCanvas || !window.__CM_PRO || !window.__CM_PRO.reportPdf) return;
      btnPdf.disabled = true; msg.textContent = '正在生成 PDF…';
      var html;
      if (mode === 'stu') {
        var stu2 = null;
        cmReportLiveStudents().forEach(function (s) { if (s.id === Number(sel.value)) stu2 = s; });
        html = cmReportStuPdf(cmReportStuData(stu2), cmtBox.value.trim());
      } else {
        html = cmReportClassPdf(cmReportClassData());
      }
      window.__CM_PRO.reportPdf(html, lastName + '.pdf').then(function (r) {
        btnPdf.disabled = false;
        if (r && r.ok) msg.textContent = '✅ PDF 已保存：' + r.path;
        else msg.textContent = (r && r.why === 'canceled') ? '' : '❌ PDF 生成失败：' + ((r && r.why) || '未知原因');
      });
    };
  }
  /* ---------- v1.2.6 请假流水导出（Pro）：考勤页注入按钮 + CSV ----------
     原则：所有导出皆 Pro（数据备份导出除外——数据主权红线，老板 D 批复）。
     考勤请假 v1.2.6 转免费页面，但导出仍走 Pro gate：按钮常驻，点击未激活弹引导框。 */
  function buildLeaveExportBtn() {
    var bar = document.querySelector('#page-attendance .page-toolbar');
    if (!bar || document.getElementById('cmExportLeaveBtn')) return;
    var b = el('button', 'btn btn-outline btn-sm');
    b.id = 'cmExportLeaveBtn';
    b.innerHTML = '<span>📤 导出请假流水</span>';
    b.title = '导出全部请假记录为 CSV（Pro 功能）';
    b.onclick = function () {
      if (window.__cmRole === 'committee') { if (window.showToast) window.showToast('班委模式无权导出数据', 'warning'); return; }
      window.cmExportLeaveFlow();
    };
    bar.appendChild(b);   // 排在「+ 新增请假」右侧
  }
  window.cmExportLeaveFlow = function () {
    try {
      var list = (state.leaves || []).slice().sort(function (a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });
      if (!list.length) { if (window.showToast) window.showToast('还没有请假记录可导出', 'warning'); return; }
      function stu(id) { var arr = state.students || []; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
      var ST = { pending: '待销假', returned: '已销假', extended: '续假中' };
      function q(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
      var rows = ['姓名,学号,类型,开始,结束,时长,事由,状态,登记时间'];
      list.forEach(function (l) {
        var s = stu(l.studentId) || {};
        var dur = (typeof window.formatDuration === 'function') ? window.formatDuration(l.duration) : (l.duration == null ? '' : l.duration);
        rows.push([
          q(s.name || ('id:' + l.studentId)), q(s.sid || ''), q(l.type),
          q(l.startDate), q(l.endDate), q(dur), q(l.reason),
          q(ST[l.status] || l.status || ''), q(String(l.createdAt || '').replace('T', ' ').slice(0, 16))
        ].join(','));
      });
      var d = new Date();
      var ds = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
      var csv = '\uFEFF' + rows.join('\n') + '\n';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.className || '班级') + '-请假流水-' + ds + '.csv';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      if (window.showToast) window.showToast('已导出 ' + list.length + ' 条请假流水', 'success');
    } catch (e) { if (window.showToast) window.showToast('导出失败：' + (e && e.message ? e.message : '未知错误'), 'error'); }
  };

  /* 导航栏 Pro 化（v1.2.0；v1.2.6 状态感知重做）：
     未激活 → Pro 页面挂角标 + 学期报告独立入口（带 PRO 角标）；
     已激活 → 清掉全部角标，侧栏顶部（班级卡右侧）亮 PRO 徽标。
     动态插入的 .nav-item 不会被页面启动时的批量绑定监听 → 自己绑 click。
     状态变化的三条路（激活成功 / 吊销 / 开发者模拟）都会重跑本函数。 */
  function buildNavPro() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var active = cmProActive();
    /* 角标：先清后按需补（幂等，可反复重跑） */
    var olds = nav.querySelectorAll('.cmDesk-navbadge');
    for (var i = 0; i < olds.length; i++) olds[i].remove();
    if (!active) {
      Object.keys(CM_PRO_PAGES).forEach(function (pg) {
        var item = nav.querySelector('.nav-item[data-page="' + pg + '"]');
        if (item && !item.querySelector('.cmDesk-navbadge')) {
          var b = el('span', 'cmDesk-navbadge');
          b.textContent = 'PRO';
          item.appendChild(b);
        }
      });
    }
    /* 学期报告入口（无论激活与否都要有；未激活时带角标） */
    var reportItem = document.getElementById('cmNavReport');
    if (!reportItem) {
      var settingsItem = nav.querySelector('.nav-item[data-page="settings"]');
      reportItem = el('div', 'nav-item cmDesk-navreport');
      reportItem.id = 'cmNavReport';
      reportItem.title = '学期报告（Pro）';
      reportItem.innerHTML = '<span class="nav-icon">🎓</span><span class="nav-text">学期报告</span>';
      reportItem.addEventListener('click', function () { cmReportOpen(); });
      if (settingsItem) settingsItem.parentNode.insertBefore(reportItem, settingsItem);
      else nav.appendChild(reportItem);
    }
    if (!active && !reportItem.querySelector('.cmDesk-navbadge')) {
      var rb = el('span', 'cmDesk-navbadge');
      rb.textContent = 'PRO';
      reportItem.appendChild(rb);
    }
    /* 侧栏顶部 PRO 徽标（激活专属）：班级卡右侧，金线暗底 + 烫金字，安静但有质感 */
    var logo = document.querySelector('.sidebar-logo');
    var em = document.getElementById('cmDeskProEmblem');
    if (active) {
      if (logo && !em) {
        em = el('span', 'cmDesk-proemblem');
        em.id = 'cmDeskProEmblem';
        em.title = 'Pro 已激活 · 感谢支持';
        em.innerHTML = '<i>✦</i>PRO';
        logo.appendChild(em);
      }
    } else if (em) {
      em.remove();
    }
  }
  /* 云同步静音（v1.1.1）：桌面版数据只在本机，autoPushToCloud 的「未配置云同步 Token」提示与桌面改造方向不符。
     v1.4.1：完全单机——清空数据的「同步清空云端」链路一并静默（pushWipeToCloud 的 Token toast = 老板实机看到的右上角弹窗）。 */
  function silenceCloudPush() {
    if (typeof window.autoPushToCloud === 'function') {
      window.autoPushToCloud = function () {};
    }
    if (typeof window.pushWipeToCloud === 'function') {
      window.pushWipeToCloud = function () {};
    }
  }

  /* ---------- 数据分析图表引擎（v1.3.0）：成绩 tab ECharts 重设计（cmInk 纸墨主题） ----------
     铁律：网页版零改动——接管 window.renderGradeAnalyticsDetail（挂原函数名下，Pro 页级锁不受影响）。
     echarts.min.js 按需加载（首次渲染成绩分析才注 <script>，file:// 本地毫秒级；失败/超时静默回退原实现）；
     数据为空 → 交给原实现渲染空态。颜色全部运行时读 CSS 变量（亮/暗/皮肤自适应），
     html class / data-skin 变化自动重渲染。口径与网页版一致：及格=人均≥60，优秀=人均≥85，满分=科数×100。 */
  var CM_ECHARTS_TIMEOUT = 15000;
  var cmEchartsState = '';                    // '' | 'loading' | 'ok' | 'fail'
  var cmEchartsCbs = [];
  var cmGradeCharts = {};                     // 容器 id → ECharts 实例
  var cmGradeThemeObs = null, cmGradeThemeT = 0, cmGradeResizeT = 0;
  var CM_GRADE_CHART_IDS = ['cmGxHist', 'cmGxDist', 'cmGxSubj', 'cmGxRadar', 'cmGxTrend', 'cmGxSlope'];   // 学分图表（cmGxCd*）共用实例表，释放按白名单防误杀

  function cmEchartsReady() { return typeof window.echarts === 'object' && window.echarts && typeof window.echarts.init === 'function'; }
  /* 网页版 state 是顶层 let（词法全局，不挂 window）——必须裸名访问，window.state 永远 undefined */
  function cmGxState() { try { return typeof state !== 'undefined' ? state : null; } catch (e) { return null; } }
  function cmLoadEcharts(cb) {
    if (cmEchartsState === 'ok') return cb(true);
    if (cmEchartsState === 'fail') return cb(false);
    cmEchartsCbs.push(cb);
    if (cmEchartsState === 'loading') return;
    cmEchartsState = 'loading';
    var done = false;
    var finish = function (okFlag) {
      if (done) return;
      done = true;
      cmEchartsState = okFlag ? 'ok' : 'fail';
      var list = cmEchartsCbs.splice(0);
      for (var i = 0; i < list.length; i++) { try { list[i](okFlag); } catch (e) {} }
    };
    var s = document.createElement('script');
    s.src = './echarts.min.js';
    s.onload = function () {
      var okFlag = cmEchartsReady();
      finish(okFlag);
      if (okFlag) { try { cmEchartsAfterLoad(); } catch (e) {} }   // 首访竞态兜底：懒加载完成后补画可见页图表
    };
    s.onerror = function () { finish(false); };
    document.head.appendChild(s);
    setTimeout(function () { finish(cmEchartsReady()); }, CM_ECHARTS_TIMEOUT);   // 挂死兜底（本地库损坏等极端情况）
  }
  function cmCssVar(n, fb) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; }
  }
  function cmGxIsDark() { return document.documentElement.classList.contains('dark'); }
  function cmGxFont() { try { return getComputedStyle(document.body).fontFamily || 'sans-serif'; } catch (e) { return 'sans-serif'; } }
  function cmGxPal() {
    return cmGxIsDark()
      ? ['#CE6B52', '#6FA3C8', '#4F9E77', '#D9A94E', '#9B86C2', '#93A5B3']
      : ['#A63A2B', '#3B6E8F', '#2F7D5B', '#C08A2D', '#6B5B95', '#7A8B99'];
  }
  function cmGxBucket() {                     // 五档色 = 网页版成绩五档原色，暗色提亮
    return cmGxIsDark()
      ? ['#D45A4A', '#D9A94E', '#6FA3C8', '#4F9E77', '#9B86C2']
      : ['#B42318', '#C08A2D', '#3B6E8F', '#2F7D5B', '#6B5B95'];
  }
  function cmGxShade(hex, f) {                // f>0 提亮 / f<0 压暗（渐变端点用）
    var s = String(hex || '');
    if (s.charAt(0) !== '#' || s.length !== 7) return s;
    var n = parseInt(s.slice(1), 16);
    if (isNaN(n)) return s;
    var ch = function (c) { return Math.round(Math.max(0, Math.min(255, f > 0 ? c + (255 - c) * f : c * (1 + f)))); };
    var r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function cmGxVGrad(top, bottom, horizontal) {
    var g = { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: top }, { offset: 1, color: bottom }] };
    if (horizontal) { g.x2 = 1; g.y2 = 0; }
    return g;
  }
  function cmGxRgba(hex, a) {
    var s = String(hex || '');
    if (s.charAt(0) !== '#' || s.length !== 7) return s;
    var n = parseInt(s.slice(1), 16);
    if (isNaN(n)) return s;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function cmGxEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cmGxTT(trigger) {
    return {
      trigger: trigger || 'item', backgroundColor: cmCssVar('--card-bg', '#FFFDF7'),
      borderColor: cmCssVar('--border', '#E6DECD'), borderWidth: 1, padding: [9, 13],
      textStyle: { color: cmCssVar('--text', '#2B2B33'), fontSize: 12, fontFamily: cmGxFont() },
      extraCssText: 'box-shadow:0 8px 24px rgba(25,22,19,.14);border-radius:10px;'
    };
  }
  function cmGxGrid(o) {
    var g = { left: 46, right: 24, top: 36, bottom: 30, containLabel: true };
    for (var k in (o || {})) g[k] = o[k];
    return g;
  }
  function cmGxAxisX(o) {
    var a = { type: 'category', axisLabel: { color: cmCssVar('--text-muted', '#8C8577'), fontSize: 11 }, axisLine: { lineStyle: { color: cmCssVar('--border', '#E6DECD') } }, axisTick: { show: false } };
    for (var k in (o || {})) a[k] = o[k];
    return a;
  }
  function cmGxAxisY(o) {
    var a = { type: 'value', axisLabel: { color: cmCssVar('--text-muted', '#8C8577'), fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: cmGxIsDark() ? 'rgba(234,228,214,.07)' : 'rgba(43,43,51,.06)' } } };
    for (var k in (o || {})) a[k] = o[k];
    return a;
  }
  function cmGxChart(id, option) {
    var dom = document.getElementById(id);
    if (!cmEchartsReady()) {
      if (!dom) return;
      cmLoadEcharts(function (okFlag) { if (okFlag) { try { cmEchartsAfterLoad(); } catch (e) {} } });
      return;
    }
    var old = window.echarts.getInstanceByDom(dom);
    if (old) { try { old.dispose(); } catch (e) {} }
    var c = window.echarts.init(dom);
    c.setOption(option);
    cmGradeCharts[id] = c;
  }
  /* 参考人数>0 的成绩聚合（口径同网页版：按学生 id 取分，缺科记 0，无分学生剔除） */
  function cmGxExamResults(exam) {
    var out = [];
    var st = cmGxState();
    var students = (st && st.students) || [];
    var scores = exam.scores || {};
    for (var i = 0; i < students.length; i++) {
      var sc = scores[students[i].id];
      if (!sc) continue;
      var keys = 0; for (var k in sc) keys++;
      if (!keys) continue;
      var total = 0, subs = exam.subjects || [];
      for (var j = 0; j < subs.length; j++) total += (sc[subs[j]] || 0);
      out.push({ stu: students[i], scores: sc, total: total });
    }
    return out;
  }
  function cmGxAgg(results, subsLen) {
    var n = results.length;
    if (!n || !subsLen) return null;
    var totals = results.map(function (r) { return r.total; });
    var sum = totals.reduce(function (a, b) { return a + b; }, 0);
    var avg = sum / n;
    var sq = totals.reduce(function (a, b) { return a + b * b; }, 0);
    var passLine = 60 * subsLen, excLine = 85 * subsLen;
    return {
      n: n, avg: avg, sd: Math.sqrt(sq / n - avg * avg),
      mx: Math.max.apply(null, totals), mn: Math.min.apply(null, totals),
      passLine: passLine, excLine: excLine,
      passRate: totals.filter(function (t) { return t >= passLine; }).length / n * 100,
      excRate: totals.filter(function (t) { return t >= excLine; }).length / n * 100,
      totals: totals
    };
  }
  /* 上一场 = 按日期排序后有成绩的考试里，当前考试的前一场 */
  function cmGxPrevExam(exam) {
    var exams = (cmGxState() && cmGxState().exams) || [];
    var withData = exams.filter(function (e) { return cmGxExamResults(e).length > 0; })
      .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    for (var i = 0; i < withData.length; i++) {
      if (withData[i].id === exam.id) return i > 0 ? withData[i - 1] : null;
    }
    return null;
  }
  function cmGxChip(cur, prev, goodUp, unit) {
    if (prev === null || prev === undefined || isNaN(prev)) return '<span class="cmGx-ktrend cmGx-flat">首场基准</span>';
    var d = cur - prev, up = d > 0.005, down = d < -0.005;
    var cls = (goodUp ? up : down) ? 'cmGx-up' : ((goodUp ? down : up) ? 'cmGx-down' : 'cmGx-flat');
    var arr = up ? '▲' : (down ? '▼' : '—');
    var txt = Math.abs(d) >= 100 ? String(Math.round(Math.abs(d))) : Math.abs(d).toFixed(1);
    return '<span class="cmGx-ktrend ' + cls + '">' + arr + ' ' + txt + (unit || '') + ' vs 上一场</span>';
  }
  function cmGradeRender(exam, detail) {
    var subs = exam.subjects || [];
    var subsLen = subs.length;
    var results = cmGxExamResults(exam);
    if (!results.length || !subsLen) return false;
    results.sort(function (a, b) { return b.total - a.total; });
    var agg = cmGxAgg(results, subsLen);
    if (!agg) return false;
    var maxPossible = subsLen * 100;
    var prevExam = cmGxPrevExam(exam);
    var prevAgg = prevExam ? cmGxAgg(cmGxExamResults(prevExam), (prevExam.subjects || []).length) : null;
    var pri = cmCssVar('--primary', '#A63A2B');
    var muted = cmCssVar('--text-muted', '#8C8577');
    var ink = cmCssVar('--text', '#2B2B33');

    /* 释放旧实例（白名单：学分 tab 的 cmGxCd* 图表共用实例表，不许误杀） */
    CM_GRADE_CHART_IDS.forEach(function (id) {
      if (cmGradeCharts[id]) { try { cmGradeCharts[id].dispose(); } catch (e) {} delete cmGradeCharts[id]; }
    });

    /* ---- HTML 骨架：KPI 带 + 六图卡 + 预警/排名 ---- */
    var h = '';
    h += '<div class="cmGx-kpis">';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">总分均分</div><div class="cmGx-kvalue">' + agg.avg.toFixed(1) + '<small>分</small></div>' + cmGxChip(agg.avg, prevAgg && prevAgg.avg, true) + '</div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">及格率（人均≥60）</div><div class="cmGx-kvalue">' + agg.passRate.toFixed(0) + '<small>%</small></div>' + cmGxChip(agg.passRate, prevAgg && prevAgg.passRate, true, ' pp') + '</div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">优秀率（人均≥85）</div><div class="cmGx-kvalue">' + agg.excRate.toFixed(0) + '<small>%</small></div>' + cmGxChip(agg.excRate, prevAgg && prevAgg.excRate, true, ' pp') + '</div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">标准差</div><div class="cmGx-kvalue">' + agg.sd.toFixed(1) + '<small>分</small></div>' + cmGxChip(agg.sd, prevAgg && prevAgg.sd, false) + '</div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">最高 / 最低</div><div class="cmGx-kvalue">' + agg.mx + '<small>/ ' + agg.mn + ' 分</small></div><span class="cmGx-ktrend cmGx-flat">' + agg.n + ' 人参考</span></div>';
    h += '</div>';
    h += '<div class="cmGx-grid2 gx-stagger">';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>总分直方图</div><div class="cmGx-cap">班级均分 / 及格线 / 优秀线一目了然 · 悬停查看区间人数</div><div id="cmGxHist" class="cmGx-chart"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>分数段构成</div><div class="cmGx-cap">五档口径与原版一致（按总分占满分比）</div><div id="cmGxDist" class="cmGx-chart"></div></div>';
    h += '</div>';
    h += '<div class="cmGx-grid2 gx-stagger">';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>各科均分</div><div class="cmGx-cap">基准线：60 及格 · 85 优秀 · 悬停看最高 / 最低 / 及格率</div><div id="cmGxSubj" class="cmGx-chart tall"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>单科得分率雷达</div><div class="cmGx-cap">' + (prevExam ? '本场 vs 上一场 · 看强弱科与进步面' : '各科均分均衡度（首场暂无对比）') + '</div><div id="cmGxRadar" class="cmGx-chart tall"></div></div>';
    h += '</div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>多场考试趋势</div><div class="cmGx-cap">总分均分（左轴）+ 及格率 / 优秀率（右轴）</div><div id="cmGxTrend" class="cmGx-chart"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>名次流动</div><div class="cmGx-cap">' + (prevExam ? '本场 vs 上一场 · 只显示变动 ≥ 4 名的学生 · 绿升红降' : '需要至少两场考试才能对比名次') + '</div><div id="cmGxSlope" class="cmGx-chart"></div></div>';
    h += '<div class="cmGx-grid2 gx-stagger">';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>学业预警</div><div class="cmGx-cap">口径：单科不及格 ≥ 2 科 · 或总分环比下滑 ≥ 10 分</div><div id="cmGxWarn"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>成绩排名 · 前 10</div><div class="cmGx-cap">条长 = 总分 / 班级最高</div><div id="cmGxTop"></div></div>';
    h += '</div>';
    detail.innerHTML = h;
    gxCountAnnotate(detail);

    /* ---- 总分直方图（分数刻度基准线挂隐藏二轴） ---- */
    var lo = Math.floor(agg.mn / 50) * 50, hi = Math.ceil(agg.mx / 50) * 50;
    if (hi <= lo) hi = lo + 50;
    var bins = [];
    for (var b = lo; b < hi; b += 50) bins.push({ lo: b, hi: b + 50, c: 0 });
    agg.totals.forEach(function (t) {
      for (var i = 0; i < bins.length; i++) { if (t >= bins[i].lo && t < bins[i].hi) { bins[i].c++; return; } }
      bins[bins.length - 1].c++;               // 恰好等于 hi 的极端值归末档
    });
    var y2max = Math.ceil(Math.max(agg.mx, agg.excLine, agg.avg) * 1.08 / 50) * 50;
    cmGxChart('cmGxHist', {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 34 }),
      xAxis: cmGxAxisX({ data: bins.map(function (x) { return x.lo + '–' + x.hi; }), boundaryGap: true }),
      yAxis: [cmGxAxisY({ minInterval: 1, max: Math.max.apply(null, bins.map(function (x) { return x.c; })) + 2 }),
              { type: 'value', min: 0, max: y2max, show: false }],
      series: [{ type: 'bar', barWidth: '55%', data: bins.map(function (x) { return x.c; }),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: cmGxVGrad(pri, cmGxShade(pri, -0.42)) },
        label: { show: true, position: 'top', color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontWeight: 600 },
        tooltip: { valueFormatter: function (v) { return v + ' 人'; } } },
        { type: 'line', data: [], yAxisIndex: 1,
          markLine: { symbol: 'none', silent: true, data: [
            { yAxis: agg.avg, lineStyle: { color: pri, width: 2 }, label: { formatter: '均分 ' + agg.avg.toFixed(0), color: pri, fontSize: 10, position: 'insideEndTop', fontWeight: 700 } },
            { yAxis: agg.passLine, lineStyle: { color: cmCssVar('--warning', '#C08A2D'), type: 'dashed', width: 1.2 }, label: { formatter: '及格 ' + agg.passLine, color: cmCssVar('--warning', '#C08A2D'), fontSize: 10, position: 'insideEndTop' } },
            { yAxis: agg.excLine, lineStyle: { color: cmCssVar('--success', '#2F7D5B'), type: 'dashed', width: 1.2 }, label: { formatter: '优秀 ' + agg.excLine, color: cmCssVar('--success', '#2F7D5B'), fontSize: 10, position: 'insideEndTop' } }
          ] } }]
    });

    /* ---- 分数段构成（五档环形） ---- */
    var bDefs = [
      { l: '0-40%', k: function (t) { return t < 0.4 * maxPossible; } },
      { l: '40-60%', k: function (t) { return t >= 0.4 * maxPossible && t < 0.6 * maxPossible; } },
      { l: '60-75%', k: function (t) { return t >= 0.6 * maxPossible && t < 0.75 * maxPossible; } },
      { l: '75-85%', k: function (t) { return t >= 0.75 * maxPossible && t < 0.85 * maxPossible; } },
      { l: '85%+', k: function (t) { return t >= 0.85 * maxPossible; } }
    ];
    var bCols = cmGxBucket();
    var distData = bDefs.map(function (d, i) {
      var c = agg.totals.filter(d.k).length;
      return { name: d.l + '（' + c + '人）', value: c, itemStyle: { color: bCols[i] } };
    });
    cmGxChart('cmGxDist', {
      tooltip: cmGxTT(),
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontFamily: cmGxFont() }, itemGap: 12 },
      title: { text: String(agg.n), subtext: '参考人数', left: 'center', top: '38%',
        textStyle: { fontSize: 26, fontWeight: 700, color: ink, fontFamily: cmGxFont() }, subtextStyle: { color: muted, fontSize: 11 } },
      series: [{ type: 'pie', radius: ['52%', '72%'], center: ['50%', '44%'], data: distData,
        itemStyle: { borderRadius: 5, borderColor: cmCssVar('--card-bg', '#FFFDF7'), borderWidth: 2 },
        label: { show: false }, emphasis: { scaleSize: 4 }, animationDuration: 900, animationEasing: 'cubicOut' }]
    });

    /* ---- 各科均分（横向条 + 60/85 基准线） ---- */
    var subj = subs.map(function (sj) {
      var arr = results.map(function (r) { return r.scores[sj]; }).filter(function (v) { return v !== undefined && v !== null; });
      if (!arr.length) return { s: sj, avg: 0, max: 0, min: 0, pass: 0 };
      return { s: sj, avg: arr.reduce(function (a, b) { return a + b; }, 0) / arr.length,
        max: Math.max.apply(null, arr), min: Math.min.apply(null, arr),
        pass: arr.filter(function (v) { return v >= 60; }).length / arr.length * 100 };
    }).sort(function (a, b) { return a.avg - b.avg; });
    cmGxChart('cmGxSubj', {
      tooltip: cmGxTT(),
      grid: cmGxGrid({ left: 30, top: 38, bottom: 16 }),
      xAxis: cmGxAxisY({ max: 100 }),
      yAxis: cmGxAxisX({ data: subj.map(function (x) { return x.s; }), axisLine: { show: false } }),
      series: [{ type: 'bar', barWidth: 13, data: subj.map(function (x) { return +x.avg.toFixed(1); }),
        itemStyle: { borderRadius: [0, 7, 7, 0], color: cmGxVGrad(cmGxShade(pri, 0.12), cmGxShade(pri, -0.28), true) },
        label: { show: true, position: 'right', color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontWeight: 600 },
        tooltip: { formatter: function (p) {
          var d = subj[p.dataIndex];
          return d.s + '<br>均分 <b>' + d.avg.toFixed(1) + '</b> · 最高 ' + d.max + ' · 最低 ' + d.min + '<br>及格率 ' + d.pass.toFixed(0) + '%';
        } },
        markLine: { symbol: 'none', silent: true, data: [
          { xAxis: 60, lineStyle: { color: cmCssVar('--warning', '#C08A2D'), type: 'dashed', width: 1.2 }, label: { formatter: '及格 60', color: cmCssVar('--warning', '#C08A2D'), fontSize: 10, position: 'end', distance: 8 } },
          { xAxis: 85, lineStyle: { color: cmCssVar('--success', '#2F7D5B'), type: 'dashed', width: 1.2 }, label: { formatter: '优秀 85', color: cmCssVar('--success', '#2F7D5B'), fontSize: 10, position: 'end', distance: 8 } }
        ] } }]
    });

    /* ---- 单科得分率雷达（本场 vs 上一场） ---- */
    function subjAvg(ex) {
      var rs = cmGxExamResults(ex);
      return subs.map(function (sj) {
        var arr = rs.map(function (r) { return r.scores[sj]; }).filter(function (v) { return v !== undefined && v !== null; });
        return arr.length ? +(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length).toFixed(1) : 0;
      });
    }
    var radarSeries = [{ name: '本场 · ' + exam.name, value: subjAvg(exam),
      lineStyle: { width: 2.5, color: pri }, itemStyle: { color: pri },
      areaStyle: { color: cmGxVGrad(cmGxShade(pri, 0.35), cmGxShade(pri, -0.1)), opacity: 0.30 }, symbol: 'circle', symbolSize: 4 }];
    var radarLegend = ['本场 · ' + exam.name];
    if (prevExam) {
      radarSeries.push({ name: '上一场 · ' + prevExam.name, value: subjAvg(prevExam),
        lineStyle: { width: 1.6, color: muted, type: 'dashed' }, itemStyle: { color: muted }, areaStyle: { opacity: 0.05 }, symbol: 'none' });
      radarLegend.push('上一场 · ' + prevExam.name);
    }
    cmGxChart('cmGxRadar', {
      tooltip: cmGxTT(),
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, data: radarLegend, textStyle: { color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontFamily: cmGxFont() }, itemGap: 16 },
      radar: { indicator: subs.map(function (s) { return { name: s, max: 100 }; }), radius: '62%', center: ['50%', '46%'], splitNumber: 4,
        axisName: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: cmGxIsDark() ? 'rgba(234,228,214,.10)' : 'rgba(43,43,51,.08)' } },
        splitArea: { areaStyle: { color: [cmGxIsDark() ? 'rgba(206,107,82,.04)' : 'rgba(166,58,43,.03)', 'transparent'] } },
        axisLine: { lineStyle: { color: cmGxIsDark() ? 'rgba(234,228,214,.10)' : 'rgba(43,43,51,.08)' } } },
      series: [{ type: 'radar', data: radarSeries, animationDuration: 900 }]
    });

    /* ---- 多场考试趋势（有成绩的考试按日期排） ---- */
    var trendExams = ((cmGxState() && cmGxState().exams) || []).filter(function (e) { return cmGxExamResults(e).length > 0; })
      .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    var trendAggs = trendExams.map(function (e) { return cmGxAgg(cmGxExamResults(e), (e.subjects || []).length); });
    var avgs = trendAggs.map(function (a) { return +a.avg.toFixed(1); });
    var passes = trendAggs.map(function (a) { return +a.passRate.toFixed(0); });
    var excs = trendAggs.map(function (a) { return +a.excRate.toFixed(0); });
    cmGxChart('cmGxTrend', {
      tooltip: cmGxTT('axis'),
      legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontFamily: cmGxFont() }, itemGap: 16 },
      grid: cmGxGrid({ left: 40, top: 34 }),
      xAxis: cmGxAxisX({ data: trendExams.map(function (e) { return e.name; }), boundaryGap: false }),
      yAxis: [cmGxAxisY({ min: Math.floor((Math.min.apply(null, avgs) - 25) / 50) * 50, name: '分', nameTextStyle: { color: muted, fontSize: 10 } }),
              cmGxAxisY({ min: 0, max: 100, name: '%', nameTextStyle: { color: muted, fontSize: 10 }, splitLine: { show: false } })],
      series: [
        { name: '总分均分', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, data: avgs,
          lineStyle: { width: 3, color: pri }, itemStyle: { color: pri, borderColor: cmCssVar('--card-bg', '#FFFDF7'), borderWidth: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: cmGxRgba(pri, 0.22) }, { offset: 1, color: cmGxRgba(pri, 0) }] } },
          label: { show: true, color: pri, fontWeight: 700, fontSize: 11 }, animationDuration: 900 },
        { name: '及格率', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6, data: passes, lineStyle: { width: 2, color: cmGxPal()[1] }, itemStyle: { color: cmGxPal()[1] }, animationDuration: 1000 },
        { name: '优秀率', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6, data: excs, lineStyle: { width: 2, color: cmGxPal()[2] }, itemStyle: { color: cmGxPal()[2] }, animationDuration: 1100 }
      ]
    });

    /* ---- 名次流动（斜率图，|Δ|≥4 取前 10） ---- */
    var rankNow = {};
    results.forEach(function (r, i) { rankNow[r.stu.id] = i + 1; });
    var movers = [];
    if (prevExam) {
      var prevResults = cmGxExamResults(prevExam).sort(function (a, b) { return b.total - a.total; });
      var rankPrev = {};
      prevResults.forEach(function (r, i) { rankPrev[r.stu.id] = i + 1; });
      results.forEach(function (r, i) {
        var pr = rankPrev[r.stu.id];
        if (pr && Math.abs(pr - (i + 1)) >= 4) movers.push({ name: r.stu.name, pr: pr, nr: i + 1, d: pr - (i + 1) });
      });
      movers.sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      movers = movers.slice(0, 10);
    }
    if (movers.length) {
      cmGxChart('cmGxSlope', {
        tooltip: { trigger: 'item', backgroundColor: cmCssVar('--card-bg', '#FFFDF7'), borderColor: cmCssVar('--border', '#E6DECD'), borderWidth: 1,
          padding: [9, 13], textStyle: { color: ink, fontSize: 12, fontFamily: cmGxFont() },
          extraCssText: 'box-shadow:0 8px 24px rgba(25,22,19,.14);border-radius:10px;',
          formatter: function (p) {
            var m = movers[p.seriesIndex];
            return cmGxEsc(m.name) + '<br>上次第 ' + m.pr + ' 名 → 本次第 ' + m.nr + ' 名（' + (m.d > 0 ? '+' : '') + m.d + '）';
          } },
        grid: cmGxGrid({ left: 20, right: 120, top: 20, bottom: 26 }),
        xAxis: cmGxAxisX({ data: ['上一场 · ' + prevExam.name, '本场 · ' + exam.name], boundaryGap: true }),
        yAxis: cmGxAxisY({ inverse: true, min: 0, max: results.length + 1, interval: 10, splitLine: { lineStyle: { color: cmGxIsDark() ? 'rgba(234,228,214,.05)' : 'rgba(43,43,51,.05)' } } }),
        series: movers.map(function (m) {
          var col = m.d > 0 ? cmCssVar('--success', '#2F7D5B') : cmCssVar('--danger', '#B42318');
          return { type: 'line', data: [[0, m.pr], [1, m.nr]], symbol: 'circle', symbolSize: 5,
            lineStyle: { width: 2, color: col, opacity: 0.8 }, itemStyle: { color: col },
            label: { show: true, fontSize: 10, color: col, fontWeight: 600,
              formatter: function (p) { return p.dataIndex === 0 ? ('第' + m.pr) : (cmGxEsc(m.name) + ' 第' + m.nr); } },
            labelLayout: { moveOverlap: 'shiftY' },
            animationDuration: 900, animationDelay: function (i) { return i * 120; } };
        })
      });
    } else if (prevExam) {
      document.getElementById('cmGxSlope').innerHTML = '<div class="cmGx-empty">本场名次变动都在 ±4 名内，班级格局稳定 ✨</div>';
    } else {
      document.getElementById('cmGxSlope').innerHTML = '<div class="cmGx-empty">考完下一场后，这里会画出每个人的名次升降</div>';
    }

    /* ---- 学业预警 ---- */
    var warns = [];
    results.forEach(function (r) {
      var fails = subs.filter(function (sj) { var v = r.scores[sj]; return v !== undefined && v !== null && v < 60; });
      if (fails.length >= 2) warns.push({ type: 'fail', name: r.stu.name, n: fails.length, subs: fails.slice(0, 3).join('、') + (fails.length > 3 ? ' 等' : ''), total: r.total });
    });
    if (prevExam) {
      var prevTotals = {};
      cmGxExamResults(prevExam).forEach(function (r) { prevTotals[r.stu.id] = r.total; });
      results.forEach(function (r) {
        var pt = prevTotals[r.stu.id];
        if (pt !== undefined && pt - r.total >= 10) warns.push({ type: 'drop', name: r.stu.name, n: pt - r.total, subs: '上次 ' + pt + ' → 本次 ' + r.total, total: r.total });
      });
    }
    warns.sort(function (a, b) { return (b.type === 'fail' ? b.n * 1000 : b.n) - (a.type === 'fail' ? a.n * 1000 : a.n); });
    var warnHtml = '';
    if (!warns.length) warnHtml = '<div class="cmGx-empty">✨ 本轮无预警学生</div>';
    else {
      warnHtml = warns.slice(0, 7).map(function (w) {
        if (w.type === 'fail') return '<div class="cmGx-warn"><span class="cmGx-rname" style="min-width:52px">' + cmGxEsc(w.name) + '</span><span class="cmGx-chip">' + w.n + ' 科不及格</span><span style="font-size:11px;color:var(--text-secondary,#5C574F);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + cmGxEsc(w.subs) + '</span><span style="font-size:11px;color:' + muted + ';flex:none">总分 ' + w.total + '</span></div>';
        return '<div class="cmGx-warn amber"><span class="cmGx-rname" style="min-width:52px">' + cmGxEsc(w.name) + '</span><span class="cmGx-chip amber">↓ ' + w.n + ' 分</span><span style="font-size:11px;color:var(--text-secondary,#5C574F);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + cmGxEsc(w.subs) + '</span><span style="font-size:11px;color:' + muted + ';flex:none">环比下滑</span></div>';
      }).join('');
      if (warns.length > 7) warnHtml += '<div style="font-size:11px;color:' + muted + ';padding-left:10px">… 另有 ' + (warns.length - 7) + ' 人，见完整名单</div>';
    }
    document.getElementById('cmGxWarn').innerHTML = warnHtml;

    /* ---- 排名前 10（数据条 + 奖牌色徽） ---- */
    var topHtml = results.slice(0, 10).map(function (r, i) {
      var cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
      var subsDet = subs.map(function (sj) { var v = r.scores[sj]; return sj + ' ' + (v !== undefined ? v : '—'); }).join(' · ');
      return '<div class="cmGx-rank"><div class="cmGx-rnum ' + cls + '">' + (i + 1) + '</div>' +
        '<div class="cmGx-rmain"><div class="cmGx-rname">' + cmGxEsc(r.stu.name) + '</div>' +
        '<div class="cmGx-rbar"><i style="width:' + (r.total / agg.mx * 100).toFixed(1) + '%"></i></div>' +
        '<div class="cmGx-rsubs">' + cmGxEsc(subsDet) + '</div></div>' +
        '<div class="cmGx-rscore">' + r.total + '</div></div>';
    }).join('');
    document.getElementById('cmGxTop').innerHTML = topHtml;
    return true;
  }
  function cmWrapGradeDetail() {
    var orig = window.renderGradeAnalyticsDetail;
    if (typeof orig !== 'function' || orig.__cmGradeEng) return;
    var wrapped = function () {
      var sel = document.getElementById('gradeAnalyticsExamSelect');
      var detail = document.getElementById('gradeAnalyticsDetail');
      if (!sel || !detail) { try { return orig.apply(this, arguments); } catch (e) {} return; }
      var exam = null;
      try {
        var exams = (cmGxState() && cmGxState().exams) || [];
        var eid = parseInt(sel.value, 10);
        for (var i = 0; i < exams.length; i++) { if (exams[i].id === eid) { exam = exams[i]; break; } }
      } catch (e) {}
      if (!exam || !exam.subjects || !exam.subjects.length) { try { return orig.apply(this, arguments); } catch (e) {} return; }
      if (!cmGxExamResults(exam).length) { try { return orig.apply(this, arguments); } catch (e) {} return; }   // 空态走原实现
      if (!cmEchartsReady()) {
        detail.innerHTML = '<div class="cmGx-loading">📊 图表引擎加载中…</div>';
        cmLoadEcharts(function (okFlag) {
          if (!okFlag) { try { orig(); } catch (e) {} return; }
          var p = document.getElementById('analyticsGradePanel');
          if (p && p.offsetParent !== null) window.renderGradeAnalyticsDetail();   // 就绪且成绩页仍在视野 → 重渲染
        });
        return;
      }
      cmGradeRender(exam, detail);
    };
    wrapped.__cmGradeEng = true;
    window.renderGradeAnalyticsDetail = wrapped;
  }
  function cmGradeResize() {
    clearTimeout(cmGradeResizeT);
    cmGradeResizeT = setTimeout(function () {
      for (var id in cmGradeCharts) { try { cmGradeCharts[id].resize(); } catch (e) {} }
    }, 120);
  }
  function cmGradeWatchTheme() {
    if (cmGradeThemeObs || !window.MutationObserver) return;
    cmGradeThemeObs = new MutationObserver(function () {
      clearTimeout(cmGradeThemeT);
      cmGradeThemeT = setTimeout(function () {
        var gp = document.getElementById('analyticsGradePanel');
        if (gp && gp.offsetParent !== null) window.renderGradeAnalyticsDetail();
        try { cmCreditChartsDirty = true; cmCreditFlushCharts(); } catch (e) {}   // 学分 tab 换肤/换皮肤也重渲染（v1.3.0 P1）
        try { cmGxThemeExtras(); } catch (e) {}                                    // 首页/公示图表换肤重渲染（v1.3.0 P2）
      }, 160);
    });
    cmGradeThemeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-skin'] });
    window.addEventListener('resize', cmGradeResize);
  }

  /* ---------- v1.3.0 P1：学分 tab 图表迁移（cmInk）----------
     口径与网页版逐字一致：学分 = Number(s.credit) 规范化；五档 = 预警<60 / 常规 60-110 / 进取 110-150 /
     卓越 150-200 / 巅峰 ≥200（及格线读 CB_ALERT_MIN）；流水一律过滤 state==='revoked'。
     接管 window.renderAnalytics（成绩 tab 激活时委托原函数重定向）；面板整体重建（旧 canvas/图例容器一并退役）；
     面板不可见时只刷 DOM、图表记脏，切回 credit tab（switchAnalyticsTab 链式包装）或换肤时补渲染。 */
  var cmCreditChartsDirty = false;
  var CM_CREDIT_BUCKETS = [
    { label: '预警', min: -Infinity, max: 60,      light: '#B42318', dark: '#D45A4A' },
    { label: '常规', min: 60,        max: 110,     light: '#3B6E8F', dark: '#6FA3C8' },
    { label: '进取', min: 110,       max: 150,     light: '#C0762B', dark: '#D08A45' },
    { label: '卓越', min: 150,       max: 200,     light: '#C9971B', dark: '#D9B23E' },
    { label: '巅峰', min: 200,       max: Infinity, light: '#A3301E', dark: '#CE5540' }
  ];
  function cmCreditCredits() {
    var st = cmGxState();
    var students = (st && st.students) || [];
    return students.map(function (s) { var n = Number(s.credit); return isNaN(n) ? 0 : n; });
  }
  function cmCreditVisible() {
    var p = document.getElementById('analyticsCreditPanel');
    return !!(p && p.offsetParent !== null);
  }
  function cmCreditDispose() {
    for (var id in cmGradeCharts) {
      if (id.indexOf('cmGxCd') === 0) { try { cmGradeCharts[id].dispose(); } catch (e) {} delete cmGradeCharts[id]; }
    }
  }
  function cmCreditBucketCols() {
    return CM_CREDIT_BUCKETS.map(function (b) { return cmGxIsDark() ? b.dark : b.light; });
  }
  function cmCreditRender(panel) {
    var credits = cmCreditCredits();
    var n = credits.length;
    if (!n) {
      panel.innerHTML = '<div class="cmGx-empty" style="padding:60px 10px">📈 暂无数据，先在「学生管理」导入学生</div>';
      cmCreditChartsDirty = false;
      return;
    }
    cmCreditDispose();
    var avg = credits.reduce(function (a, b) { return a + b; }, 0) / n;
    var sorted = credits.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    var variance = credits.reduce(function (s2, c) { return s2 + Math.pow(c - avg, 2); }, 0) / n;
    var std = Math.sqrt(variance);
    var mx = Math.max.apply(null, credits), mn = Math.min.apply(null, credits);
    var alertMin = 60;
    try { if (typeof CB_ALERT_MIN !== 'undefined') alertMin = CB_ALERT_MIN; } catch (e) {}
    var passRate = credits.filter(function (c) { return c >= alertMin; }).length / n * 100;
    var advRate = credits.filter(function (c) { return c >= 110; }).length / n * 100;
    var cntAlert = credits.filter(function (c) { return c < alertMin; }).length;
    var cntTop = credits.filter(function (c) { return c >= 200; }).length;

    var h = '';
    h += '<div class="cmGx-kpis cols6">';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">平均学分</div><div class="cmGx-kvalue">' + avg.toFixed(1) + '</div><span class="cmGx-ktrend cmGx-flat">' + n + ' 人</span></div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">中位数</div><div class="cmGx-kvalue">' + median + '</div><span class="cmGx-ktrend cmGx-flat">极差 ' + (mx - mn) + '</span></div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">标准差</div><div class="cmGx-kvalue">' + std.toFixed(2) + '</div><span class="cmGx-ktrend cmGx-flat">最高 ' + mx + '</span></div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">极差</div><div class="cmGx-kvalue">' + (mx - mn) + '</div><span class="cmGx-ktrend cmGx-flat">最低 ' + mn + '</span></div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">及格率（≥' + alertMin + '）</div><div class="cmGx-kvalue">' + passRate.toFixed(0) + '<small>%</small></div><span class="cmGx-ktrend ' + (cntAlert > 0 ? 'cmGx-down' : 'cmGx-up') + '">预警 ' + cntAlert + ' 人</span></div>';
    h += '<div class="cmGx-kpi"><div class="cmGx-klabel">进取率（≥110）</div><div class="cmGx-kvalue">' + advRate.toFixed(0) + '<small>%</small></div><span class="cmGx-ktrend cmGx-up">巅峰 ' + cntTop + ' 人</span></div>';
    h += '</div>';
    h += '<div class="cmGx-grid2 gx-stagger">';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>学分区间分布</div><div class="cmGx-cap">五档口径与原版一致 · 悬停看人数与占比</div><div id="cmGxCdRange" class="cmGx-chart"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>五档构成</div><div class="cmGx-cap">预警 &lt;60 · 常规 60-110 · 进取 110-150 · 卓越 150-200 · 巅峰 ≥200</div><div id="cmGxCdDonut" class="cmGx-chart"></div></div>';
    h += '</div>';
    h += '<div class="cmGx-grid2 gx-stagger">';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>近 7 天学分净变动</div><div class="cmGx-cap">全班逐日合计 · 绿为净加分 · 红为净扣分（不含已撤销）</div><div id="cmGxCdWk" class="cmGx-chart"></div></div>';
    h += '<div class="cmGx-card"><div class="cmGx-title"><i></i>本周进退步榜</div><div class="cmGx-cap">近 7 天净变动最大 8 人 · 不含已撤销</div><div id="cmGxCdMovers" class="cmGx-chart"><div class="cmGx-empty">近7天暂无学分变动</div></div></div>';
    h += '</div>';
    panel.innerHTML = h;
    gxCountAnnotate(panel);

    cmCreditChartsDirty = true;                    // 先记脏：flush 内部判定就绪与可见，未就绪不误清
    if (cmCreditVisible()) cmCreditFlushCharts();  // v1.5.0 修复：echarts 未就绪时保持脏标记，加载完成自动补画
  }
  function cmCreditDrawCharts(credits) {
    if (!credits.length) return;
    if (!cmEchartsReady()) { cmLoadEcharts(function (okFlag) { if (okFlag) { try { cmCreditChartsDirty = true; cmCreditFlushCharts(); } catch (e) {} } }); return; }   // 触发懒加载，完成后补画
    var n = credits.length;
    var cols = cmCreditBucketCols();
    var buckets = CM_CREDIT_BUCKETS.map(function (b, i) {
      return { label: b.label, count: credits.filter(function (c) { return c >= b.min && c < b.max; }).length, col: cols[i] };
    });
    var muted = cmCssVar('--text-muted', '#8C8577');
    var success = cmCssVar('--success', '#2F7D5B');
    var danger = cmCssVar('--danger', '#B42318');

    /* 区间分布柱 */
    cmGxChart('cmGxCdRange', {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 34 }),
      xAxis: cmGxAxisX({ data: buckets.map(function (b) { return b.label; }), boundaryGap: true }),
      yAxis: cmGxAxisY({ minInterval: 1, max: Math.max.apply(null, buckets.map(function (b) { return b.count; })) + 2 }),
      series: [{ type: 'bar', barWidth: '52%',
        data: buckets.map(function (b) { return { value: b.count, itemStyle: { borderRadius: [6, 6, 0, 0], color: cmGxVGrad(cmGxShade(b.col, 0.18), b.col) } }; }),
        label: { show: true, position: 'top', color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontWeight: 600 },
        tooltip: { formatter: function (p) {
          var b = buckets[p.dataIndex];
          return b.label + '：' + b.count + ' 人（' + (b.count / n * 100).toFixed(0) + '%）';
        } },
        animationDuration: 900, animationDelay: function (i) { return i * 90; } }]
    });

    /* 五档构成环形（原 pieChart + #pieLegend 一体化） */
    cmGxChart('cmGxCdDonut', {
      tooltip: cmGxTT(),
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontFamily: cmGxFont() }, itemGap: 12 },
      title: { text: String(n), subtext: '总人数', left: 'center', top: '38%',
        textStyle: { fontSize: 26, fontWeight: 700, color: cmCssVar('--text', '#2B2B33'), fontFamily: cmGxFont() }, subtextStyle: { color: muted, fontSize: 11 } },
      series: [{ type: 'pie', radius: ['52%', '72%'], center: ['50%', '44%'],
        data: buckets.map(function (b) { return { name: b.label + '（' + b.count + '人）', value: b.count, itemStyle: { color: b.col } }; }),
        itemStyle: { borderRadius: 5, borderColor: cmCssVar('--card-bg', '#FFFDF7'), borderWidth: 2 },
        label: { show: false }, emphasis: { scaleSize: 4 }, animationDuration: 900, animationEasing: 'cubicOut' }]
    });

    /* 近 7 天净变动 diverging 柱 */
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      var start = d.getTime(), end = start + 86400000;
      var ops = (((cmGxState() || {}).operations) || []).filter(function (o) { return o.time >= start && o.time < end && !(o.state === 'revoked'); });
      days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), total: ops.reduce(function (s2, o) { return s2 + o.amount; }, 0) });
    }
    cmGxChart('cmGxCdWk', {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 40, top: 24 }),
      xAxis: cmGxAxisX({ data: days.map(function (x) { return x.label; }) }),
      yAxis: cmGxAxisY(),
      series: [{ type: 'bar', barWidth: '46%',
        data: days.map(function (x) { return { value: x.total,
          label: { position: x.total >= 0 ? 'top' : 'bottom', formatter: x.total === 0 ? '' : (x.total > 0 ? '+' : '') + x.total, color: x.total >= 0 ? success : danger, fontSize: 10, fontWeight: 600 },
          itemStyle: { borderRadius: x.total >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6],
            color: x.total >= 0 ? cmGxVGrad(cmGxShade(success, 0.25), success) : cmGxVGrad(danger, cmGxShade(danger, -0.3)) } }; }),
        markLine: { symbol: 'none', silent: true, data: [{ yAxis: 0, lineStyle: { color: muted, width: 1 } }] },
        animationDuration: 900 }]
    });

    /* 本周进退步榜（近 7 天人均净变动，|net| 最大 8 人；原 renderProgressList 数据口径） */
    var now = Date.now(), weekAgo = now - 7 * 86400000;
    var students = (cmGxState() && cmGxState().students) || [];
    var allops = ((cmGxState() && cmGxState().operations) || []);
    var changes = students.map(function (s) {
      var ops = allops.filter(function (o) { return o.studentId === s.id && o.time >= weekAgo && !(o.state === 'revoked'); });
      return { name: s.name, net: ops.reduce(function (sum, o) { return sum + o.amount; }, 0), opCount: ops.length };
    }).filter(function (c) { return c.opCount > 0; });
    if (changes.length) {
      var pick = changes.sort(function (a, b) { return Math.abs(b.net) - Math.abs(a.net); }).slice(0, 8)
        .sort(function (a, b) { return a.net - b.net; });   // 横条自下而上：最大退步在底、最大进步在顶
      cmGxChart('cmGxCdMovers', {
        tooltip: { trigger: 'item', backgroundColor: cmCssVar('--card-bg', '#FFFDF7'), borderColor: cmCssVar('--border', '#E6DECD'), borderWidth: 1,
          padding: [9, 13], textStyle: { color: cmCssVar('--text', '#2B2B33'), fontSize: 12, fontFamily: cmGxFont() },
          extraCssText: 'box-shadow:0 8px 24px rgba(25,22,19,.14);border-radius:10px;',
          formatter: function (p) {
            var c = pick[p.dataIndex];
            return cmGxEsc(c.name) + '<br>本周净 ' + (c.net > 0 ? '+' : '') + c.net + ' 分（' + c.opCount + ' 次操作）';
          } },
        grid: cmGxGrid({ left: 20, right: 56, top: 10, bottom: 10 }),
        xAxis: cmGxAxisY({ show: false }),
        yAxis: cmGxAxisX({ type: 'category', data: pick.map(function (c) { return c.name; }), axisLine: { show: false } }),
        series: [{ type: 'bar', barWidth: 12,
          data: pick.map(function (c) { return { value: c.net,
            label: { position: c.net >= 0 ? 'right' : 'left', formatter: function (p) { return (p.value > 0 ? '+' : '') + p.value; }, color: c.net >= 0 ? success : danger, fontSize: 11, fontWeight: 600 },
            itemStyle: { borderRadius: 6, color: c.net >= 0 ? cmGxVGrad(cmGxShade(success, 0.2), success, true) : cmGxVGrad(danger, cmGxShade(danger, -0.3), true) } }; }),
          animationDuration: 900, animationDelay: function (i) { return i * 60; } }]
      });
    } else {
      document.getElementById('cmGxCdMovers').innerHTML = '<div class="cmGx-empty">近7天暂无学分变动</div>';
    }
  }
  function cmCreditFlushCharts() {
    if (!cmCreditChartsDirty || !cmCreditVisible()) return;
    var credits = cmCreditCredits();
    if (!credits.length || !document.getElementById('cmGxCdRange')) return;
    cmCreditDrawCharts(credits);
    cmCreditChartsDirty = false;
  }
  function cmWrapCreditRender() {
    var orig = window.renderAnalytics;
    if (typeof orig !== 'function' || orig.__cmGxCredit) return;
    var wrapped = function () {
      var gradeActive = false;
      try { gradeActive = document.getElementById('tab-grade').classList.contains('active'); } catch (e) {}
      if (gradeActive) return orig.apply(this, arguments);   // 成绩 tab：原函数自带重定向到 renderGradeAnalytics（已被图表引擎接管）
      var panel = document.getElementById('analyticsCreditPanel');
      if (!panel) return orig.apply(this, arguments);
      var st = cmGxState();
      if (!st || !st.students || !st.students.length) {
        panel.innerHTML = '<div class="cmGx-empty" style="padding:60px 10px">📈 暂无数据，先在「学生管理」导入学生</div>';
        cmCreditChartsDirty = false;
        return;
      }
      cmCreditRender(panel);
    };
    wrapped.__cmGxCredit = true;
    window.renderAnalytics = wrapped;
  }
  function cmWrapCreditTabSwitch() {
    var prev = window.switchAnalyticsTab;
    if (typeof prev !== 'function' || prev.__cmGxTab) return;
    var w = function (tab) {
      var r = prev.apply(this, arguments);
      try { if (tab === 'credit') cmCreditFlushCharts(); } catch (e) {}
      return r;
    };
    w.__cmGxTab = true;
    window.switchAnalyticsTab = w;
  }

  /* ---------- v1.3.0 P2：首页学分分布 + 公示页四图（cmInk 统一）----------
     口径逐字复刻网页版：首页 = drawDistChart 自适应八档（lo=floor(min/5)*5，hi=ceil((max+1)/5)*5，≥8 档）；
     公示 = 趋势（30 天人均，流水反推）/ 每日（14 天加扣 diverging）/ 分布（五档）/ 原因（Top6 按条数）。
     手法：canvas 原地隐藏 + 等尺寸 div 顶替（cmGxSwapCanvas），实例进共享表（cmGxDashDist / cmGxPub_* id）。
     海报导出（drawPubPoster/drawWeeklyPoster）与荣誉证书 canvas 为导出自绘制品，不接管。 */
  function cmGxPageLive(id) {
    var p = document.getElementById(id);
    return !!(p && p.classList && p.classList.contains('active') && p.offsetParent !== null);
  }
  function cmGxSwapCanvas(canvasId, boxId) {
    var box = document.getElementById(boxId);
    if (box) return box;                                     // 已顶替过
    var cv = document.getElementById(canvasId);
    if (!cv) return null;
    if (cv.getBoundingClientRect().width < 10) return null;  // 未布局：调用方 rAF 重试（原实现同款）
    box = el('div');
    box.id = boxId;
    box.className = 'cmGx-chart';
    box.style.cssText = 'width:100%;height:' + Math.max(Math.round(cv.getBoundingClientRect().height), 120) + 'px';
    cv.style.display = 'none';
    cv.parentNode.appendChild(box);
    return box;
  }
  function cmGxDropChart(id, box) {
    var old = cmGradeCharts[id];
    if (old) { try { old.dispose(); } catch (e) {} delete cmGradeCharts[id]; }
    if (box) box.innerHTML = '<div class="cmGx-empty">暂无数据</div>';
  }
  function cmWrapDistChart() {
    var orig = window.drawDistChart;
    if (typeof orig !== 'function' || orig.__cmGxDist) return;
    var wrapped = function (credits) {
      var box = document.getElementById('cmGxDashDist') || cmGxSwapCanvas('distChart', 'cmGxDashDist');
      if (!box) {
        var cv = document.getElementById('distChart');
        if (!cv) return;
        requestAnimationFrame(function () { window.drawDistChart(credits); });   // 未布局重试（原实现同款）
        return;
      }
      var nums = (credits || []).map(function (c) { var n = Number(c); return isNaN(n) ? 0 : n; });
      if (!nums.length) { cmGxDropChart('cmGxDashDist', box); return; }
      var maxv = Math.max.apply(null, nums.concat([10]));
      var numBuckets = 8;
      var lo = Math.floor(Math.min.apply(null, nums) / 5) * 5;
      var hi = Math.ceil((maxv + 1) / 5) * 5;
      if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 100; }
      if (hi - lo < numBuckets) hi = lo + numBuckets;
      var span = (hi - lo) / numBuckets;
      var counts = [];
      for (var bi = 0; bi < numBuckets; bi++) counts.push(0);
      nums.forEach(function (c) { var idx = Math.floor((c - lo) / span); if (idx < 0) idx = 0; if (idx >= numBuckets) idx = numBuckets - 1; counts[idx]++; });
      var bucketLabel = function (i) { return Math.round(lo + span * i) + '-' + Math.round(lo + span * (i + 1) - 1); };
      var pri = cmCssVar('--primary', '#A63A2B');
      cmGxChart('cmGxDashDist', {
        tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 34, top: 24, bottom: 26 }),
        xAxis: cmGxAxisX({ data: counts.map(function (v, i) { return bucketLabel(i); }), axisLabel: { color: cmCssVar('--text-muted', '#8C8577'), fontSize: 10, interval: 0 } }),
        yAxis: cmGxAxisY({ minInterval: 1, max: Math.max.apply(null, counts) + 2 }),
        series: [{ type: 'bar', barWidth: '60%', data: counts,
          itemStyle: { borderRadius: [6, 6, 0, 0], color: cmGxVGrad(cmGxShade(pri, 0.18), cmGxShade(pri, -0.18)) },
          label: { show: true, position: 'top', color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontWeight: 600 },
          tooltip: { valueFormatter: function (v) { return v + ' 人'; } },
          animationDuration: 900, animationDelay: function (i) { return i * 60; } }]
      });
    };
    wrapped.__cmGxDist = true;
    window.drawDistChart = wrapped;
  }
  function cmPubTrendOption(students, operations) {
    if (!students || !students.length) return null;
    var dayMs = 86400000, days = 30;
    var t0 = new Date(); t0.setHours(0, 0, 0, 0); var todayStart = t0.getTime();
    var tNow = Date.now();                                   // 原版口径：当日流水全计入（time <= tNow）
    var n = students.length;
    var totalNow = 0; students.forEach(function (s) { var x = Number(s.credit); totalNow += isNaN(x) ? 0 : x; });
    var xs = [], ys = [];
    for (var i = days - 1; i >= 0; i--) {
      var ts = todayStart - i * dayMs;
      var gain = 0;
      (operations || []).forEach(function (o) { if (o && o.time >= ts && o.time <= tNow) gain += (Number(o.amount) || 0); });
      xs.push(new Date(ts));
      ys.push(+((totalNow - gain) / n).toFixed(1));
    }
    var mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
    if (mx - mn < 1) { mn -= 1; mx += 1; }
    var pad = (mx - mn) * 0.12;
    var success = cmCssVar('--success', '#2F7D5B');
    return {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 34, right: 14, top: 14, bottom: 22 }),
      xAxis: cmGxAxisX({ type: 'category', boundaryGap: false,
        data: xs.map(function (d, i) { return i % 5 === 0 ? ((d.getMonth() + 1) + '/' + d.getDate()) : ''; }) }),
      yAxis: cmGxAxisY({ min: Math.floor(mn - pad), max: Math.ceil(mx + pad) }),
      series: [{ type: 'line', data: ys, symbol: 'none', lineStyle: { width: 2, color: success }, itemStyle: { color: success },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: cmGxRgba(success, 0.22) }, { offset: 1, color: cmGxRgba(success, 0.02) }] } },
        animationDuration: 900 }]
    };
  }
  function cmPubDailyOption(operations) {
    if (!operations || !operations.length) return null;
    var dayMs = 86400000, days = 14;
    var t0 = new Date(); t0.setHours(0, 0, 0, 0); var todayStart = t0.getTime();
    var data = [];
    for (var i = days - 1; i >= 0; i--) data.push({ ts: todayStart - i * dayMs, add: 0, sub: 0 });
    (operations || []).forEach(function (o) {
      if (!o || typeof o.time !== 'number') return;
      var idx = Math.floor((o.time - todayStart) / dayMs) + days - 1;
      if (idx < 0 || idx >= days) return;
      var a = Number(o.amount) || 0;
      if (a > 0) data[idx].add += a; else if (a < 0) data[idx].sub -= a;
    });
    var success = cmCssVar('--success', '#2F7D5B'), danger = cmCssVar('--danger', '#B42318');
    return {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 34, right: 14, top: 16, bottom: 22 }),
      xAxis: cmGxAxisX({ data: data.map(function (d, i) { var dd = new Date(d.ts); return i % 2 === 0 ? ((dd.getMonth() + 1) + '/' + dd.getDate()) : ''; }) }),
      yAxis: cmGxAxisY(),
      series: [
        { name: '加分', type: 'bar', stack: 'cmPub', barWidth: '55%', data: data.map(function (d) { return d.add; }),
          itemStyle: { borderRadius: [4, 4, 0, 0], color: cmGxVGrad(cmGxShade(success, 0.2), success) }, animationDuration: 900 },
        { name: '扣分', type: 'bar', stack: 'cmPub', barWidth: '55%', data: data.map(function (d) { return -d.sub; }),
          itemStyle: { borderRadius: [0, 0, 4, 4], color: cmGxVGrad(danger, cmGxShade(danger, -0.3)) }, animationDuration: 900 },
        { type: 'line', data: [], markLine: { symbol: 'none', silent: true, data: [{ yAxis: 0, lineStyle: { color: cmCssVar('--text-muted', '#8C8577'), width: 1 } }] } }
      ]
    };
  }
  function cmPubDistOption(students) {
    if (!students || !students.length) return null;
    var n = students.length;
    var cols = cmCreditBucketCols();
    var buckets = CM_CREDIT_BUCKETS.map(function (b, i) {
      var count = students.filter(function (s) { var c = Number(s.credit); if (isNaN(c)) c = 0; return c >= b.min && c < b.max; }).length;
      return { label: b.label, count: count, col: cols[i] };
    });
    return {
      tooltip: cmGxTT('axis'), grid: cmGxGrid({ left: 30, top: 24, bottom: 26 }),
      xAxis: cmGxAxisX({ data: buckets.map(function (b) { return b.label; }), boundaryGap: true }),
      yAxis: cmGxAxisY({ minInterval: 1, max: Math.max.apply(null, buckets.map(function (b) { return b.count; })) + 2 }),
      series: [{ type: 'bar', barWidth: '55%',
        data: buckets.map(function (b) { return { value: b.count, itemStyle: { borderRadius: [6, 6, 0, 0], color: cmGxVGrad(cmGxShade(b.col, 0.18), b.col) } }; }),
        label: { show: true, position: 'top', color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 11, fontWeight: 600 },
        tooltip: { formatter: function (p) {
          var b = buckets[p.dataIndex];
          return b.label + '：' + b.count + ' 人（' + (b.count / n * 100).toFixed(0) + '%）';
        } },
        animationDuration: 900, animationDelay: function (i) { return i * 80; } }]
    };
  }
  function cmPubReasonOption(operations) {
    if (!operations || !operations.length) return null;
    var cnt = {};
    (operations || []).forEach(function (o) { if (!o) return; var r = o.reason || '未填原因'; cnt[r] = (cnt[r] || 0) + 1; });
    var arr = Object.keys(cnt).map(function (r) { return { label: r, n: cnt[r] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
    var total = arr.reduce(function (s, x) { return s + x.n; }, 0);
    if (!total) return null;
    var palette = ['#2F7D5B', '#C08A2D', '#6B5B95', '#3B6E8F', '#B42318', '#8C6242'];
    return {
      tooltip: cmGxTT(),
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: cmCssVar('--text-secondary', '#5C574F'), fontSize: 10, fontFamily: cmGxFont() }, itemGap: 8 },
      title: { text: total + ' 条', subtext: '原因分布', left: 'center', top: '34%',
        textStyle: { fontSize: 17, fontWeight: 700, color: cmCssVar('--text', '#2B2B33'), fontFamily: cmGxFont() }, subtextStyle: { color: cmCssVar('--text-muted', '#8C8577'), fontSize: 10 } },
      series: [{ type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
        data: arr.map(function (x, i) { return { name: x.label + ' ' + x.n, value: x.n, itemStyle: { color: palette[i % palette.length] } }; }),
        itemStyle: { borderRadius: 5, borderColor: cmCssVar('--card-bg', '#FFFDF7'), borderWidth: 2 },
        label: { show: false }, emphasis: { scaleSize: 4 }, animationDuration: 900, animationEasing: 'cubicOut' }]
    };
  }
  function cmWrapPubOne(fnName, canvasId, optFn) {
    var orig = window[fnName];
    if (typeof orig !== 'function' || orig.__cmGxPub) return;
    var wrapped = function () {
      var args = Array.prototype.slice.call(arguments);
      var box = document.getElementById(canvasId + '__gx') || cmGxSwapCanvas(canvasId, canvasId + '__gx');
      if (!box) {
        var cv = document.getElementById(canvasId);
        if (!cv) return;
        requestAnimationFrame(function () { window[fnName].apply(null, args); });
        return;
      }
      var opt = optFn(args);
      if (opt) cmGxChart(canvasId + '__gx', opt);              // key = 容器 id（cmGxChart 按它找 DOM）
      else cmGxDropChart(canvasId + '__gx', box);
    };
    wrapped.__cmGxPub = true;
    window[fnName] = wrapped;
  }
  function cmWrapPubCharts() {
    cmWrapPubOne('drawPubTrend', 'pubTrendChart', function (args) { return cmPubTrendOption(args[1], args[2]); });
    cmWrapPubOne('drawPubDaily', 'pubDailyChart', function (args) { return cmPubDailyOption(args[1]); });
    cmWrapPubOne('drawPubDist', 'pubDistChart', function (args) { return cmPubDistOption(args[1]); });
    cmWrapPubOne('drawPubReason', 'pubReasonChart', function (args) {
      var lg = document.getElementById(args[1]);                 // 原因图例并入 ECharts，原 HTML 图例退役
      if (lg) lg.style.display = 'none';
      return cmPubReasonOption(args[2]);
    });
  }
  function cmGxThemeExtras() {                                  // 换肤/亮暗：可见页的首页与公示图表同步重渲染
    if (!cmEchartsReady()) return;
    var st = cmGxState();
    if (!st) return;
    if (cmGxPageLive('page-dashboard') && st.students && st.students.length) {
      window.drawDistChart(st.students.map(function (s) { return s.credit; }));
    }
    if (cmGxPageLive('page-publicity')) {
      window.drawPubTrend('pubTrendChart', st.students || [], st.operations || []);
      window.drawPubDaily('pubDailyChart', st.operations || []);
      window.drawPubDist('pubDistChart', st.students || []);
      window.drawPubReason('pubReasonChart', 'pubReasonLegend', st.operations || []);
    }
  }

  /* ---------- v1.4.0 界面符号统一（Lucide）+ 工作留痕/荣誉墙重设计 ----------
     图标体系：Lucide v0.544.0（ISC License，github.com/lucide-icons/lucide，24.9k★）
     —— 与网页版既有 29 枚 stroke sprite 同风格（线性描边/round cap），符号表在 src/gx-icons.js
     （window.__GX_ICONS，构建期由 _gen_gx_icons.js 从 lucide-static 提取，勿手改）。
     emoji 清扫：只扫 UI 容器（标题/按钮/统计/空态/toast/注入层 UI）的「行首装饰 emoji」，
     绝不碰用户内容文本（日志标题/内容、荣誉描述、学生姓名）。
     工作留痕：接管 renderWorkLogs——日期选择器退役 → 本周/本月/本学期/全部 周期筛选（默认本月），
     按时间倒序流水；HEIC 等解码失败的图入库时拦截 + 缩略图渲染兜底。
     荣誉墙：接管 renderHonors——卡片重设计 + 点卡片出证书预览弹窗；接管 drawHonorCertCanvas
     —— 奖状式重排：顶部学校名称（设置页「学校信息（桌面版）」卡可填，localStorage cm_school_name），
     姓名左顶格 + 「同学：」，朱砂印章落款。学分公示/荣誉墙侧栏同图标问题：荣誉墙改 #gx-award。 */
  function gxIc(name, cls) {
    return '<svg class="gx-ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#gx-' + name + '"/></svg>';
  }
  /* echarts 懒加载完成后的首访竞态兜底（v1.5.0）：重画当前可见页的图表 */
  function cmEchartsAfterLoad() {
    try {
      var st = cmGxState();
      if (cmGxPageLive('page-analytics')) {
        var gp = document.getElementById('analyticsGradePanel');
        if (gp && gp.offsetParent !== null) { if (appFn('renderGradeAnalyticsDetail')) window.renderGradeAnalyticsDetail(); }
        else if (appFn('renderAnalytics')) window.renderAnalytics();
      }
      if (cmGxPageLive('page-dashboard') && st && st.students && st.students.length && appFn('drawDistChart')) {
        window.drawDistChart(st.students.map(function (s) { return s.credit; }));
      }
      if (cmGxPageLive('page-publicity') && appFn('drawPubTrend')) {
        window.drawPubTrend('pubTrendChart', st.students || [], st.operations || []);
        window.drawPubDaily('pubDailyChart', st.operations || []);
        window.drawPubDist('pubDistChart', st.students || []);
        window.drawPubReason('pubReasonChart', 'pubReasonLegend', st.operations || []);
      }
    } catch (e) {}
  }
  /* ---------- v1.5.0 动效系统（cmMotion）----------
     原则：只动 transform/opacity；prefers-reduced-motion 或 cm_motion_off=1 全关；
     控制台 localStorage.setItem('cm_motion_off','1') + 刷新 可 A/B。 */
  function gxMotionOn() {
    if (lsGet('cm_motion_off') === '1') return false;
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return true;
  }
  function gxCloseMask(mask) {
    if (!mask || !mask.parentNode) return;
    if (!gxMotionOn()) { mask.parentNode.removeChild(mask); return; }
    mask.classList.add('gx-closing');
    setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 180);
  }
  /* KPI 数字滚动（v1.5.1 重设计）：渲染时只「标注」目标值（文本保持最终值——
     后台渲染/隐藏窗口不产生冻结的 0）；页面可见时才播放 0→目标 的滚动。
     旧实现在渲染时直接起 rAF 动画，隐藏窗口 rAF 冻结 → KPI 永远显示 0（老板实机抓到）。 */
  function gxCountAnnotate(root) {
    if (!root || !root.querySelectorAll) return;
    var els = root.querySelectorAll('.cmGx-kvalue');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var node = el.firstChild;
      var m = String((node && node.nodeValue) || '').match(/^[\d.]+/);
      if (!m) continue;
      el.setAttribute('data-gx-count', m[0]);
      el.setAttribute('data-gx-dec', String((m[0].split('.')[1] || '').length));
    }
  }
  var _gxTweenUntil = 0;
  function gxWriteCounters(e2) {
    var all = document.querySelectorAll('.cmGx-kvalue[data-gx-count]');
    for (var i = 0; i < all.length; i++) {
      var n = all[i].firstChild;
      var tv = parseFloat(all[i].getAttribute('data-gx-count'));
      var d = parseInt(all[i].getAttribute('data-gx-dec') || '0', 10);
      if (n && !isNaN(tv)) n.nodeValue = (e2 === 1) ? tv.toFixed(d) : (tv * e2).toFixed(d);
    }
  }
  function gxPlayCounters(root) {
    if (!gxMotionOn() || !root || !root.querySelectorAll) return;
    /* v1.5.2：隐藏窗口不起播（文本已是最终值、不标 played——窗口转可见由 revive 补播） */
    if (document.hidden) return;
    var els = root.querySelectorAll('.cmGx-kvalue[data-gx-count]');
    var fresh = 0;
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-gx-played') !== '1') { els[i].setAttribute('data-gx-played', '1'); fresh++; }
    }
    if (!fresh) return;
    /* v1.5.3 重设计（探针 _probe_kpi_tween 实测复现跳变）：首访 echarts 懒加载补画会整板
       重渲 KPI——旧实现绑死单个文本节点，节点被替换即断片（0.0 停 ~700ms 后一帧跳最终值）。
       ticker 每帧重查全部标注元素写当前缓动值：重渲出的新节点自动接管、从当前进度续滚。 */
    var now = performance.now();
    if (_gxTweenUntil > now) return;   // 滚动在途：ticker 每帧全量接管，无需叠加
    var t0 = now, dur = 640;
    _gxTweenUntil = t0 + dur + 50;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e2 = 1 - Math.pow(1 - p, 3);
      gxWriteCounters(e2);
      if (p < 1) requestAnimationFrame(tick); else { gxWriteCounters(1); _gxTweenUntil = 0; }
    })(t0);
    /* v1.5.2 保险栓：rAF 冻结/遮挡 → 定时兜底写最终值（滚动在途时让位给新 ticker 自己的保险栓） */
    setTimeout(function () { if (!_gxTweenUntil) gxWriteCounters(1); }, dur + 220);
  }
  function gxStagger(el) { if (el && gxMotionOn()) el.classList.add('gx-stagger'); }
  function gxInjectSprite() {
    if (document.getElementById('gxSprite')) return;
    var icons = window.__GX_ICONS || {};
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" id="gxSprite" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">';
    for (var k in icons) svg += '<symbol id="gx-' + k + '" viewBox="0 0 24 24">' + icons[k] + '</symbol>';
    svg += '</svg>';
    var holder = el('div');
    holder.style.display = 'none';
    holder.innerHTML = svg;
    document.body.insertBefore(holder, document.body.firstChild);
  }
  /* emoji → Lucide 映射（键含 ZWJ/VS16 序列，匹配时按长度降序） */
  var GX_EMOJI_MAP = {
    '📋': 'clipboard-list', '🏆': 'trophy', '📁': 'folder-open', '🏦': 'landmark',
    '👥': 'users', '✅': 'circle-check', '📈': 'trending-up', '⭐': 'star',
    '🎖': 'medal', '🏅': 'medal', '📅': 'calendar', '🗓': 'calendar', '🗓️': 'calendar',
    '🔍': 'search', '🖼': 'image', '🖼️': 'image', '📄': 'file-text', '📃': 'file-text',
    '💾': 'save', '📂': 'folder-open', '🔄': 'refresh-cw', '🗑': 'trash-2', '🗑️': 'trash-2',
    '＋': 'plus', '➕': 'plus', '🚀': 'rocket', '🔓': 'lock-open', '🔐': 'lock', '🔒': 'lock',
    '✉': 'mail', '✉️': 'mail', '🎓': 'graduation-cap', '📦': 'package', '🖥': 'monitor',
    '🖥️': 'monitor', '💻': 'monitor', '📱': 'monitor', '🌙': 'moon', '☀': 'sun', '☀️': 'sun',
    '☁': 'cloud', '☁️': 'cloud', '⚠': 'triangle-alert', '⚠️': 'triangle-alert',
    'ℹ': 'info', 'ℹ️': 'info', '❌': 'circle-x', '👋': 'hand', '✨': 'sparkles',
    '🌟': 'sparkles', '👑': 'crown', '📊': 'chart-column', '📈': 'trending-up',
    '📝': 'pen-line', '✏': 'pen-line', '✏️': 'pen-line', '🎨': 'palette',
    '🏷': 'tag', '🏷️': 'tag', '👩‍💼': 'user-cog', '💼': 'briefcase', '🚨': 'bell-ring',
    '⛔': 'ban', '🏫': 'school', '📣': 'megaphone', '📢': 'megaphone', '🔔': 'bell-ring',
    '📷': 'camera', '🎯': 'target', '💡': 'lightbulb', '🎁': 'gift', '☕': 'coffee',
    '⏰': 'alarm-clock', '🔑': 'key-round', '🕘': 'history', '🕓': 'history',
    '📥': 'download', '📤': 'upload', '🚪': 'log-out', '🛡': 'shield-check', '🛡️': 'shield-check',
    '📔': 'notebook', '📝': 'pen-line', '🧾': 'scroll', '📜': 'scroll', '🎉': 'sparkles',
    '💪': 'hand', '🙋': 'hand', '🔬': 'search', '🧹': 'trash-2', '↗': 'trending-up', '🏠': 'home'
  };
  var GX_EMOJI_KEYS = Object.keys(GX_EMOJI_MAP).sort(function (a, b) { return b.length - a.length; });
  var GX_EMOJI_RE = new RegExp('^\\s*(' + GX_EMOJI_KEYS.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')');
  var GX_SWEEP_SEL = 'h1,h2,h3,h4,.btn,.nav-item,.tab-item,.more-item,.stat-icon,.empty-state,' +
    '.toast,.cm-toast,.cmDeskUpdToast,.cmDesk-guide,.cmDesk-pagepill,.settings-section,' +
    '.cmGx-kpi,.cmGx-card,.wl-cat,.honor-level,.honor-scope,.section-title,.grade-stat-card,' +
    '.stat-mini,[class*="cmWiz"],[class*="cmPro"],[class*="cmDesk"]';
  function gxSweepEl(root) {
    if (!root || !root.querySelectorAll) return;
    var seen = new Set();                                     // 同一文本节点可能落在多个宿主里，去重防双图标
    var hosts = (root.matches && root.matches(GX_SWEEP_SEL) ? [root] : []).concat(Array.prototype.slice.call(root.querySelectorAll(GX_SWEEP_SEL)));
    for (var h = 0; h < hosts.length; h++) {
      var walker = document.createTreeWalker(hosts[h], NodeFilter.SHOW_TEXT, null, false);
      var nodes = [];
      while (walker.nextNode()) {
        var t = walker.currentNode;
        var pn = t.parentNode;
        if (!pn || seen.has(t)) continue;
        var tag = pn.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'svg' || tag === 'SVG') continue;
        GX_EMOJI_RE.lastIndex = 0;
        var m = GX_EMOJI_RE.exec(t.nodeValue || '');
        if (m) { nodes.push([t, m[1]]); seen.add(t); }
      }
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i][0], emo = nodes[i][1];
        var rest = node.nodeValue.replace(/^\s*/, '').slice(emo.length).replace(/^[\s\u00a0]+/, '');
        var svgHolder = el('span');
        svgHolder.style.cssText = 'display:inline-flex;vertical-align:-0.14em';
        svgHolder.innerHTML = gxIc(GX_EMOJI_MAP[emo] || 'sparkles');
        node.parentNode.insertBefore(svgHolder, node);
        if (rest) node.nodeValue = rest; else node.parentNode.removeChild(node);
      }
    }
    var inputs = root.querySelectorAll ? root.querySelectorAll('input[placeholder]') : [];
    for (var j = 0; j < inputs.length; j++) {
      var ph = inputs[j].getAttribute('placeholder') || '';
      GX_EMOJI_RE.lastIndex = 0;
      var pm = GX_EMOJI_RE.exec(ph);
      if (pm) inputs[j].setAttribute('placeholder', ph.replace(/^\s*/, '').slice(pm[1].length).replace(/^[\s\u00a0]+/, ''));
    }
  }
  var gxSweepT = 0, gxSweeping = false;
  function gxSweepSoon() {
    clearTimeout(gxSweepT);
    gxSweepT = setTimeout(function () {
      if (gxSweeping) return;
      gxSweeping = true;
      try { gxSweepEl(document.body); } catch (e) {}
      gxSweeping = false;
    }, 220);
  }
  function gxWatchDom() {
    if (!window.MutationObserver || gxWatchDom.__on) return;
    gxWatchDom.__on = true;
    new MutationObserver(function () { gxSweepSoon(); }).observe(document.body, { childList: true, subtree: true });
  }
  function gxWrapToast() {
    var orig = window.showToast;
    if (typeof orig !== 'function' || orig.__gx) return;
    var w = function () { var r = orig.apply(this, arguments); gxSweepSoon(); return r; };
    w.__gx = true;
    window.showToast = w;
  }
  function gxWrapNavigate() {
    var prev = window.navigateTo;
    if (typeof prev !== 'function' || prev.__gx) return;
    var w = function () { var r = prev.apply(this, arguments); gxSweepSoon();
      try { var pg = document.querySelector('.page.active'); if (pg) gxPlayCounters(pg); } catch (e) {}   // v1.5.1：进页播数字
      return r; };
    w.__gx = true;
    window.navigateTo = w;
  }
  /* 学分公示=喇叭（原有 #i-horn 语义相近但网页版用奖杯）、荣誉墙=奖章绶带（gx-award） */
  function gxFixNavIcons() {
    var uses = document.querySelectorAll('.nav-item[data-page="honors"] .ic use, .more-item[data-page="honors"] .ic use, .tab-item[data-page="honors"] .ic use');
    for (var i = 0; i < uses.length; i++) uses[i].setAttribute('href', '#gx-award');
  }
  function cmSchoolName() { return (lsGet('cm_school_name') || '').trim(); }
  function buildGxSchoolCard() {
    if (document.getElementById('cmDeskSchool')) return;
    var anchor = null;
    var hs = document.querySelectorAll('.settings-section h3');
    for (var i = 0; i < hs.length; i++) {
      if ((hs[i].textContent || '').indexOf('班级信息') >= 0) { anchor = hs[i].closest('.settings-section'); break; }
    }
    if (!anchor) return;
    var card = el('div', 'settings-section');
    card.id = 'cmDeskSchool';
    card.innerHTML =
      '<h3>' + gxIc('school') + ' 学校信息<span class="cmDesk-pro-badge">桌面版</span></h3>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<input id="cmSchoolNameIn" type="text" placeholder="如：XX市第一中学（用于荣誉证书抬头）" style="flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--row-bg);color:var(--text);font-size:14px">' +
      '<button class="btn btn-primary btn-sm" id="cmSchoolNameSave">保存</button></div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:7px">填入后荣誉证书顶部展示学校名称，落款仍为班级。留空则证书不显示学校抬头。</div>';
    anchor.parentNode.insertBefore(card, anchor);
    document.getElementById('cmSchoolNameIn').value = cmSchoolName();
    document.getElementById('cmSchoolNameSave').onclick = function () {
      lsSet('cm_school_name', (document.getElementById('cmSchoolNameIn').value || '').trim());
      if (window.showToast) window.showToast('学校名称已保存，荣誉证书即时生效', 'success');
    };
  }
  /* ---------- 工作留痕重设计 ---------- */
  var GX_WL_PERIODS = [
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'term', label: '本学期' },
    { key: 'all', label: '全部' }
  ];
  var _gxWlPeriod = 'month';                        // 默认本月（老板拍板）
  var _gxWlCat = '全部';
  function gxDateStr(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function gxWlRangeStart(period) {
    if (period === 'all') return '';
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (period === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return gxDateStr(d); }   // 周一起
    if (period === 'month') { d.setDate(1); return gxDateStr(d); }
    if (period === 'term') {
      var ts = null;
      try { if (typeof loadPubSetting === 'function') ts = loadPubSetting('semesterStart'); } catch (e) {}
      if (!ts && typeof pfSemesterStartTs === 'function') { try { ts = pfSemesterStartTs(); } catch (e) {} }
      if (ts) { var dd = new Date(Number(ts)); dd.setHours(0, 0, 0, 0); return gxDateStr(dd); }
      var m = d.getMonth() + 1;                                                              // 学期起点兜底：9/1 或 2/1（与网页版同口径）
      var y = d.getFullYear();
      return gxDateStr(new Date(y, m >= 2 && m <= 7 ? 1 : 8, 1));
    }
    return '';
  }
  window.gxWlSetCat = function (c) { _gxWlCat = c; window.renderWorkLogs(); };
  window.gxWlSetPeriod = function (p) { _gxWlPeriod = p; window.renderWorkLogs(); };
  window.gxImgFail = function (img) {
    var d = el('div', 'gx-imgdead');
    d.innerHTML = gxIc('image') + '<span>图片无法预览</span>';
    if (img && img.parentNode) img.parentNode.replaceChild(d, img);
  };
  function cmWrapWorklogs() {
    var orig = window.renderWorkLogs;
    if (typeof orig !== 'function' || orig.__gxWl) return;
    var wrapped = function () {
      var dateEl = document.getElementById('wlDate');
      var listEl = document.getElementById('wlList');
      var catsEl = document.getElementById('wlCats');
      if (!dateEl || !listEl) { try { return orig.apply(this, arguments); } catch (e) {} return; }
      if (!document.getElementById('gxWlPeriods')) {           // 日期选择器退役 → 周期筛选 chips（一次性）
        dateEl.style.display = 'none';
        var chips = el('div', 'gx-wl-periods');
        chips.id = 'gxWlPeriods';
        chips.innerHTML = GX_WL_PERIODS.map(function (p) {
          return '<button class="btn btn-sm' + (p.key === _gxWlPeriod ? ' btn-primary' : '') + '" onclick="gxWlSetPeriod(\'' + p.key + '\')">' + p.label + '</button>';
        }).join('');
        dateEl.parentNode.insertBefore(chips, dateEl.nextSibling);
      }
      if (catsEl) {
        catsEl.innerHTML = ['全部'].concat(WL_CATS || []).map(function (c) {
          return '<button class="btn btn-sm' + (c === _gxWlCat ? ' btn-primary' : '') + '" onclick="gxWlSetCat(\'' + c + '\')">' + c + '</button>';
        }).join('');
      }
    gxStagger(listEl);
      var start = gxWlRangeStart(_gxWlPeriod);
      var today = gxDateStr(new Date());
      var se = document.getElementById('wlSearch');
      var kw = ((se && se.value) || '').toLowerCase().trim();
      var wl = (cmGxState() && cmGxState().workLogs) || [];
      var list = wl.filter(function (w) {
        if (start && !(w.date >= start && w.date <= today)) return false;   // 周期窗内（YYYY-MM-DD 字典序即时间序）
        if (_gxWlCat !== '全部' && w.category !== _gxWlCat) return false;
        if (kw && (w.title || '').toLowerCase().indexOf(kw) < 0 && (w.content || '').toLowerCase().indexOf(kw) < 0) return false;
        return true;
      }).sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
      var stats = document.getElementById('wlStats');
      if (stats) {
        var periodLabel = (GX_WL_PERIODS.filter(function (p) { return p.key === _gxWlPeriod; })[0] || {}).label || '';
        stats.innerHTML = kw
          ? ('搜索「' + cmGxEsc(kw) + '」· 命中 ' + list.length + ' 条')
          : (periodLabel + ' ' + list.length + ' 条记录' + (start ? '（' + start + ' 起）' : ''));
      }
      if (list.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding:40px"><div class="icon">' + gxIc('notebook', 'gx-ic-lg') + '</div><div class="text">' +
          (kw || _gxWlCat !== '全部' ? '当前筛选下没有工作记录' : '还没有工作记录') +
          '</div><div style="margin-top:8px"><button class="btn btn-primary btn-sm" onclick="openWorkLogAdd()">记录一条工作</button></div></div>';
        return;
      }
      var catColor = { '常规': 'blue', '班会': 'purple', '谈话': 'green', '活动': 'orange', '事务': 'gray', '其他': 'gray' };
      listEl.innerHTML = list.map(function (w) {
        var imgs = (w.images || []).map(function (src) {
          return '<img src="' + cmGxEsc(src) + '" onclick="wlZoom(this.getAttribute(\'src\'))" onerror="gxImgFail(this)" ' +
            'style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:zoom-in">';
        }).join('');
        return '<div class="card wl-card"><div style="display:flex;align-items:flex-start;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span class="wl-cat ' + cmGxEsc(catColor[w.category] || 'gray') + '">' + cmGxEsc(w.category) + '</span>' +
          '<b style="font-size:15px">' + cmGxEsc(w.title) + '</b>' +
          '<span style="font-size:12px;color:var(--text-muted)">' + gxIc('calendar') + ' ' + cmGxEsc(w.date) + '</span></div>' +
          (w.content ? '<div style="margin-top:8px;font-size:14px;color:var(--text-secondary);white-space:pre-wrap">' + cmGxEsc(w.content) + '</div>' : '') +
          (imgs ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + imgs + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="btn btn-sm" onclick="openWorkLogEdit(' + w.id + ')"><svg class="ic ic-sm"><use href="#i-pen"/></svg></button>' +
          '<button class="btn btn-sm" style="color:var(--danger)" onclick="deleteWorkLog(' + w.id + ')"><svg class="ic ic-sm"><use href="#i-trash"/></svg></button>' +
          '</div></div></div>';
      }).join('');
    };
    wrapped.__gxWl = true;
    window.renderWorkLogs = wrapped;
  }
  /* ---------- 荣誉墙重设计 ---------- */
  var _gxHLevel = '全部', _gxHScope = '全部';
  window.gxHSetLevel = function (v) { _gxHLevel = v; window.renderHonors(); };
  window.gxHSetScope = function (v) { _gxHScope = v; window.renderHonors(); };
  window.gxHonorPreview = function (id) {
    var h = null;
    var hs = (cmGxState() && cmGxState().honors) || [];
    for (var i = 0; i < hs.length; i++) { if (hs[i].id === id) { h = hs[i]; break; } }
    if (!h) return;
    var ov = document.getElementById('gxHonorOverlay');
    if (ov) gxCloseMask(ov);
    ov = el('div');
    ov.id = 'gxHonorOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3200;background:rgba(25,22,19,.72);display:flex;align-items:center;justify-content:center;padding:24px';
    ov.onclick = function (ev) { if (ev.target === ov) gxCloseMask(ov); };
    var isCm = window.__cmRole === 'committee';
    ov.innerHTML =
      '<div style="background:var(--card-bg,#FFFDF7);border:1px solid var(--border,#E6DECD);border-radius:16px;padding:16px 18px;max-width:min(1100px,94vw);max-height:92vh;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 64px rgba(25,22,19,.35)">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<b style="font-size:16px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + cmGxEsc(h.title) + '</b>' +
      '<button class="btn btn-sm" onclick="this.closest(\'#gxHonorOverlay\').remove()">' + gxIc('x') + ' 关闭</button></div>' +
      '<div style="overflow:auto;border-radius:10px;border:1px solid var(--border)">' +
      '<canvas id="gxHonorCertCv" width="1500" height="1062" style="display:block;width:100%;height:auto"></canvas></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      (isCm ? '' : '<button class="btn btn-primary" id="gxHonorDl">' + gxIc('download') + ' 下载 PNG</button>') +
      '</div></div>';
    document.body.appendChild(ov);
    var draw = appFn('drawHonorCertCanvas');
    if (draw) {
      var drawn = draw(h, h.persons && h.persons.length === 1 ? h.persons[0] : undefined);
      var target = document.getElementById('gxHonorCertCv');   // 重绘函数返回自建画布 → 拷贝进弹窗画布
      if (drawn && drawn.getContext && target) target.getContext('2d').drawImage(drawn, 0, 0);
    }
    var dl = document.getElementById('gxHonorDl');
    if (dl) dl.onclick = function () {
      if (appFn('exportHonorCert')) window.exportHonorCert(h.id, h.persons && h.persons.length === 1 ? h.persons[0] : undefined);
    };
  };
  function cmWrapHonors() {
    var orig = window.renderHonors;
    if (typeof orig !== 'function' || orig.__gxHn) return;
    var wrapped = function () {
      var listEl = document.getElementById('honorList');
      if (!listEl) { try { return orig.apply(this, arguments); } catch (e) {} return; }
      var st = cmGxState();
      var honors = ((st && st.honors) || []).filter(function (h) { return h; });
      var isCm = window.__cmRole === 'committee';
      var rank = { '校级': 1, '区级': 2, '市级': 3, '省级': 4, '国家级': 5 };
      var lv = document.getElementById('honorLevels');
      if (lv) {
        var chip = function (label, cur, fn) {
          return '<button class="btn btn-sm' + (label === cur ? ' btn-primary' : '') + '" onclick="' + fn + '(\'' + label + '\')">' + label + '</button>';
        };
        lv.innerHTML =
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><span style="font-size:12px;color:var(--text-muted)">范围</span>' +
          chip('全部', _gxHScope, 'gxHSetScope') + chip('集体', _gxHScope, 'gxHSetScope') + chip('个人', _gxHScope, 'gxHSetScope') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:var(--text-muted)">级别</span>' +
          ['全部'].concat(HONOR_LEVELS || []).map(function (l) { return chip(l, _gxHLevel, 'gxHSetLevel'); }).join('') + '</div>';
      }
      var stats = document.getElementById('honorStats');
      if (stats) {
        var teamN = honors.filter(function (h) { return h.scope === '集体'; }).length;
        var perN = honors.length - teamN;
        var topRank = 0;
        honors.forEach(function (h) { topRank = Math.max(topRank, rank[h.level] || 0); });
        var topName = (HONOR_LEVELS || [])[topRank - 1] || '—';
        var statCard = function (icon, label, value, sub) {
          return '<div class="gxH-stat"><div class="gxH-stat-ic">' + gxIc(icon) + '</div><div><div class="gxH-stat-v">' + value + '</div><div class="gxH-stat-l">' + label + (sub ? ' · ' + sub : '') + '</div></div></div>';
        };
        stats.innerHTML = statCard('trophy', '荣誉总数', honors.length) +
          statCard('users', '集体荣誉', teamN) +
          statCard('medal', '个人荣誉', perN) +
          statCard('crown', '最高级别', topName);
      }
    gxStagger(listEl);
      var filtered = honors.filter(function (h) {
        if (_gxHLevel !== '全部' && h.level !== _gxHLevel) return false;
        if (_gxHScope !== '全部' && h.scope !== _gxHScope) return false;
        return true;
      }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || b.id - a.id; });
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px"><div class="icon">' + gxIc('trophy', 'gx-ic-lg') + '</div><div class="text">还没有荣誉记录，点击「添加荣誉」为班级和个人留下高光时刻</div></div>';
        return;
      }
      listEl.innerHTML = filtered.map(function (h) {
        var r = rank[h.level] || 1;
        var team = h.scope === '集体';
        var persons = h.persons || [];
        return '<div class="gxH-card hl-' + r + '" data-hid="' + h.id + '" title="点击预览证书">' +
          '<div class="gxH-top"><span class="honor-level hl-' + r + '">' + cmGxEsc(h.level) + '</span>' +
          '<span class="honor-scope ' + (team ? 'team' : 'person') + '">' + (team ? '集体' : '个人') + '</span></div>' +
          '<div class="gxH-title">' + cmGxEsc(h.title) + '</div>' +
          (!team && persons.length ? '<div class="gxH-row">' + gxIc('medal') + '<span>' + cmGxEsc(persons.join('、')) + '</span></div>' : '') +
          '<div class="gxH-row"><span class="gxH-date">' + gxIc('calendar') + cmGxEsc(h.date || '') + '</span></div>' +
          (h.desc ? '<div class="gxH-desc">' + cmGxEsc(h.desc) + '</div>' : '') +
          '<div class="gxH-foot"><button class="btn btn-sm gxH-cert" data-hid="' + h.id + '">' + gxIc('scroll') + ' 查看证书</button>' +
          (isCm ? '' : '<span style="flex:1"></span><button class="btn btn-sm" data-gxh="edit" data-hid="' + h.id + '" title="编辑"><svg class="ic ic-sm"><use href="#i-pen"/></svg></button>' +
            '<button class="btn btn-sm" data-gxh="del" data-hid="' + h.id + '" title="删除" style="color:var(--danger)"><svg class="ic ic-sm"><use href="#i-trash"/></svg></button>') +
          '</div></div>';
      }).join('');
      listEl.onclick = function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-gxh]') : null;
        if (btn) {
          ev.stopPropagation();
          var id = parseInt(btn.getAttribute('data-hid'), 10);
          if (btn.getAttribute('data-gxh') === 'edit' && appFn('openHonorEdit')) window.openHonorEdit(id);
          else if (btn.getAttribute('data-gxh') === 'del' && appFn('deleteHonor')) window.deleteHonor(id);
          return;
        }
        var certBtn = ev.target && ev.target.closest ? ev.target.closest('button.gxH-cert') : null;
        var card = ev.target && ev.target.closest ? ev.target.closest('.gxH-card') : null;
        if (card && (!certBtn || certBtn)) {
          var hid = parseInt((certBtn || card).getAttribute('data-hid'), 10);
          if (hid) window.gxHonorPreview(hid);
        }
      };
    };
    wrapped.__gxHn = true;
    window.renderHonors = wrapped;
  }
  /* 证书重绘（奖状式）：顶部学校名称（可选）/ 姓名左顶格 + 「同学：」/ 事由正文 / 级别大字 / 朱砂印章 / 右下落款 */
  function cmWrapHonorCert() {
    var orig = window.drawHonorCertCanvas;
    if (typeof orig !== 'function' || orig.__gxCert) return;
    window.drawHonorCertCanvas = function (h, personName) {
      var W = 1500, H = 1062;
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      var FONT = '"KaiTi","楷体","STKaiti","Microsoft YaHei",sans-serif';
      var grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#fefcf5'); grad.addColorStop(1, '#f8eed6');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#b8933a'; ctx.lineWidth = 8; ctx.strokeRect(28, 28, W - 56, H - 56);
      ctx.strokeStyle = 'rgba(184,147,58,.5)'; ctx.lineWidth = 2; ctx.strokeRect(52, 52, W - 104, H - 104);
      ctx.save();
      [[52, 52], [W - 74, 52], [52, H - 74], [W - 74, H - 74]].forEach(function (p) {
        ctx.translate(p[0] + 11, p[1] + 11); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#b8933a'; ctx.fillRect(-11, -11, 22, 22);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      });
      ctx.restore();
      var school = cmSchoolName();
      ctx.textAlign = 'center';
      if (school) {
        ctx.fillStyle = '#8a6d3b'; ctx.font = '38px ' + FONT;
        try { ctx.letterSpacing = '12px'; } catch (e) {}
        ctx.fillText(school, W / 2, 112);
        try { ctx.letterSpacing = '0px'; } catch (e) {}
      }
      ctx.fillStyle = '#9e2b25'; ctx.font = '700 110px ' + FONT;
      try { ctx.letterSpacing = '26px'; } catch (e) {}
      ctx.fillText('荣 誉 证 书', W / 2 + 13, 268);
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.strokeStyle = '#b8933a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2 - 292, 302); ctx.lineTo(W / 2 - 130, 302); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2 + 130, 302); ctx.lineTo(W / 2 + 292, 302); ctx.stroke();
      ctx.fillStyle = '#b8933a'; ctx.font = '22px ' + FONT;
      ctx.fillText('✦ 荣 誉 ✦', W / 2, 346);
      /* 奖状式正文块（左对齐，x=210 顶格） */
      var bx = 210, maxW = W - bx * 2 - 20;
      var isTeam = h.scope === '集体';
      var cn = appFn('certClassName');
      var entity = isTeam ? (cn ? cn() : (state && state.classNameFull) || (state && state.className) || '全班同学')
        : (personName || (h.persons || []).join('、') || '同学');
      var yy = 470;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#3a3a3a'; ctx.font = '700 46px ' + FONT;
      ctx.fillText((!isTeam ? entity + '同学：' : entity + '：'), bx, yy);
      var body = '在「' + (h.title || '') + '」中表现优异，特发此证，以资鼓励。';
      ctx.fillStyle = '#555'; ctx.font = '36px ' + FONT;
      var lines = certWrapText(ctx, body, maxW);
      for (var li = 0; li < lines.length; li++) { yy += 60; ctx.fillText(lines[li], bx, yy); }
      if (h.desc) {
        ctx.fillStyle = '#888'; ctx.font = '27px ' + FONT;
        var dlines = certWrapText(ctx, h.desc, maxW);
        yy += 18;
        for (var di = 0; di < dlines.length; di++) { yy += 44; ctx.fillText(dlines[di], bx, yy); }
      }
      /* 级别大字（居中） */
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c8102e'; ctx.font = '800 88px ' + FONT;
      try { ctx.letterSpacing = '10px'; } catch (e) {}
      ctx.fillText((h.level || '') + '荣誉', W / 2 + 5, Math.max(yy + 128, 790));
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      /* 朱砂印章（右下，微倾） */
      ctx.save();
      ctx.translate(W - 300, H - 218); ctx.rotate(-0.10); ctx.globalAlpha = 0.82;
      ctx.strokeStyle = '#B42318'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#B42318'; ctx.font = '700 40px ' + FONT;
      try { ctx.letterSpacing = '8px'; } catch (e) {}
      ctx.fillText('荣誉', 4, 14);
      ctx.restore();
      /* 右下落款 */
      var issuer = (state && (state.classNameFull || state.className)) || '';
      ctx.textAlign = 'right'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#555'; ctx.font = '32px ' + FONT;
      ctx.fillText(issuer, W - 210, H - 150);
      var dm = String(h.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      ctx.fillStyle = '#888'; ctx.font = '30px ' + FONT;
      ctx.fillText(dm ? (dm[1] + ' 年 ' + parseInt(dm[2], 10) + ' 月 ' + parseInt(dm[3], 10) + ' 日') : String(h.date || ''), W - 210, H - 100);
      return canvas;
    };
    window.drawHonorCertCanvas.__gxCert = true;
  }
  function certWrapText(ctx, text, maxW) {
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      if (ctx.measureText(cur + text[i]).width > maxW && cur) { lines.push(cur); cur = text[i]; }
      else cur += text[i];
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (!gxMotionOn()) document.documentElement.classList.add('gx-motion-off');   // v1.5.0 动效降级开关（减少动态偏好 / cm_motion_off）
    // 上次会话示例体验未走完（中途关应用）→ 幂等清扫，绝不把示例数据留给正式使用
    if (lsGet(CM_TOUR_FLAG) === '1') cmSampleCleanup(true);
    cmNudgeWatch();
    stripCloudUI();
    wrapDangerousFns();
    cmProRefresh();                              // Pro 状态预热（激活缓存供 nudge/gate 判定）
    cmWrapPro('seatExportImage', '座次表导出打印');   // Pro gate（UI 不变，点击才拦）
    cmWrapPro('dutyExportImage', '值日表导出打印');
    cmWrapPro('wlAddImages', '工作留痕配图');
    cmWrapPro('cbDoSettleUI', '学分银行');
    cmWrapPro('cbOpenItemDetail', '学分银行');
    cmWrapPro('cbUseVoucherUI', '学分银行');
    cmWrapPro('cbRefundVoucherUI', '学分银行');
    cmWrapPro('cbOpenItemEditor', '学分银行');
    cmWrapPro('cbOpenBankProfile', '学分银行');
    cmWrapPro('switchAnalyticsTab', '数据分析');
    cmWrapPro('exportPublicityPoster', '公示海报导出');
    cmWrapPro('exportWeeklyReport', '学分周报导出');
    cmWrapPro('cmExportLeaveFlow', '请假流水导出');   // v1.2.6：考勤页新按钮（原则：所有导出皆 Pro）
    buildLeaveExportBtn();
    cmWrapGradeDetail();                         // v1.3.0：成绩 tab ECharts 图表引擎接管（含降级回退）
    cmGradeWatchTheme();                         // 亮/暗/皮肤切换自动重渲染图表
    cmWrapCreditRender();                        // v1.3.0 P1：学分 tab 图表迁移（KPI 六卡 + 四图）
    cmWrapCreditTabSwitch();                     // 切回学分 tab 时补渲染脏图表（链在 Pro gate 之上）
    cmWrapDistChart();                           // v1.3.0 P2：首页学分分布接管（cmInk 八档直方图）
    cmWrapPubCharts();                           // v1.3.0 P2：公示页四图接管（趋势/每日/分布/原因）
    gxInjectSprite();                            // v1.4.0：Lucide 符号表注入（全台 emoji 替换地基）
    gxFixNavIcons();                             // 学分公示/荣誉墙侧栏图标区分（荣誉墙改奖章 gx-award）
    cmWrapWorklogs();                            // v1.4.0 工作留痕重设计（周期筛选 + 时间流水 + 图片兜底）
    cmWrapHonors();                              // v1.4.0 荣誉墙重设计（卡片 + 点卡片预览证书）
    cmWrapHonorCert();                           // v1.4.0 证书重绘（奖状式 + 学校名称 + 朱砂印章）
    buildGxSchoolCard();                         // v1.4.0 设置页「学校信息（桌面版）」卡
    gxWrapToast();                               // toast 图标统一
    gxWrapNavigate();                            // 切页后补扫 emoji
    document.addEventListener('visibilitychange', function () {   // v1.5.2：窗口转可见 → 补播被隐藏窗口冻住的 KPI
      if (document.hidden) return;
      try { var pg = document.querySelector('.page.active'); if (pg) gxPlayCounters(pg); } catch (e) {}
    });
    gxWatchDom();                                // DOM 变更防抖补扫
    gxSweepSoon();                               // v1.4.0 首扫（页头/按钮/统计卡 emoji → Lucide）
    silenceCloudPush();
    wrapNavigatePro();
    buildNavPro();
    setTimeout(cmProHeartbeat, 20000);   // 激活心跳：启动 20s 后静默复查（v1.2.3）
    document.body.addEventListener('click', function (ev) {   // 开发者模式入口：连点侧栏版本文字 5 次
      var f = ev.target && ev.target.closest ? ev.target.closest('.sidebar-footer') : null;
      if (f) cmDevTap();
    });
    enhanceAbout();
    buildSecurityCard();
    if (!lsGet(LS_ONBOARD)) {
      stepWelcome();               // 首启：向导盖在最上层（含登录页之上）
    } else {
      patchLogin();                // 老用户：零密码面板按需接管登录页
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
