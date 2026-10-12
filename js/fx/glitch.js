/* ═══════════════════════════════════════════════════════════════
   js/fx/glitch.js — 全局故障联动与随机调度（原 app.js initGlitch 拆出）
   · 订阅 U.bus 的 'bg:glitch'：联动 Canvas 故障切片 + CRT 叠加层闪烁
   · 每 14~26 秒随机自发一次，保持「活着」的感觉
   · document.hidden 时暂停调度（定时器不空转），回到前台再恢复
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var inited = false;
  var fx = null, clearTimer = null, glitchTimer = null, paused = false;

  /* ── 随机调度 ── */
  function schedule(delay) {
    if (glitchTimer) clearTimeout(glitchTimer);
    glitchTimer = setTimeout(function () {
      if (paused) return;
      if (!document.hidden) U.bus.emit('bg:glitch');
      schedule(U.rand(14000, 26000));
    }, delay);
  }

  function stop() {
    paused = true;
    if (glitchTimer) { clearTimeout(glitchTimer); glitchTimer = null; }
  }

  function resume() {
    if (!paused) return;
    paused = false;
    schedule(U.rand(14000, 26000));
  }

  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    fx = U.$('.fx-stack');

    U.bus.on('bg:glitch', function () {
      if (U.reducedMotion()) return;
      CYBER.background.glitch(240);
      if (fx) fx.classList.add('is-glitching');
      document.body.classList.add('is-glitching');

      clearTimeout(clearTimer);
      clearTimer = setTimeout(function () {
        if (fx) fx.classList.remove('is-glitching');
        document.body.classList.remove('is-glitching');
      }, 300);
    });

    /* Quick Win #4：点击 RGB 故障错位——给被点目标加 .fx-rgb，动画在 fx.css */
    document.addEventListener('click', function (e) {
      if (U.reducedMotion() || !e.target || !e.target.closest) return;
      var el = e.target.closest('a, button, .chip, .work');
      if (!el) return;
      el.classList.remove('fx-rgb');
      void el.offsetWidth;   // 强制重排，连续点击也能重启动画
      el.classList.add('fx-rgb');
      setTimeout(function () { el.classList.remove('fx-rgb'); }, 380);
    });

    if (!U.reducedMotion()) {
      /* 页面隐藏即暂停调度，回到前台再恢复（原实现只跳过 emit，定时器仍空转） */
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else resume();
      });
      schedule(U.rand(14000, 26000));
    }
  }

  CYBER.glitch = { init: init, stop: stop, resume: resume };
  CYBER.register('glitch', { order: 130, init: init });
})(window);
