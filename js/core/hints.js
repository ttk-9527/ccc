/* ═══════════════════════════════════════════════════════════════
   js/core/hints.js — 无障碍提示与控制台横幅（原 app.js initA11yHints 拆出）
   · 首次按 Tab 时弹快捷键提示（真正弹出后才移除监听）
   · 检测到「减少动态效果」偏好时给出说明
   · 输出版本 / 模块清单 / 快捷键到控制台，方便自检
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var inited = false;

  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    /* 键盘用户首次按 Tab 时提示快捷键。
       不用 {once:true}：否则任意第一个按键（非 Tab）就会让提示永久失效。 */
    var shown = false;
    function onKeydown(e) {
      if (shown || e.key !== 'Tab') return;
      shown = true;
      document.removeEventListener('keydown', onKeydown);
      setTimeout(function () {
        CYBER.toast.show('快捷键：Ctrl/⌘+K 打开终端 · 数字 1–5 跳转区块 · T 换配色 · M 静音', {
          key: 'A11Y', ms: 6000
        });
      }, 400);
    }
    document.addEventListener('keydown', onKeydown);

    /* 减弱动效偏好变化时给出说明 */
    if (U.reducedMotion()) {
      CYBER.toast.show('检测到「减少动态效果」偏好，已自动关闭粒子与位移动画。', {
        key: 'MOTION', ms: 5200
      });
    }

    /* 输出无障碍状态到控制台，方便自检 */
    console.info(
      '%c GST·AI DOSSIER %c v' + CYBER.VERSION + ' ',
      'background:#fcee0a;color:#100c00;font-weight:700',
      'background:#120726;color:#00f0ff'
    );
    console.info('模块：' + CYBER.moduleNames().join(' · '));
    console.info('快捷键：Ctrl/⌘+K 终端 · 1–5 跳转 · T 配色 · M 音效');
  }

  CYBER.hints = { init: init };
  CYBER.register('hints', { order: 140, init: init });
})(window);
