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

  /* ---------- 启动 ---------- */
  function boot() {
    // 上次会话示例体验未走完（中途关应用）→ 幂等清扫，绝不把示例数据留给正式使用
    if (lsGet(CM_TOUR_FLAG) === '1') cmSampleCleanup(true);
    stripCloudUI();
    wrapDangerousFns();
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
