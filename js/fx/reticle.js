/* ═══════════════════════════════════════════════════════════════
   js/fx/reticle.js — 自定义 HUD 准星
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var node, ring, label;
  var tx = 0, ty = 0, cx = 0, cy = 0;
  var active = false, running = false;

  /* 悬停目标 → 准星标签 */
  var RULES = [
    { sel: 'a, button, [role="button"]', txt: 'ACTIVATE' },
    { sel: 'input, textarea',            txt: 'INPUT' },
    { sel: '.work',                      txt: 'TARGET LOCKED' },
    { sel: '.chip',                      txt: 'FILTER' },
    { sel: '.job__head',                 txt: 'EXPAND' },
    { sel: '.copy-item__btn',           txt: 'COPY' },
    { sel: '.glitch',                    txt: 'DECRYPT' }
  ];

  function describe(target) {
    for (var i = 0; i < RULES.length; i++) {
      if (target.closest && target.closest(RULES[i].sel)) return RULES[i].txt;
    }
    return '';
  }

  function frame(dt) {
    cx = U.damp(cx, tx, 22, dt);
    cy = U.damp(cy, ty, 22, dt);
    node.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
  }

  function onMove(e) {
    tx = e.clientX; ty = e.clientY;
    if (!active) {
      // 首次进入时不要从 (0,0) 飞过来
      cx = tx; cy = ty; active = true;
      node.classList.add('is-on');
    }
    var t = e.target;
    var txt = t && t.nodeType === 1 ? describe(t) : '';
    if (txt) {
      if (label.textContent !== txt) label.textContent = txt;
      node.classList.add('is-hot');
    } else {
      node.classList.remove('is-hot');
    }
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    node = U.$('#reticle');
    if (!node) return;

    // 仅在精细指针设备上接管光标（触屏保留系统行为）
    if (!U.finePointer()) { node.style.display = 'none'; return; }

    ring = U.$('.reticle__ring', node);
    label = U.$('.reticle__label', node);

    document.documentElement.classList.add('has-reticle');
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerdown', function () { node.classList.add('is-hot'); }, { passive: true });
    root.addEventListener('pointerup', function () {
      node.classList.remove('is-hot');
      if (active) { var t = document.elementFromPoint(tx, ty); if (t && describe(t)) node.classList.add('is-hot'); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      active = false; node.classList.remove('is-on');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; U.loop.remove('reticle'); }
      else if (active && !running) { running = true; U.loop.add('reticle', frame); }
    });

    running = true;
    U.loop.add('reticle', frame);
  }

  CYBER.reticle = { init: init };
  CYBER.register('reticle', { order: 30, init: init });
})(window);
