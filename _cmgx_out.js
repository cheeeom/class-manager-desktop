/*! cmgx.js — 班主任工作台 网页版 增强引擎（v3.6.9）
 *  内容：数据分析图表引擎（成绩/学分/首页/公示，ECharts + 纸墨主题）+ 学期报告引擎（个人/班级，长图/打印PDF）
 *  移植自桌面版注入层（class-manager-desktop v1.5.5 app/src/app.patch.js 的 M3/P0/P1/P2 分节），
 *  网页版全部功能免费开放（无 Pro 闸）。echarts.min.js 首次渲染时懒加载，失败/超时静默回退原实现；
 *  图表颜色运行时读 CSS 变量，自动适配 亮/暗 与 皮肤系统（v3.4.0 朱砂/青花/竹青）。
 *  本文件由桌面仓 app/_port_to_web.py 生成后人工适配，修改请同步两端。 */
(function () {
  'use strict';
  if (window.__CM_DESKTOP) return;   // 桌面版壳自带同源引擎（app.patch.js 接管 + Pro 闸），网页版引擎在桌面内不重复挂载
  if (window.__CM_GX__) return;
  window.__CM_GX__ = true;

  /* ---------- 基础助手（与桌面层同源） ---------- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- 样式注入（源自桌面 wizard.css 对应规则） ---------- */
  (function () {
    var s = el('style');
    s.textContent = "\n.cmDesk-modal-overlay{position:fixed;inset:0;z-index:2147483400;background:rgba(43,35,24,.45);display:flex;align-items:center;justify-content:center;animation:cmDeskGuideIn .2s ease}\n.cmDesk-donate-card{position:relative;background:var(--card-bg,#FFFDF7);border:1px solid var(--border,#E6DECD);border-radius:16px;box-shadow:0 24px 64px rgba(60,40,20,.28);padding:22px 26px;max-width:440px;width:min(440px,92vw);text-align:center}\n.cmDesk-donate-card h3{font-family:var(--font-display);font-size:16px;color:var(--primary,#A63A2B);margin-bottom:14px}\n.cmDesk-donate-card p{font-size:12.5px;color:var(--text-secondary,#5F5E5A);line-height:1.8;margin:0}\n.cmDesk-donate-close{position:absolute;top:8px;right:12px;border:0;background:none;font-size:22px;line-height:1;color:var(--text-muted,#8C8577);cursor:pointer;padding:4px}\n.cmDesk-report-panel{max-width:640px;width:min(640px,94vw);text-align:left}\n.cmDesk-rp-tabs{display:flex;gap:8px;margin-bottom:12px}\n.cmDesk-rp-tab{border:1px solid var(--border,#E6DECD);background:var(--row-bg,#FBF8F1);color:var(--text-secondary,#5F5E5A);border-radius:10px;padding:7px 18px;font-size:13px;cursor:pointer}\n.cmDesk-rp-tab.active{background:var(--primary,#A63A2B);border-color:var(--primary,#A63A2B);color:#fff;font-weight:600}\n.cmDesk-rp-row{margin-bottom:10px}\n.cmDesk-rp-row label{display:block;font-size:12px;color:var(--text-secondary,#5F5E5A);margin-bottom:4px}\n.cmDesk-rp-row select{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border,#E6DECD);border-radius:8px;background:var(--row-bg,#FBF8F1);font-size:13px}\n.cmDesk-rp-row textarea{width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;border:1px solid var(--border,#E6DECD);border-radius:8px;font-size:12.5px;resize:vertical;font-family:inherit}\n.cmDesk-rp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}\n.cmDesk-rp-preview{max-height:52vh;overflow:auto;border:1px solid var(--border,#E6DECD);border-radius:10px;background:var(--row-bg,#FBF8F1);padding:10px}\n.cmDesk-rp-preview canvas{display:block;width:100%;height:auto;border-radius:8px;box-shadow:0 2px 10px rgba(60,40,20,.12)}\n.cmDesk-rp-empty{font-size:12px;color:var(--text-muted,#8C8577);text-align:center;padding:26px 10px}\n.cmDesk-rp-msg{font-size:11.5px;color:var(--text-muted,#8C8577);line-height:1.7;margin-top:8px;word-break:break-all}\n.cmDesk-navreport .nav-icon{font-size:15px;display:flex;align-items:center;justify-content:center}\n.cmGx-loading{padding:46px;text-align:center;color:var(--text-muted,#8C8577);font-size:13px}\n.cmGx-empty{padding:30px 10px;text-align:center;color:var(--text-muted,#8C8577);font-size:12.5px}\n.cmGx-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:12px}\n.cmGx-kpi{position:relative;overflow:hidden;background:var(--card-bg,#FFFDF7);border:1px solid var(--border,#E6DECD);border-radius:14px;padding:13px 15px}\n.cmGx-kpi::after{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--primary,#A63A2B);opacity:.85}\n.cmGx-klabel{font-size:11px;color:var(--text-muted,#8C8577);letter-spacing:1px}\n.cmGx-kvalue{font-size:26px;font-weight:700;line-height:1.15;margin:3px 0 2px;font-variant-numeric:tabular-nums;color:var(--text,#2B2B33)}\n.cmGx-kvalue small{font-size:12px;font-weight:400;color:var(--text-muted,#8C8577);margin-left:3px}\n.cmGx-ktrend{font-size:10.5px;font-weight:600;border-radius:999px;display:inline-block;padding:2px 8px;margin-top:2px}\n.cmGx-up{color:var(--success,#2F7D5B);background:rgba(47,125,91,.10)}\n.cmGx-down{color:var(--danger,#B42318);background:rgba(180,35,24,.09)}\n.cmGx-flat{color:var(--text-muted,#8C8577);background:rgba(140,133,119,.10)}\n.cmGx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}\n.cmGx-card{background:var(--card-bg,#FFFDF7);border:1px solid var(--border,#E6DECD);border-radius:14px;padding:14px 16px 10px;margin-bottom:12px}\n.cmGx-grid2 .cmGx-card{margin-bottom:0}\n.cmGx-title{font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:7px;color:var(--text,#2B2B33)}\n.cmGx-title i{width:8px;height:8px;background:var(--primary,#A63A2B);border-radius:2px;transform:rotate(45deg);flex:none}\n.cmGx-cap{font-size:11px;color:var(--text-muted,#8C8577);margin:2px 0 4px;padding-left:15px}\n.cmGx-chart{height:250px;width:100%}\n.cmGx-chart.tall{height:300px}\n.cmGx-chart .cmGx-empty{display:flex;align-items:center;justify-content:center;height:100%;box-sizing:border-box}\n.cmGx-warn{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;margin-bottom:6px;background:rgba(180,35,24,.05);border:1px solid rgba(180,35,24,.12)}\n.cmGx-warn.amber{background:rgba(192,138,45,.06);border-color:rgba(192,138,45,.18)}\n.cmGx-chip{font-size:10px;padding:2px 7px;border-radius:6px;background:rgba(180,35,24,.10);color:var(--danger,#B42318);font-weight:600;flex:none;white-space:nowrap}\n.cmGx-chip.amber{background:rgba(192,138,45,.13);color:var(--warning,#C08A2D)}\n.cmGx-rank{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:10px}\n.cmGx-rank:hover{background:rgba(166,58,43,.04)}\n.cmGx-rnum{width:23px;height:23px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:#fff;flex:none}\n.cmGx-rnum.r1{background:var(--gold,#C9A227)}\n.cmGx-rnum.r2{background:#A8A29A}\n.cmGx-rnum.r3{background:#C08A2D}\n.cmGx-rnum.rn{background:var(--bg,#F6F2E9);color:var(--text-secondary,#5C574F);border:1px solid var(--border,#E6DECD)}\n.cmGx-rmain{flex:1;min-width:0}\n.cmGx-rname{font-size:12.5px;font-weight:600;color:var(--text,#2B2B33)}\n.cmGx-rbar{height:4.5px;border-radius:3px;background:var(--bg,#F6F2E9);margin-top:3px;overflow:hidden}\n.cmGx-rbar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--primary-light,#C25B4A),var(--primary,#A63A2B))}\n.cmGx-rsubs{font-size:10px;color:var(--text-muted,#8C8577);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.cmGx-rscore{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;min-width:40px;text-align:right;color:var(--text,#2B2B33)}\n.cmGx-kpis.cols6{grid-template-columns:repeat(6,minmax(0,1fr))}\n.cmGx-card{transition:transform .18s var(--gx-ease),box-shadow .18s var(--gx-ease),border-color .18s var(--gx-ease)}\n.cmGx-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(25,22,19,.08)}\n.cmGx-rank,.gxSec-row{transition:background .15s var(--gx-ease)}\n";
    document.head.appendChild(s);
  })();

function gxMotionOn() {
    if (lsGet('cm_motion_off') === '1') return false;
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return true;
  }

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

/* ---------- M3 学期报告引擎（桌面 v1.1.0 Pro 核心 → 网页版 v3.6.0 免费开放）：个人 + 班级，长图 / PDF ----------
     数据只用网页版 state（流水/请假/成绩），统计一律走 liveOps 过滤撤销；
     学期起点与公示页同口径（手动设置优先，回退 3/1、9/1 自动推断）；
     导出两条路：canvas 自绘长图（复用页面 pngExport）+ 浏览器打印（打印对话框另存为 PDF）。 */
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
    /* 网页版：免费开放，无 Pro 闸 */
    if (document.getElementById('cmDeskReport')) return;
    var m = el('div', 'cmDesk-modal-overlay');
    m.id = 'cmDeskReport';
    var stus = cmReportLiveStudents().slice().sort(function (a, b) { return (a.sid || '') < (b.sid || '') ? -1 : 1; });
    var opts = stus.map(function (s) { return '<option value="' + s.id + '">' + (s.sid ? s.sid + ' ' : '') + s.name + '</option>'; }).join('');
    m.innerHTML =
      '<div class="cmDesk-donate-card cmDesk-report-panel">' +
      '<button class="cmDesk-donate-close" id="cmRptClose" aria-label="关闭">×</button>' +
      '<h3>🎓 学期报告引擎</h3>' +
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
      if (!lastCanvas) return;
      btnPdf.disabled = true; msg.textContent = '正在打开打印…在打印对话框选择「另存为 PDF」即可导出';
      var html;
      if (mode === 'stu') {
        var stu2 = null;
        cmReportLiveStudents().forEach(function (s) { if (s.id === Number(sel.value)) stu2 = s; });
        html = cmReportStuPdf(cmReportStuData(stu2), cmtBox.value.trim());
      } else {
        html = cmReportClassPdf(cmReportClassData());
      }
      /* 网页版：浏览器打印方案 —— 隐藏 iframe + contentWindow.print()（对话框选「另存为 PDF」导出） */
      var fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:820px;height:0;border:0;visibility:hidden';
      fr.onload = function () {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {}
        setTimeout(function () { if (fr.parentNode) fr.parentNode.removeChild(fr); }, 60000);
        btnPdf.disabled = false; msg.textContent = '已打开打印对话框（选择「另存为 PDF」导出）';
      };
      fr.srcdoc = html;
      document.body.appendChild(fr);
    };
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
  var cmGxPendingById = {};
  function cmGxChart(id, option) {
    var dom = document.getElementById(id);
    if (!cmEchartsReady()) {
      if (!dom) return;
      cmGxPendingById[id] = option;   /* v3.6.9 未就绪先记下（同图后画覆盖前画），加载完成统一补画 */
      cmLoadEcharts(function (okFlag) { if (!okFlag) cmGxPendingById = {}; });
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
      if (!cmEchartsReady()) {
        cmLoadEcharts(function (okFlag) {
          if (okFlag) return;   /* 成功由 cmEchartsAfterLoad 补画 */
          var bx = document.getElementById('cmGxDashDist'), cv = document.getElementById('distChart');
          if (bx && bx.parentNode) bx.parentNode.removeChild(bx);   /* v3.6.9 回退原 canvas 实现（加载失败/超时） */
          if (cv) cv.style.display = '';
          if (typeof orig === 'function') orig(credits);
        });
      }
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

  /* ---------- v3.6.9 首访竞态补画（echarts 懒加载完成后：补画排队图表 + 可见页图表；移植切片漏带桌面启动段实现，此前调用未定义函数被 try/catch 吞掉致首页分布冷启动空白） ---------- */
  function cmEchartsAfterLoad() {
    var pend = cmGxPendingById;
    cmGxPendingById = {};
    for (var pid in pend) { try { cmGxChart(pid, pend[pid]); } catch (e) {} }
    try { cmGxThemeExtras(); } catch (e) {}
  }

  /* ---------- 学期报告导航入口（网页版：侧栏设置项前注入；随侧栏重渲染自愈） ---------- */
  function gxInjectReportNav() {
    var nav = document.querySelector('.sidebar nav') || document.querySelector('.sidebar');
    if (!nav) return;
    if (document.getElementById('cmNavReport')) return;
    var settingsItem = nav.querySelector('.nav-item[data-page="settings"]');
    var item = el('div', 'nav-item');
    item.id = 'cmNavReport';
    item.title = '学期报告（个人 / 班级）';
    item.innerHTML = '<span class="nav-icon"><svg class="ic"><use href="#i-report"/></svg></span><span class="nav-text">学期报告</span>';
    item.addEventListener('click', function () { if (typeof cmReportOpen === 'function') cmReportOpen(); });
    if (settingsItem) settingsItem.parentNode.insertBefore(item, settingsItem);
    else nav.appendChild(item);
  }
  gxInjectReportNav();
  try {
    new MutationObserver(gxInjectReportNav).observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  /* ---------- 切页补播 KPI 滚动数字（网页版导航钩子，v1.5.1 同源逻辑） ---------- */
  (function () {
    var prev = window.navigateTo;
    if (typeof prev !== 'function' || prev.__gxNav) return;
    var w = function () { var r = prev.apply(this, arguments); try { var pg = document.querySelector('.page.active'); if (pg) gxPlayCounters(pg); } catch (e) {} return r; };
    w.__gxNav = true;
    window.navigateTo = w;
  })();

  /* ---------- 启动接线（桌面启动段同源，仅图表/报告引擎） ---------- */
  function boot() {
    try { cmWrapGradeDetail(); } catch (e) { console.warn('[cmgx] 成绩图表接管失败', e); }
    try { cmWrapCreditRender(); } catch (e) { console.warn('[cmgx] 学分图表接管失败', e); }
    try { cmWrapCreditTabSwitch(); } catch (e) {}
    try { cmWrapDistChart(); } catch (e) {}
    try { cmWrapPubCharts(); } catch (e) {}
    gxInjectReportNav();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
