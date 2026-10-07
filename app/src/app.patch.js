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

  /* ---------- 1. 云同步界面裁剪（本地版无意义） ---------- */
  function stripCloudUI() {
    try {
      var hs = document.querySelectorAll('.settings-section h3');
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].textContent.indexOf('云同步') >= 0) {
          var sec = hs[i].closest('.settings-section');
          if (sec) sec.style.display = 'none';
        }
      }
      var btns = document.querySelectorAll('button[onclick*="restoreFromCloud"]');
      for (var j = 0; j < btns.length; j++) btns[j].style.display = 'none';
      var tks = document.querySelectorAll('button[onclick*="configSyncPwd"], button[onclick*="doPushToCloud"], button[onclick*="autoSyncFromCloud"]');
      for (var k = 0; k < tks.length; k++) tks[k].style.display = 'none';
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
      '<button class="btn btn-primary" id="cmWizNext">开始配置 →</button>' +
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
      '<button class="btn btn-primary" id="cmWizNext">下一步 →</button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设密码）</button>' +
      '<button class="btn btn-outline" id="cmWizBack">← 上一步</button>');
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
        '<button class="btn btn-outline" id="cmWizBack2">← 重输</button>');
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
      '<button class="btn btn-primary" id="cmWizNext">下一步 →</button>' +
      '<button class="btn btn-outline" id="cmWizSkipPwd">跳过（不设管理员密码）</button>' +
      '<button class="btn btn-outline" id="cmWizBack">← 上一步</button>');
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
        '<button class="btn btn-outline" id="cmWizBack2">← 重输</button>');
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
      '<button class="btn btn-primary" id="cmWizNext">下一步 →</button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-outline" id="cmWizBack">← 上一步</button>');
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
      '<button class="btn btn-primary" id="cmWizImport">📁 选择备份文件导入</button>' +
      '<button class="btn btn-outline" id="cmWizSkip">跳过</button>' +
      '<button class="btn btn-outline" id="cmWizBack">← 上一步</button>');
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
      '<button class="btn btn-primary" id="cmWizNext">完成 →</button>');
    w.foot.querySelector('#cmWizNext').onclick = function () { stepFinish(); };
  }

  function stepFinish() {
    var w = wizardShell('完成',
      '<div class="cmDesk-logo">班</div>' +
      '<h2 style="font-family:var(--font-display)">一切就绪！</h2>' +
      '<div style="color:var(--text-secondary);font-size:13.5px;line-height:2">' +
      (wizState.loginSkip ? '<p>🔓 当前为<b>零密码模式</b>：打开应用直接进入。想加密码可到「设置 → 🔐 安全」。</p>' : '<p>🔐 登录密码已设置，下次打开需输入。</p>') +
      (userAdminPwdSet() ? '' : '<p>🛡️ 未设管理员密码：清空数据时输入「清空」二字确认。</p>') +
      '<p>💾 建议：定期在「设置 → 导出数据」留一份备份。</p>' +
      '</div>' +
      '<div class="cmDesk-copy">© 2026 <b>chee</b> · 班主任工作台（桌面版 v' + D.version + '） · 保留所有权利</div>',
      '<button class="btn btn-primary" id="cmWizDone">进入工作台 →</button>');
    w.foot.querySelector('#cmWizDone').onclick = function () { finishWizard(); };
  }

  function finishWizard() {
    lsSet(LS_ONBOARD, String(Date.now()));
    var masks = document.querySelectorAll('.cmDesk-wizard');
    for (var i = 0; i < masks.length; i++) masks[i].remove();
    patchLogin();
    buildSecurityCard();
    if (userLoginPwdSet()) {
      // 正常登录页（密码已设置）
      if (typeof window.showToast === 'function') window.showToast('初始设置完成', 'success');
    } else {
      // 零密码模式直接进入
      if (typeof window.enterApp === 'function') window.enterApp('初始设置完成（零密码模式）');
    }
  }

  /* ---------- 5. 无密码登录面板 ---------- */
  function patchLogin() {
    var overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    if (!userLoginPwdSet() && lsGet(LS_NOPWD) === '1') {
      overlay.innerHTML =
        '<div class="login-card" style="max-width:420px">' +
        '<div class="cmDesk-logo" style="margin:0 auto 16px">班</div>' +
        '<h2 style="font-family:var(--font-display);text-align:center;margin-bottom:6px">班主任工作台</h2>' +
        '<div style="text-align:center;color:var(--text-muted);font-size:12.5px;margin-bottom:18px">🔓 无密码模式 · 数据仅保存在本机</div>' +
        '<button class="btn btn-primary key-ok" id="cmDeskEnter" style="width:100%;height:48px;font-size:16px">直接进入</button>' +
        '<div style="text-align:center;margin-top:14px;font-size:12px;color:var(--text-muted)">想加密码？设置 → 🔐 安全</div>' +
        '<div class="cmDesk-copy" style="margin-top:16px">© 2026 <b>chee</b> · 班主任工作台 · 保留所有权利</div>' +
        '</div>';
      var btn = overlay.querySelector('#cmDeskEnter');
      if (btn) btn.onclick = function () { if (typeof window.enterApp === 'function') window.enterApp('欢迎回来！'); };
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

  /* ---------- 7. 关于卡版权增强 + 应用内更新 ---------- */
  function enhanceAbout() {
    var about = document.getElementById('settingsAbout');
    if (!about || about.querySelector('.cmDeskAbout')) return;
    var line = el('div', 'cmDeskAbout');
    line.style.cssText = 'margin-top:8px;font-size:12px;color:var(--text-muted);line-height:1.9';
    line.innerHTML = '🖥️ 桌面版 v' + D.version + (D.baseWeb ? '（基于网页版 ' + D.baseWeb + ' 构建）' : '') +
      ' · 数据仅保存在本机<br>' + COPYRIGHT + ' · 转发分享请保留开发者署名';
    about.appendChild(line);

    // 应用内更新（仅桌面且有更新桥时渲染）
    if (!window.__CM_UPDATER) return;
    var row = el('div', 'cmDeskUpd');
    row.style.cssText = 'margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    var btn = el('button', 'btn btn-outline btn-sm', '🔄 检查更新');
    var status = el('span', 'cmDeskUpdStatus');
    status.style.cssText = 'font-size:12px;color:var(--text-muted)';
    status.textContent = '当前版本 v' + D.version;
    row.appendChild(btn); row.appendChild(status);
    about.appendChild(row);

    function setStatus(txt, color) { status.textContent = txt; status.style.color = color || 'var(--text-muted)'; }
    var handling = false;
    function checkNow() {
      if (handling) return;
      handling = true;
      setStatus('正在检查…');
      window.__CM_UPDATER.check().then(function (r) {
        handling = false;
        if (!r || !r.ok) { setStatus('检查失败：' + ((r && r.message) || '网络不通，稍后再试'), 'var(--danger)'); return; }
        // 其余状态由事件流驱动（available/downloading/ready/none）
        if (r.version && r.version === D.version) setStatus('已是最新版本 v' + D.version);
      }).catch(function (e) {
        handling = false;
        setStatus('检查失败：' + String(e && e.message || e).slice(0, 60), 'var(--danger)');
      });
    }
    btn.onclick = checkNow;

    window.__CM_UPDATER.onEvent(function (ev) {
      if (!ev) return;
      if (ev.state === 'checking') setStatus('正在检查…');
      else if (ev.state === 'available') setStatus('发现新版 v' + ev.version + '，正在后台下载…');
      else if (ev.state === 'none') setStatus('已是最新版本 v' + D.version);
      else if (ev.state === 'downloading') setStatus('正在下载新版… ' + ev.percent + '%（' + ev.mb + ' MB）');
      else if (ev.state === 'ready') {
        setStatus('✅ 新版 v' + ev.version + ' 已就绪：重启应用即完成安装', 'var(--success)');
        btn.textContent = '🔄 立即重启安装';
        btn.onclick = function () { window.__CM_UPDATER.install(); };
        if (typeof window.showToast === 'function') window.showToast('新版本已就绪，重启应用即完成安装', 'success');
      } else if (ev.state === 'error') {
        setStatus('更新出错：' + (ev.message || '网络问题，稍后再试'), 'var(--danger)');
      }
    });

    // 启动静默检查（一次，30 秒后——避开启动高峰与弱网首屏）
    setTimeout(function () { checkNow(); }, 30000);
  }

  /* ---------- 启动 ---------- */
  function boot() {
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
