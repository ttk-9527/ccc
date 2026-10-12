/* ═══════════════════════════════════════════════════════════════
   js/fx/scroll.js — 滚动揭示 / 进度轨 / 区块侦测 / HUD 自动收起
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var fill, hudTop, sections = [];
  var lastY = 0, ticking = false;

  /* ────────── 标题解密入场（批次2-A：乱码翻滚→左→右定形）────────── */
  var DECODE_GLYPHS = '▓▒░<>/\\=+*#0123456789';
  function decodeTitle(node) {
    if (U.reducedMotion()) return;
    var g = node.querySelector ? node.querySelector('.glitch') : null;
    if (!g || g.dataset.decoding) return;
    var final = g.getAttribute('data-text') || g.textContent;
    if (!final) return;
    g.dataset.decoding = '1';
    g.classList.add('is-decoding');
    var total = final.length, frame = 0, frames = 12;
    var iv = setInterval(function () {
      frame++;
      var revealed = Math.floor(total * frame / frames);
      var out = '';
      for (var k = 0; k < total; k++) {
        var ch = final.charAt(k);
        out += (k < revealed || ch === ' ') ? ch
             : DECODE_GLYPHS.charAt((Math.random() * DECODE_GLYPHS.length) | 0);
      }
      g.textContent = out;
      if (frame >= frames) {
        clearInterval(iv);
        g.textContent = final;
        g.classList.remove('is-decoding');
        delete g.dataset.decoding;
      }
    }, 55);
  }

  /* ────────── 面板扫描带（批次3-B：揭示时注入一条青色扫描线，动画结束自删）── */
  function spawnPanelScan(node) {
    if (U.reducedMotion()) return;
    var s = document.createElement('i');
    s.className = 'panel__scan';
    s.setAttribute('aria-hidden', 'true');
    node.appendChild(s);
    s.addEventListener('animationend', function () {
      if (s.parentNode) s.parentNode.removeChild(s);
    });
  }

  /* ────────── 入场揭示 ────────── */
  function initReveal() {
    var items = U.$$('[data-reveal]');
    if (!items.length) return;

    if (U.reducedMotion() || !root.IntersectionObserver) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    document.documentElement.classList.add('js-reveal');

    // 同一容器内的元素自动错峰
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var node = en.target;
        var delay = parseInt(node.dataset.revealDelay || '0', 10);
        if (!delay) {
          var sibs = U.$$('[data-reveal]', node.parentNode);
          var idx = sibs.indexOf(node);
          if (idx > 0) delay = Math.min(idx * 70, 420);
        }
        setTimeout(function () {
          node.classList.add('is-in');
          if (node.classList.contains('sect__title')) decodeTitle(node);
          else if (node.classList.contains('panel')) spawnPanelScan(node);
        }, delay);
        io.unobserve(node);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (n) { io.observe(n); });
  }

  /* ────────── 进度轨 ────────── */
  function updateProgress() {
    if (!fill) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - root.innerHeight;
    var p = max > 0 ? U.clamp(root.scrollY / max, 0, 1) : 0;
    fill.style.width = (p * 100).toFixed(2) + '%';
    fill.parentNode.setAttribute('aria-valuenow', Math.round(p * 100));
  }

  /* ────────── HUD 收起 / 展开 ────────── */
  function updateHud(y) {
    if (!hudTop) return;
    if (y > 320 && y > lastY + 4) hudTop.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 120) hudTop.classList.remove('is-hidden');
    lastY = y;
  }

  /* ────────── 区块侦测 ────────── */
  function initSections() {
    sections = U.$$('main .sect');
    if (!sections.length || !root.IntersectionObserver) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        U.bus.emit('section:change', en.target.id);
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ────────── 滚动监听（rAF 节流）────────── */
  function onScroll() {
    if (ticking) return;
    ticking = true;
    root.requestAnimationFrame(function () {
      var y = root.scrollY || 0;
      updateProgress();
      updateHud(y);
      ticking = false;
    });
  }

  /* ────────── 打印 / 导出 PDF（报告 D1：beforeprint 收尾）──────────
     Ctrl+P 与终端 resume（window.print）都会触发 beforeprint → preparePrint，
     两者走同一条路径；afterprint 精确恢复本次打印改动的状态。 */
  var printReveals = null, printRows = null;

  /** 打印前：未触发的揭示元素补 is-in、折叠的明细行补 is-open（幂等） */
  function preparePrint() {
    if (printReveals) return;   // 终端 resume 先调一次、beforeprint 再调一次：只生效一轮

    printReveals = [];
    U.$$('[data-reveal]').forEach(function (n) {
      if (!n.classList.contains('is-in')) {
        n.classList.add('is-in');
        printReveals.push(n);
      }
    });

    printRows = [];
    U.$$('.job-row').forEach(function (r) {
      if (r.classList.contains('is-open')) return;
      if (!r.querySelector('.job__body')) return;   // 奖项行没有可折叠明细
      r.classList.add('is-open');
      printRows.push(r);
      var head = r.querySelector('.job__head');
      if (head && head.tagName === 'BUTTON') head.setAttribute('aria-expanded', 'true');
    });

    /* 冻结打字机与随机故障，保证打印稿没有残句 / 故障位移 */
    if (!U.reducedMotion() && CYBER.glitch && CYBER.glitch.stop) CYBER.glitch.stop();
    U.bus.emit('print:freeze');
  }

  /** 打印后：只回滚本次打印改动的状态，用户自己的展开/揭示保持原样 */
  function restoreAfterPrint() {
    if (!printReveals) return;

    printReveals.forEach(function (n) { n.classList.remove('is-in'); });
    printRows.forEach(function (r) {
      r.classList.remove('is-open');
      var head = r.querySelector('.job__head');
      if (head && head.tagName === 'BUTTON') head.setAttribute('aria-expanded', 'false');
    });
    printReveals = null;
    printRows = null;

    if (!U.reducedMotion() && CYBER.glitch && CYBER.glitch.resume) CYBER.glitch.resume();
    U.bus.emit('print:resume');
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    fill = U.$('#scroll-fill');
    hudTop = U.$('#hud-top');

    initReveal();
    initSections();

    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('resize', U.throttle(onScroll, 200));
    onScroll();
    lastY = root.scrollY || 0;

    /* 打印 / 导出 PDF：beforeprint 补状态，afterprint 恢复 */
    root.addEventListener('beforeprint', preparePrint);
    root.addEventListener('afterprint', restoreAfterPrint);
  }

  /** 平滑滚动到区块（尊重 reduced-motion） */
  function goTo(id) {
    var target = document.getElementById(id);
    if (!target) return false;
    target.scrollIntoView({
      behavior: U.reducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
    return true;
  }

  CYBER.scroll = {
    init: init,
    goTo: goTo,
    sections: function () { return sections; },
    preparePrint: preparePrint,          // 终端 resume 复用同一打印路径（防御性直调）
    restoreAfterPrint: restoreAfterPrint
  };
  CYBER.register('scroll', { order: 110, init: init });
})(window);
