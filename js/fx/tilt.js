/* ═══════════════════════════════════════════════════════════════
   js/fx/tilt.js — 3D 倾斜（原 app.js initTilt 拆出）
   指针悬停 [data-tilt] 元素时做透视倾斜；事件委托在 document 上，
   自动覆盖动态生成的卡片（身份卡等）。
   仅精细指针且未开启「减少动态效果」时启用。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var inited = false;

  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    if (!U.finePointer() || U.reducedMotion()) return;

    var active = null, nx = 0, ny = 0, queued = false;
    var MAX = 6;

    function apply() {
      queued = false;
      if (!active) return;
      active.style.transform =
        'perspective(1000px) rotateY(' + (nx * MAX).toFixed(2) + 'deg) ' +
        'rotateX(' + (-ny * MAX).toFixed(2) + 'deg)';
    }

    document.addEventListener('pointermove', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-tilt]') : null;

      if (el !== active) {
        if (active) {
          active.style.transition = 'transform 260ms cubic-bezier(0.2,0.9,0.1,1)';
          active.style.transform = '';
        }
        active = el;
        if (active) active.style.transition = 'none';
      }
      if (!active) return;

      var r = active.getBoundingClientRect();
      if (!r.width || !r.height) return;
      nx = (e.clientX - r.left) / r.width - 0.5;
      ny = (e.clientY - r.top) / r.height - 0.5;

      if (!queued) { queued = true; root.requestAnimationFrame(apply); }
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      if (!active) return;
      active.style.transition = 'transform 260ms cubic-bezier(0.2,0.9,0.1,1)';
      active.style.transform = '';
      active = null;
    });
  }

  CYBER.tilt = { init: init };
  CYBER.register('tilt', { order: 120, init: init });
})(window);
