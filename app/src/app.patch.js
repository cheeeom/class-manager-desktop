/* 班主任工作台 · 桌面版注入层（仅桌面构建加载；线上版不含本文件，零影响）
   职责：首启向导（密码可跳=零密码模式）/ 无密码登录面板 / 清空数据管理员闸 /
        云同步界面裁剪 / 桌面版安全设置卡 / 关于卡版权增强。
   依赖：主应用脚本已在本文件之前加载（hashPwd/enterApp/importData/saveData 等全局可用）。 */
(function () {
  'use strict';
  if (!window.__CM_DESKTOP) return;              // 非桌面环境（理论不会发生，双保险）
  if (window.__CM_DESK_LAYER__) return;          // 防双跑
  window.__CM_DESK_LAYER__ = true;

  var D = window.__CM_DESKTOP;
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
      var orig = window.clearData;
      var wrapped = function () { adminGate(function () { orig(); }); };
      wrapped.__cmDeskGate = true;
      window.clearData = wrapped;
    }
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
    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
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
  var wizState = { step: 0, loginP1: '', loginP2: '', adminP1: '', adminP2: '', loginSkip: false, adminSkip: false };

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
      '<button class="btn btn-primary" id="cmWizNext"><span>开始配置</span><span class="arr">→</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkipAll">跳过向导</button>');
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
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span><span class="arr">→</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设密码）</button>' +
      '<button class="btn btn-outline" id="cmWizBack"><span class="arr">←</span><span>上一步</span></button>');
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
        '<button class="btn btn-primary" id="cmWizOk">完成密码设置</button>' +
        '<button class="btn btn-outline" id="cmWizBack2"><span class="arr">←</span><span>重输</span></button>');
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
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span><span class="arr">→</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设管理员密码）</button>' +
      '<button class="btn btn-outline" id="cmWizBack"><span class="arr">←</span><span>上一步</span></button>');
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
        '<button class="btn btn-primary" id="cmWizOk">完成设置</button>' +
        '<button class="btn btn-outline" id="cmWizBack2"><span class="arr">←</span><span>重输</span></button>');
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
      '<button class="btn btn-primary" id="cmWizNext"><span>下一步</span><span class="arr">→</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-outline" id="cmWizBack"><span class="arr">←</span><span>上一步</span></button>');
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

  function stepImport() {
    var w = wizardShell('第 5 步 · 共 6 步',
      '<h2 style="font-family:var(--font-display)">导入已有数据（可选）</h2>' +
      '<div style="font-size:13px;color:var(--text-secondary);line-height:2;margin-bottom:12px">' +
      '如果你在用<b>网页版</b>，先在网页版「设置 → 导出数据」得到备份 JSON，在这里一键导入。<br>' +
      '全新使用可跳过此步。</div>',
      '<button class="btn btn-primary" id="cmWizImport"><span class="ico">📁</span><span>选择备份文件导入</span></button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-outline" id="cmWizBack"><span class="arr">←</span><span>上一步</span></button>');
    w.foot.querySelector('#cmWizImport').onclick = function () {
      var fn = appFn('importData');
      if (fn) fn();
      stepTour();
    };
    w.foot.querySelector('#cmWizSkip').onclick = function () { stepTour(); };
    w.foot.querySelector('#cmWizBack').onclick = function () { stepClassName(); };
  }

  function stepTour() {
    var mods = [
      ['🏠', '首页', '课表、今日实到、班级速览'],
      ['👥', '学生档案', '56 人花名册、一人一档'],
      ['⭐', '学分银行', '加减分流水、月度汇总'],
      ['🗓️', '值日点名', '值周排班、课堂随机点名'],
      ['🏅', '荣誉与公示', '荣誉墙、学分公示海报'],
      ['☁️', '导出备份', '设置里可随时导出 JSON 留存']
    ];
    var grid = '<div class="cmDesk-tour">';
    mods.forEach(function (m) {
      grid += '<div class="cmDesk-tcell"><div style="font-size:26px">' + m[0] + '</div><b>' + m[1] + '</b><span>' + m[2] + '</span></div>';
    });
    grid += '</div>';
    var w = wizardShell('第 6 步 · 共 6 步', '<h2 style="font-family:var(--font-display)">30 秒认识工作台</h2>' + grid,
      '<button class="btn btn-primary" id="cmWizNext"><span>完成</span><span class="arr">→</span></button>');
    w.foot.querySelector('#cmWizNext').onclick = function () { stepFinish(); };
  }

  function stepFinish() {
    var w = wizardShell('完成',
      '<div class="cmDesk-logo">班</div>' +
      '<h2 style="font-family:var(--font-display)">一切就绪！</h2>' +
      '<div style="color:var(--text-secondary);font-size:13.5px;line-height:2">' +
      (wizState.loginSkip ? '<p>🔓 当前为<b>零密码模式</b>：打开应用直接进入。想加密码可到「设置 → 🔐 安全」。</p>' : '<p>🔐 登录密码已设置，下次打开需输入。</p>') +
      (userAdminPwdSet() ? '' : '<p>🛡️ 未设管理员密码：清空数据时输入「清空」二字确认。</p>') +
      '<p>🎓 拿不准从哪开始？可以<b>带示例数据体验</b>：每个功能配指引弹窗，走完自动清除示例，不留任何痕迹。</p>' +
      '<p>💾 建议：定期在「设置 → 导出数据」留一份备份。</p>' +
      '</div>' +
      '<div class="cmDesk-copy">© 2026 <b>chee</b> · 班主任工作台（桌面版 v' + D.version + '） · 保留所有权利</div>',
      '<button class="btn btn-outline" id="cmWizSample"><span>🎓 带示例体验</span><span class="arr">→</span></button>' +
      '<button class="btn btn-primary" id="cmWizDone"><span>进入工作台</span><span class="arr">→</span></button>');
    w.foot.querySelector('#cmWizSample').onclick = function () { finishWizard(true); };
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
    { page: 'dashboard', icon: '🏠', title: '工作台首页', text: '课表、班级人数、今日实到都在这里。示例班级「高2026级一班」已放好 6 名学生。' },
    { page: 'students', icon: '👥', title: '学生名册', text: '示例学生列在这里。正式使用时到 设置 → 数据管理 →「批量导入学生表格」，Excel/CSV 一键导入真实名单。' },
    { page: 'credits', icon: '⭐', title: '学分管理', text: '点学生加减分，全程留痕。示例里「陈曦」已有一条课堂表现 +2 的流水，可试撤销/恢复。' },
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
        students: JSON.parse(JSON.stringify(state.students)),
        operations: JSON.parse(JSON.stringify(state.operations))
      };
      sessionStorage.setItem(CM_TOUR_SNAP, JSON.stringify(snap));
      lsSet(CM_TOUR_FLAG, '1');
      var names = ['陈曦', '林浩然', '苏雨桐', '王一鸣', '赵可欣', '周子墨'];
      for (var i = 0; i < names.length; i++) {
        state.students.push({ id: 990001 + i, sid: 'S2026' + ('0' + (i + 1)).slice(-2), name: names[i], credit: i === 0 ? 102 : 100, tags: [] });
      }
      // 只放一条 +2 流水，且对应学生 credit 同步 +2，保证「基准+Σ流水=当前分」不变式，学分体检不报异常
      state.operations.unshift({
        id: 990001, studentId: 990001, studentName: '陈曦', amount: 2, coin: 2,
        reason: '课堂表现优秀（示例）', time: Date.now() - 3600000
      });
      state.className = '高2026级一班';
      state.classNameFull = '高2026级一班';
      state.nextId = Math.max(state.nextId, 990007);
      state.nextOpId = Math.max(state.nextOpId, 990002);
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
        state.students = JSON.parse(JSON.stringify(snap.students));
        state.operations = JSON.parse(JSON.stringify(snap.operations));
      } else {
        // 跨会话兜底：快照已不可得，按示例 id 区间（990001–990999）剔除
        state.students = state.students.filter(function (s) { return !(s.id >= 990001 && s.id <= 990999); });
        state.operations = state.operations.filter(function (o) { return !(o.id >= 990001 && o.id <= 990999); });
        state.nextId = state.students.reduce(function (m, s) { return Math.max(m, s.id + 1); }, 1);
        state.nextOpId = state.operations.reduce(function (m, o) { return Math.max(m, o.id + 1); }, 1);
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
        '<button class="btn btn-primary btn-sm" id="cmGuideNext"><span>' + (last ? '完成体验 ✓' : '下一步') + '</span><span class="arr">→</span></button>' +
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

  /* ---------- 6. 桌面版安全设置卡 ---------- */
  function buildSecurityCard() {
    if (document.getElementById('cmDeskSecurity')) return;
    var hs = document.querySelectorAll('.settings-section h3');
    var anchor = null;
    for (var i = 0; i < hs.length; i++) if (hs[i].textContent.indexOf('危险操作') >= 0) { anchor = hs[i].closest('.settings-section'); break; }
    if (!anchor) return;
    var card = el('div', 'settings-section');
    card.id = 'cmDeskSecurity';
    card.innerHTML =
      '<h3>🔐 安全（桌面版）</h3>' +
      '<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;line-height:1.8">登录密码 = 打开应用时输入；管理员密码 = 敏感操作确认。均不可找回，请牢记。</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
      '<span style="font-size:13px;font-weight:600;min-width:88px">登录密码</span>' +
      '<input class="cmDesk-input" id="cmDeskLoginPwd" type="password" maxlength="6" placeholder="6位数字" style="width:120px">' +
      '<input class="cmDesk-input" id="cmDeskLoginPwd2" type="password" maxlength="6" placeholder="再输一遍" style="width:120px">' +
      '<button class="btn btn-primary btn-sm" id="cmDeskLoginSave">保存</button>' +
      '<span style="font-size:12px;color:var(--text-muted)" id="cmDeskLoginState"></span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<span style="font-size:13px;font-weight:600;min-width:88px">管理员密码</span>' +
      '<input class="cmDesk-input" id="cmDeskAdminPwd" type="password" maxlength="6" placeholder="6位数字" style="width:120px">' +
      '<input class="cmDesk-input" id="cmDeskAdminPwd2" type="password" maxlength="6" placeholder="再输一遍" style="width:120px">' +
      '<button class="btn btn-primary btn-sm" id="cmDeskAdminSave">保存</button>' +
      '<span style="font-size:12px;color:var(--text-muted)" id="cmDeskAdminState"></span></div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">© 2026 chee · 班主任工作台 · 保留所有权利</div>';
    anchor.parentNode.insertBefore(card, anchor);

    function refreshState() {
      document.getElementById('cmDeskLoginState').textContent = userLoginPwdSet() ? '已设置' : '未设置（零密码模式）';
      document.getElementById('cmDeskAdminState').textContent = userAdminPwdSet() ? '已设置' : '未设置（清空数据用「清空」二字确认）';
    }
    refreshState();
    document.getElementById('cmDeskLoginSave').onclick = function () {
      var a = document.getElementById('cmDeskLoginPwd').value, b = document.getElementById('cmDeskLoginPwd2').value;
      if (!isSixDigits(a)) { if (window.showToast) window.showToast('请输满 6 位数字', 'error'); return; }
      if (a !== b) { if (window.showToast) window.showToast('两次输入不一致', 'error'); return; }
      if (weakPattern(a)) { if (window.showToast) window.showToast('密码过于简单（重复/连号）', 'error'); return; }
      if (window.hashPwd) {
        lsSet(K_LOGIN, window.hashPwd(a)); lsDel(LS_NOPWD); refreshState();
        if (window.showToast) window.showToast('登录密码已设置，下次打开生效', 'success');
      }
    };
    document.getElementById('cmDeskAdminSave').onclick = function () {
      var a = document.getElementById('cmDeskAdminPwd').value, b = document.getElementById('cmDeskAdminPwd2').value;
      if (!isSixDigits(a)) { if (window.showToast) window.showToast('请输满 6 位数字', 'error'); return; }
      if (a !== b) { if (window.showToast) window.showToast('两次输入不一致', 'error'); return; }
      if (window.hashPwd) {
        lsSet(K_ADMIN, window.hashPwd(a)); lsSet(USER_SET_ADMIN, '1'); refreshState();
        if (window.showToast) window.showToast('管理员密码已设置', 'success');
      }
    };
  }

  /* ---------- 7. 关于卡桌面版化（检查更新第一栏 + 介绍重写） ---------- */
  function enhanceAbout() {
    var about = document.getElementById('settingsAbout');
    if (!about || about.querySelector('.cmDeskAbout')) return;

    /* 检查更新栏：关于卡第一栏（紧随标题），按钮加大突出 */
    var btn = null, status = null;
    if (window.__CM_UPDATER) {
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

    /* 桌面版介绍卡：插在版本徽标行之后、网页版速览之前 */
    var intro = el('div', 'cmDeskAbout');
    intro.style.cssText = 'margin:10px 0 12px;padding:10px 12px;background:var(--row-bg,#FBF8F1);border:1px dashed var(--border,#E6DECD);border-radius:10px;font-size:12.5px;color:var(--text-secondary,#5F5E5A);line-height:1.9';
    intro.innerHTML =
      '🖥️ <b>班主任工作台 · 桌面版 v' + D.version + '</b>（单机版）——这是安装在 Windows 上的独立应用，<b>全部数据仅保存在这台电脑上</b>，不经任何服务器。' + (D.baseWeb ? '功能与网页版 ' + D.baseWeb + ' 一致（网页版的云同步在桌面版中不适用，已移除）。' : '') + '<br>' +
      '🔄 <b>自动更新</b>：发现新版会在左下角弹窗询问，选择「立即更新」后台下载；就绪后点「立即重启」，自动沿用原目录覆盖安装并重启新版。<br>' +
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

    // 应用内更新逻辑（仅桌面且有更新桥时接线）
    if (!window.__CM_UPDATER) return;

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
      '<p class="cmDesk-donate-note">所有功能永远免费——这笔钱只影响作者期末夜的伙食质量。</p>' +
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
      '<p class="cmDesk-nudge-p">这个工具没有广告、没有激活码，也不打算找你办会员。</p>' +
      '<p class="cmDesk-nudge-p">它值多少钱，取决于它替你省了多少操心。如果某个期末夜，是它陪你熬过来的——</p>' +
      '<p class="cmDesk-nudge-p">可以考虑请作者喝杯奶茶。不请也完全没事，功能一分不减，作者照写不误，就是鸡腿会少一根。</p>' +
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
      '<div class="cmDeskDonate-t">自愿 · 无广告无激活码，功能不加钱也不减——但奶茶能让更新写得更快。</div>' +
      '<div class="cmDeskDonate-r">' +
      '<button class="btn btn-primary" id="cmDonateOpen" style="padding:10px 30px;font-size:14.5px;position:relative;min-width:150px"><span>🧧 打赏作者</span><span class="arr">→</span></button>' +
      '<span class="cmDeskDonate-hint">微信 / 支付宝均可</span>' +
      '</div>';
    sec.querySelector('#cmDonateOpen').onclick = cmDonateModal;
    about.parentNode.insertBefore(sec, about);
  }

  /* ---------- 反馈卡（v1.0.11）：设置 → 关于本系统，邮件直达作者 ---------- */
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
    if (about.querySelector('.cmDeskFeedback')) return;
    var row = el('div', 'cmDeskFeedback');
    row.innerHTML =
      '<div class="cmDeskDonate-t">✉️ <b>反馈与建议</b>　<span>遇到问题、有想法，直接发邮件给作者——看到就会回。</span></div>' +
      '<div class="cmDeskDonate-r">' +
      '<button class="btn btn-outline btn-sm" id="cmFbMail"><span>✉ 写邮件给作者</span><span class="arr">→</span></button>' +
      '<span class="cmDeskFbMail" id="cmFbCopy" title="点击复制邮箱">' + CM_MAIL + '</span>' +
      '</div>';
    row.querySelector('#cmFbMail').onclick = function () {
      if (window.__CM_FEEDBACK && window.__CM_FEEDBACK.mail) {
        window.__CM_FEEDBACK.mail();          // 桌面：唤起系统邮件客户端（收件人主进程定死）
      } else { cmCopyText(CM_MAIL); }         // 非桌面环境兜底：复制邮箱
    };
    row.querySelector('#cmFbCopy').onclick = function () { cmCopyText(CM_MAIL); };
    var anchor = about.querySelector('.cmDeskDonate') || about.querySelector('.cmDeskAbout');
    if (anchor) anchor.parentNode.insertBefore(row, anchor.nextSibling);
    else about.appendChild(row);
  }

  /* ---------- Pro 授权（v1.1.0）：gate + 引导弹窗 + 激活 ----------
     原则：导出按钮 UI 不变，点击才拦；每会话每功能只弹一次引导框；
     验签在主进程（__CM_PRO 桥），渲染层只做展示与状态缓存。 */
  var CM_PRO_LS = 'cmProCache';
  var CM_PRO_BUY_URL = 'https://afdian.com/item/e4cf1936c3d611f19ca752540025c377';   // 爱发电 Pro 商品页（2026-10-09 老板开店后替换）
  var CM_PRO_SESSION = {};                                // 本会话已弹过的功能
  function cmProCache() {
    try { return JSON.parse(lsGet(CM_PRO_LS) || '{}'); } catch (e) { return {}; }
  }
  function cmProActive() { return cmProCache().active === true; }
  function cmProRefresh() {
    if (!window.__CM_PRO) return Promise.resolve({ active: false });
    return window.__CM_PRO.status().then(function (r) {
      var c = { active: !!r.active, tier: r.tier || '', sn: r.sn || 0, eh: r.eh || '' };
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
  function cmProModal(label) {
    if (!label) label = '这个功能';
    if (document.getElementById('cmDeskProModal')) return;
    CM_PRO_SESSION[label] = 1;
    var req = cmProReqCode();
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskProModal';
    m.innerHTML =
      '<div class="cmDesk-donate-card cmDesk-pro">' +
      '<button class="cmDesk-donate-close" id="cmProClose" aria-label="关闭">×</button>' +
      '<h3>✨ ' + label + ' 是 Pro 功能</h3>' +
      '<div class="cmDesk-pro-list">' +
      '<div>🎓 学期报告引擎：个人 + 班级报告，PDF / 长图一键导出</div>' +
      '<div>🖼️ 座次表 · 值日表 · 成绩条，排版打印不发愁</div>' +
      '<div>📊 数据分析深度版：趋势 · 预警 · 导出</div>' +
      '<div>🌟 进步之星榜 · 零扣分续航榜 海报导出</div>' +
      '</div>' +
      '<div class="cmDesk-pro-price"><s>¥69</s> <b>¥49</b> <span>早鸟限量 100 份 · 一次买断 · 无订阅</span></div>' +
      '<div class="cmDesk-pro-req"><span>① 复制申请码（已含本机标识）</span><input id="cmProReq" readonly value="' + req + '"><button class="btn btn-outline btn-sm" id="cmProReqCopy">复制</button></div>' +
      '<div class="cmDesk-pro-act">' +
      '<a class="btn btn-primary" id="cmProBuy" href="' + CM_PRO_BUY_URL + '?custom_order_id=' + encodeURIComponent(req) + '" target="_blank" rel="noopener">🛒 购买激活（微信 / 支付宝）</a>' +
      '<button class="btn btn-outline btn-sm" id="cmProClaim">② 我已付款 · 自动获取激活码</button>' +
      '</div>' +
      '<div class="cmDesk-pro-manual">或手动贴入作者发给你的激活码：<input id="cmProLic" placeholder="CMPRO1.xxxx…"><button class="btn btn-primary btn-sm" id="cmProGo">激活</button></div>' +
      '<div class="cmDesk-pro-msg" id="cmProMsg">付款后一般 12 小时内发货；激活全程离线验签，数据不出这台电脑。</div>' +
      '<div class="cmDesk-donate-actions"><button class="btn btn-outline btn-sm" id="cmProLater">下次再说</button></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('#cmProClose').onclick = function () { m.remove(); };
    m.querySelector('#cmProLater').onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    m.querySelector('#cmProReqCopy').onclick = function () {
      cmProCopy(req, function () { if (window.showToast) window.showToast('申请码已复制，下单时粘贴到留言', 'success'); }, function () { if (window.showToast) window.showToast('复制失败，请长按手动复制', 'error'); });
    };
    m.querySelector('#cmProClaim').onclick = function () {
      var msg = m.querySelector('#cmProMsg');
      if (!window.__CM_PRO) { msg.textContent = '自动获取不可用，请手动贴码或联系作者。'; return; }
      msg.textContent = '正在向作者服务器查询你的激活码…';
      window.__CM_PRO.claim(req).then(function (r) {
        if (r && r.ok) { m.querySelector('#cmProLic').value = r.lic; m.querySelector('#cmProGo').click(); }
        else msg.textContent = r && r.why === 'AUTO_OFF' ? '自动获取即将开通——目前请把申请码发给作者（爱发电留言 / 邮箱），收到激活码贴在下方。' : '暂未查到订单：确认已付款且申请码已填进爱发电留言，稍后再试或联系作者。';
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
            var old = document.getElementById('cmDeskDonateSec');
            if (old) old.remove();
            var about = document.getElementById('settingsAbout');
            if (about) buildDonateRow(about);
          });
        } else {
          msg.textContent = '❌ ' + ((r && r.why) || '激活失败') + '（连续失败可邮件联系作者：846699191@qq.com）';
        }
      });
    };
  }
  /* Pro 已激活卡（D1：替换打赏卡；保底小打赏入口） */
  function buildProActiveCard(about) {
    var c = cmProCache();
    var sec = el('div', 'settings-section cmDeskDonateSec');
    sec.id = 'cmDeskDonateSec';
    sec.innerHTML =
      '<h3>✅ Pro 已激活</h3>' +
      '<div class="cmDeskDonate-t">授权给 <b>' + cmProMaskMail(c.eh) + '</b>' + (c.tier === 'early' ? ' · 🐦 早鸟纪念 #' + c.sn + '/100' : '') + ' · 一次买断，永久可用</div>' +
      '<div class="cmDeskDonate-r"><span class="cmDeskDonate-hint">换电脑？每年 3 次免费重置：846699191@qq.com</span>' +
      '<button class="btn btn-outline btn-sm" id="cmProThanks">☕ 仍想请作者喝一杯</button></div>';
    sec.querySelector('#cmProThanks').onclick = cmDonateModal;
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
  /* 导航栏 Pro 化（v1.1.1）：学期报告独立入口 + 学分银行/数据分析 PRO 角标。
     动态插入的 .nav-item 不会被页面启动时的批量绑定监听 → 自己绑 click。 */
  function buildNavPro() {
    var nav = document.getElementById('nav');
    if (!nav || document.getElementById('cmNavReport')) return;
    ['bank', 'analytics'].forEach(function (pg) {
      var item = nav.querySelector('.nav-item[data-page="' + pg + '"]');
      if (item && !item.querySelector('.cmDesk-navbadge')) {
        var b = el('span', 'cmDesk-navbadge');
        b.textContent = 'PRO';
        item.appendChild(b);
      }
    });
    var settingsItem = nav.querySelector('.nav-item[data-page="settings"]');
    var it = el('div', 'nav-item cmDesk-navreport');
    it.id = 'cmNavReport';
    it.title = '学期报告（Pro）';
    it.innerHTML = '<span class="nav-icon">🎓</span><span>学期报告</span><span class="cmDesk-navbadge">PRO</span>';
    it.addEventListener('click', function () { cmReportOpen(); });
    if (settingsItem) settingsItem.parentNode.insertBefore(it, settingsItem);
    else nav.appendChild(it);
  }
  /* 云同步静音（v1.1.1）：桌面版数据只在本机，autoPushToCloud 的「未配置云同步 Token」提示与桌面改造方向不符 */
  function silenceCloudPush() {
    if (typeof window.autoPushToCloud === 'function') {
      window.autoPushToCloud = function () {};
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
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
    silenceCloudPush();
    buildNavPro();
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
