/* ⑳ v1.5.0：动效系统契约（cmMotion）——令牌/进出场/stagger/数字滚动/降级开关 */
t('⑳ v1.5.0 动效系统', function () {
  const p = fs.readFileSync(path.join(HERE, 'src', 'app.patch.js'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, 'src', 'wizard.css'), 'utf8');
  // 令牌与进出场
  has(css, '--gx-ease:cubic-bezier(.2,.7,.3,1)', '动效缓动令牌');
  has(css, 'gxModalIn', '纸墨弹窗进场动画');
  has(css, 'gxModalOut', '纸墨弹窗退场动画');
  has(css, 'gxRise', '卡片进场动画');
  has(css, '.gx-stagger>*', 'stagger 容器选择器');
  // JS 驱动
  has(p, 'function gxMotionOn', '动效开关判定');
  has(p, "lsGet('cm_motion_off') === '1'", '用户动效开关存储');
  has(p, 'prefers-reduced-motion: reduce', '系统减少动态偏好接入');
  has(p, "classList.add('gx-motion-off')", 'boot 挂降级类');
  has(p, 'function gxCloseMask', '遮罩关闭动画驱动');
  ok((p.match(/function close\(\) \{ gxCloseMask\(mask\); \}/g) || []).length === 2, '两处纸墨弹窗 close 接动画');
  /* 锚点升级（2026-11-16）：原钉 gxCountKpis，该函数在 v1.5.3 KPI 重设计时已更名为
     gxPlayCounters，且成绩页不再单独调用——改为两处「进页统一播」钩子。功能未减，锚点跟架构。
     仍按原强度核对三件事：函数在、显式接线在、进页兜底在（后者由 1 处升为 2 处，更强）。 */
  has(p, 'function gxPlayCounters', 'KPI 数字滚动');
  has(p, 'gxPlayCounters(panel);', '学分 KPI 滚动接线');
  ok((p.match(/gxPlayCounters\(pg\)/g) || []).length >= 2, '进页统一播数字（成绩页靠此兜底，两处钩子）');
  ok((p.match(/cmGx-grid2 gx-stagger/g) || []).length >= 5, '五处 grid2 stagger');
  has(p, 'gxStagger(listEl);', '荣誉/留痕列表 stagger 接线');
  // 商店版 btn 空守卫回归（v1.4.2）
  has(p, 'if (!window.__CM_UPDATER || !btn) return;', '商店版关于卡 btn 空守卫');
  // 降级规则（CSS）
  has(css, 'html.gx-motion-off', '用户关闭降级规则');
  has(css, '@media (prefers-reduced-motion: reduce)', '系统偏好降级规则');
  ok(css.indexOf('animation:none!important') >= 0, '降级时动画全关');
});

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');