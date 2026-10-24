# -*- coding: utf-8 -*-
"""把桌面版 app.patch.js 的「学期报告引擎 + 数据分析图表引擎 P0/P1/P2」移植进网页版（v3.6.0）；
v3.6.1 增补：学期报告导航图标线条化（精灵符号 i-report，弃用 emoji）。

产出（全部写入 web 仓 = ../.. 下 class-manager/）：
  1. cmgx.js          —— 新文件：四段 + el/ls 助手 + KPI 计数器子集 + CSS 注入 + 导航入口 + 启动接线
  2. echarts.min.js   —— 从桌面 src/ 原样复制（1.12MB）
  3. index.html 补丁  —— 尾部挂 <script src="./cmgx.js">；摘除 v3.4.1 停更横幅（CSS段+HTML+内联脚本）；跟版五处 + 速览当版一条
  4. sw.js 补丁       —— CORE_ASSETS 加两文件；CACHE_NAME → VER_NEW
适配（桌面→网页）：剥 Pro 闸一行 / 剥 PRO 徽标 span / printToPDF IPC → 隐藏 iframe 浏览器打印；
其余逐字保留（接管 window.render* / echarts 懒加载回退 / CSS 变量主题均天然适配网页版皮肤系统）。
"""
import io, re, sys

DESK = r'C:\Users\84669\.zcode\workspace\default\class-manager-desktop\app'
WEB = r'C:\Users\84669\.zcode\workspace\default\class-manager'
VER_OLD, VER_NEW = 'v3.6.4', 'v3.6.5'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read().replace('\r\n', '\n')

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)

def die(msg):
    print('✗ ' + msg); sys.exit(1)

def must_count(s, needle, n, tag):
    c = s.count(needle)
    if c != n: die('[%s] 期望 %d 实际 %d: %r' % (tag, n, c, needle[:60]))

def section(src, start_marker, end_marker, name):
    a = src.find(start_marker)
    if a < 0: die('找不到段头: ' + name)
    b = src.find(end_marker, a + len(start_marker))
    if b < 0: die('找不到段尾: ' + name)
    seg = src[a:b].rstrip() + '\n'
    print('✓ 段 [%s] %d 字符' % (name, len(seg)))
    return seg

# ---------- 0. 读源 ----------
patch = rd(DESK + r'\src\app.patch.js')
wizard_css = rd(DESK + r'\src\wizard.css')
web_html = rd(WEB + r'\index.html')
web_sw = rd(WEB + r'\sw.js')

# ---------- 1. 切四段 ----------
m3 = section(patch, '/* ---------- M3 学期报告引擎', '/* ---------- v1.2.6 请假流水导出', 'M3学期报告')
p0 = section(patch, '/* ---------- 数据分析图表引擎（v1.3.0）：成绩 tab', '/* ---------- v1.3.0 P1', 'P0成绩图表')
p1 = section(patch, '/* ---------- v1.3.0 P1', '/* ---------- v1.3.0 P2', 'P1学分图表')
p2 = section(patch, '/* ---------- v1.3.0 P2', '/* ---------- v1.4.0 界面符号统一', 'P2首页公示')

# ---------- 2. KPI 计数器子集（动效段，按函数名切片） ----------
def fn_block(src, header, end_probe, name):
    a = src.find(header)
    if a < 0: die('找不到函数: ' + name)
    b = src.find(end_probe, a)
    if b < 0: die('找不到函数尾探针: ' + name)
    seg = src[a:b].rstrip() + '\n'
    print('✓ 计数器 [%s] %d 字符' % (name, len(seg)))
    return seg

gx_on = fn_block(patch, 'function gxMotionOn()', 'function gxCloseMask', 'gxMotionOn')
gx_ann = fn_block(patch, 'function gxCountAnnotate(root)', 'var _gxTweenUntil', 'gxCountAnnotate')
gx_tween = fn_block(patch, 'var _gxTweenUntil', 'function gxPlayCounters', 'gxWriteCounters(含_gxTweenUntil)')
gx_play = fn_block(patch, 'function gxPlayCounters(root)', 'function gxStagger', 'gxPlayCounters')
# gxPlayCounters 内含 v1.5.2 三重保险（document.hidden 守卫 + setTimeout 强写 + visibilitychange），逐字保留

# ---------- 3. CSS 提取（wizard.css 按行选规则） ----------
CSS_SEL_RE = re.compile(r'^(\.cmDesk-modal-overlay|\.cmDesk-donate-card|\.cmDesk-donate-close|\.cmDesk-report-panel|\.cmDesk-rp-[\w-]+|\.cmGx-[\w-]+|\.gx-motion-off|\.cmDesk-navreport|\.gx-closing)\b')
css_lines = [l.rstrip() for l in wizard_css.split('\n')]
picked = [l for l in css_lines if CSS_SEL_RE.match(l)]
if len(picked) < 25: die('CSS 提取过少: %d 行' % len(picked))
CSS = '\n'.join(picked)
print('✓ CSS 提取 %d 行规则' % len(picked))

# ---------- 4. 适配 M3 ----------
# 4a. 剥 Pro 闸
must_count(m3, "if (!cmProActive()) { cmProModal('学期报告引擎'); return; }", 1, 'Pro闸')
m3 = m3.replace("if (!cmProActive()) { cmProModal('学期报告引擎'); return; }", '/* 网页版：免费开放，无 Pro 闸 */')
# 4b. 剥 PRO 徽标
must_count(m3, ' <span class="cmDesk-pro-badge">PRO</span>', 1, 'PRO徽标')
m3 = m3.replace(' <span class="cmDesk-pro-badge">PRO</span>', '')
# 4c. printToPDF IPC → 隐藏 iframe 浏览器打印
pdf_old_a = m3.find('btnPdf.onclick = function () {')
pdf_old_b = m3.find('};', m3.find('window.__CM_PRO.reportPdf'))
if pdf_old_a < 0 or pdf_old_b < 0: die('PDF handler 定位失败')
pdf_new = (
"""btnPdf.onclick = function () {
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
    };""")
m3 = m3[:pdf_old_a] + pdf_new + m3[pdf_old_b + 2:]
# 4d. 段头注释去桌面措辞（printToPDF/Pro 字样）
must_count(m3, '导出两条路：canvas 自绘长图（复用页面 pngExport）+ 主进程 printToPDF。', 1, 'M3头注释')
m3 = m3.replace('导出两条路：canvas 自绘长图（复用页面 pngExport）+ 主进程 printToPDF。',
                '导出两条路：canvas 自绘长图（复用页面 pngExport）+ 浏览器打印（打印对话框另存为 PDF）。')
m3 = m3.replace('M3 学期报告引擎（v1.1.0 Pro 核心）：个人 + 班级，长图 / PDF',
                'M3 学期报告引擎（桌面 v1.1.0 Pro 核心 → 网页版 v3.6.0 免费开放）：个人 + 班级，长图 / PDF')
print('✓ M3 适配完成（Pro闸/徽标/PDF打印/注释去桌面化）')

# ---------- 5. 组装 cmgx.js ----------
import json
css_js = json.dumps('\n' + CSS + '\n', ensure_ascii=False)   # JSON 编码：CSS 含单引号（字体名），不能再嵌单引号 JS 串
HEAD = """/*! cmgx.js — 班主任工作台 网页版 增强引擎（v3.6.5）
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
    s.textContent = __CSS__;
    document.head.appendChild(s);
  })();

"""
HEAD = HEAD.replace('__CSS__', css_js)

NAV = """
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
"""

body = HEAD + gx_on + '\n' + gx_ann + gx_tween + gx_play + '\n' + m3 + '\n' + p0 + '\n' + p1 + '\n' + p2 + NAV
wr(DESK + r'\..\_cmgx_out.js', body)   # 先落草稿供检查，最终写 web 在下方步骤
print('✓ cmgx.js 草稿 %d 字符 → _cmgx_out.js' % len(body))

# ---------- 6. 写入 web 仓 ----------
# 6a. cmgx.js + echarts.min.js
import shutil
wr(WEB + r'\cmgx.js', body)
shutil.copyfile(DESK + r'\src\echarts.min.js', WEB + r'\echarts.min.js')
print('✓ cmgx.js / echarts.min.js 已写入 web 仓')

# 6b. index.html：script 注入（幂等）+ 横幅摘除 + 跟版
must_count(web_html, '</body>', 1, 'body尾')
if 'src="./cmgx.js"' not in web_html:
    web_html = web_html.replace('</body>', '<script src="./cmgx.js"></script>\n</body>')

# 停更横幅 CSS 段（幂等：从段头注释到下一个同级注释头）
a = web_html.find('/* ==================== v3.4.1 网页版停更横幅')
if a >= 0:
    b = web_html.find('/* ====================', a + 30)
    if b < 0: die('找不到横幅CSS段尾')
    web_html = web_html[:a] + web_html[b:]

# 横幅 HTML 元素（幂等）
a = web_html.find('<div id="eolBanner"')
if a >= 0:
    b = web_html.find('</div>', a)
    web_html = web_html[:a] + web_html[b + 6:]
# 横幅内联摘除脚本（幂等）
a = web_html.find('<script data-eol')
if a >= 0:
    b = web_html.find('</script>', a)
    web_html = web_html[:a] + web_html[b + 9:]
must_count(web_html, 'eolBanner', 0, '横幅残留')
must_count(web_html, 'data-eol', 0, '横幅脚本残留')

# 跟版五处 + 速览（幂等：已是新版则跳过）
def bump1(s, old, new, tag):
    if old in s:
        must_count(s, old, 1, tag)
        s = s.replace(old, new)
    else:
        must_count(s, new, 1, tag + '(已跟版)')
    return s

web_html = bump1(web_html, '<div class="login-version">' + VER_OLD + '</div>', '<div class="login-version">' + VER_NEW + '</div>', '登录版本')
web_html = bump1(web_html, '<div class="sidebar-footer">' + VER_OLD + ' · 班主任工作台</div>', '<div class="sidebar-footer">' + VER_NEW + ' · 班主任工作台</div>', '侧栏版本')
web_html = bump1(web_html, '🏷️ ' + VER_OLD + '</span>', '🏷️ ' + VER_NEW + '</span>', '徽标')
# 速览标题与内容（当版一条；幂等）
if '近版更新速览（' + VER_OLD + '）' in web_html:
    web_html = web_html.replace('近版更新速览（' + VER_OLD + '）', '近版更新速览（' + VER_NEW + '）')
else:
    must_count(web_html, '近版更新速览（' + VER_NEW + '）', 1, '速览标题(已跟版)')
NEW_NOTE_MARK = '📊 <b>数据分析图表引擎 + 学期报告引擎上线'
if NEW_NOTE_MARK not in web_html:
    m = re.search(r'id="settingsReleaseNotes"[^>]*>\n([\s\S]*?)\s*</div>', web_html)
    if not m: die('速览内容锚点失配')
    NEW_NOTE = (' · 📊 <b>数据分析图表引擎 + 学期报告引擎上线（' + VER_NEW + '）</b>：成绩分析（KPI 环比/直方图/雷达/趋势/名次流动/学业预警）、'
                '学分分析（KPI 六卡/五档分布/近 7 天净变动/进退步榜）全部 ECharts 重绘，自动适配皮肤与暗色；'
                '首页学分分布与公示页四图统一纸墨主题；侧栏新增 <b>🎓 学期报告</b>（个人/班级报告，长图导出 + 打印 PDF）<br>')
    web_html = web_html[:m.start(1)] + NEW_NOTE + web_html[m.end(1):]

# v3.6.1 速览条目（幂等：导航图标线条化）
NOTE_361_MARK = '🎨 <b>学期报告导航图标线条化'
if NOTE_361_MARK not in web_html:
    must_count(web_html, NEW_NOTE_MARK, 1, 'v3.6.0 速览锚点')
    NOTE_361 = (' · ' + NOTE_361_MARK + '（' + VER_NEW + '）</b>：学士帽线条图标并入侧栏精灵图（#i-report），'
                '弃用 emoji，与其他导航图标同风格同尺寸<br>\n')
    web_html = web_html.replace(' · ' + NEW_NOTE_MARK, NOTE_361 + ' · ' + NEW_NOTE_MARK, 1)

# v3.6.1 侧栏精灵图补 i-report 符号（幂等；裸描边路径，继承全局 .ic 样式）
SYM_REPORT = ('<symbol id="i-report" viewBox="0 0 24 24">'
              '<path d="M12 4 2.8 8.6 12 13.2 21.2 8.6Z"/>'
              '<path d="M6.6 10.9v4.3c0 1.65 2.4 3 5.4 3s5.4-1.35 5.4-3v-4.3"/>'
              '<path d="M21.2 8.6v5.4"/></symbol>')
if 'id="i-report"' not in web_html:
    must_count(web_html, 'id="i-credit-minus"', 1, '精灵图末符号')
    a = web_html.find('id="i-credit-minus"')
    b = web_html.find('</symbol>', a)
    if b < 0: die('精灵图符号尾失配')
    web_html = web_html[:b + 9] + '\n' + SYM_REPORT + web_html[b + 9:]

wr(WEB + r'\index.html', web_html)
print('✓ index.html：script注入 + 横幅摘除 + 跟版五处 + 速览')

# 6c. sw.js（幂等）
if "CACHE_NAME = 'class-manager-" + VER_OLD + "'" in web_sw:
    web_sw = web_sw.replace("CACHE_NAME = 'class-manager-" + VER_OLD + "'", "CACHE_NAME = 'class-manager-" + VER_NEW + "'")
else:
    must_count(web_sw, "CACHE_NAME = 'class-manager-" + VER_NEW + "'", 1, 'CACHE(已跟版)')
if "'./cmgx.js'" not in web_sw:
    must_count(web_sw, "'./icon_512.png'", 1, '资产锚点')
    web_sw = web_sw.replace("'./icon_512.png'", "'./icon_512.png',\n  './cmgx.js',\n  './echarts.min.js'")
wr(WEB + r'\sw.js', web_sw)
print('✓ sw.js：CACHE → %s + 两资产' % VER_NEW)
print('\n🎉 移植完成（未提交，待验证与老板审阅）')
