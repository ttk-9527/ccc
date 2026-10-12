/* ═══════════════════════════════════════════════════════════════
   js/ui/nav.js — HUD 导航 / 主题与音效开关 / 时钟 / 跑马灯
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var nav, ink, burger, clockEl, soundBtn, soundIco, accentBtn, accentDot, termBtn;
  var ACCENTS = ['yellow', 'cyan', 'red'];
  var ACCENT_KEY = 'cyber:accent';
  var items = [];

  /* ────────── 导航高亮 ────────── */
  function setActive(id) {
    var found = null;
    items.forEach(function (a) {
      var on = a.dataset.nav === id;
      a.classList.toggle('is-active', on);
      if (on) found = a;
      a.setAttribute('aria-current', on ? 'true' : 'false');
    });
    moveInk(found);
  }

  function moveInk(target) {
    if (!ink || !target || !nav) return;
    var nr = nav.getBoundingClientRect();
    var ar = target.getBoundingClientRect();
    ink.style.width = ar.width + 'px';
    ink.style.transform = 'translateX(' + (ar.left - nr.left) + 'px)';
  }

  /* ────────── 移动端抽屉 ────────── */
  function setDrawer(open) {
    if (!nav || !burger) return;
    var wasOpen = nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? '收起导航' : '展开导航');
    /* D4：关闭抽屉时若焦点仍在抽屉内的链接上，收回焦点到汉堡按钮，
       避免焦点停留在 visibility:hidden 的区域（Esc / 外点 / 点链接三条路径统一经过这里） */
    if (wasOpen && !open && nav.contains(document.activeElement)) burger.focus();
  }

  /* ────────── 主题色 ────────── */
  function applyAccent(name, opts) {
    if (ACCENTS.indexOf(name) === -1) name = 'yellow';
    document.documentElement.setAttribute('data-accent', name);
    if (accentDot) accentDot.style.background = 'var(--accent)';
    try { localStorage.setItem(ACCENT_KEY, name); } catch (e) {}
    U.bus.emit('accent:change', name);
    if (opts && opts.silent) return name;
    CYBER.sound.play('toggle');
    var label = { yellow: '赛博黄', cyan: '电光青', red: '警报红' }[name];
    CYBER.toast.show('主题配色已切换 → ' + label, { key: 'THEME' });
    return name;
  }

  function cycleAccent() {
    var cur = document.documentElement.getAttribute('data-accent') || 'yellow';
    return applyAccent(ACCENTS[(ACCENTS.indexOf(cur) + 1) % ACCENTS.length]);
  }

  /* ────────── 音效开关 ────────── */
  function syncSoundUI(on) {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? '关闭音效' : '开启音效');
    if (soundIco) soundIco.textContent = on ? 'ON' : 'OFF';
  }

  function toggleSound() {
    var on = CYBER.sound.toggle();
    syncSoundUI(on);
    CYBER.toast.show(on ? '音效已开启 — 所有音色由 WebAudio 实时合成' : '音效已静音',
      { key: 'AUDIO', kind: on ? 'ok' : 'info' });
  }

  /* ────────── 时钟 ────────── */
  function tickClock() {
    if (!clockEl) return;
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    clockEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* ────────── 跑马灯 ────────── */
  function buildTicker() {
    var track = U.$('#ticker-track');
    if (!track || !D.ticker) return;
    var one = D.ticker.map(function (t) {
      return '<span>' + U.escLite(t) + '</span>';
    }).join('');
    track.innerHTML = one + one;   // 两份，配合 -50% 位移实现无缝
    track.style.animationDuration = Math.max(24, D.ticker.length * 5.6) + 's';
  }

  /* ────────── 事件绑定 ────────── */
  function bind() {
    /* 导航点击：平滑滚动 + 更新 hash */
    items.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.dataset.nav;
        if (!id) return;
        e.preventDefault();
        CYBER.sound.play('click');
        /* 单向 UI → core 直调：模块缺失时降级，不抛运行期 TypeError */
        if (CYBER.scroll && CYBER.scroll.goTo) CYBER.scroll.goTo(id);
        /* file://（Chrome）下 replaceState 会抛 SecurityError，降级为不改写地址栏 */
        try { history.replaceState(null, '', '#' + id); } catch (err) { /* 忽略 */ }
        setDrawer(false);
        setActive(id);
      });
      a.addEventListener('pointerenter', function () { CYBER.sound.play('hover'); });
    });

    /* 抽屉 */
    if (burger) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') !== 'true';
        CYBER.sound.play(open ? 'open' : 'close');
        setDrawer(open);
      });
    }

    /* 品牌 / 首屏按钮 */
    U.$$('[data-sfx]').forEach(function (n) {
      n.addEventListener('pointerenter', function () { CYBER.sound.play('hover'); });
      n.addEventListener('click', function () { CYBER.sound.play('click'); });
    });

    /* 工具按钮 */
    if (accentBtn) accentBtn.addEventListener('click', cycleAccent);
    if (soundBtn) soundBtn.addEventListener('click', toggleSound);
    if (termBtn) termBtn.addEventListener('click', function () { U.bus.emit('term:open'); });

    /* 首次点击页面即解锁音频（浏览器策略） */
    document.addEventListener('pointerdown', function once() {
      CYBER.sound.play('scan');
      document.removeEventListener('pointerdown', once);
    }, { once: true });

    /* 键盘快捷键 */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= '1' && e.key <= '5') {
        var target = items[parseInt(e.key, 10) - 1];
        if (target) { e.preventDefault(); target.click(); }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault(); cycleAccent();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault(); toggleSound();
      } else if (e.key === 'Escape') {
        setDrawer(false);
      }
    });

    /* 区块变化 */
    U.bus.on('section:change', function (id) { if (id) setActive(id); });

    /* 窗口尺寸变化时重算游标 */
    root.addEventListener('resize', U.throttle(function () {
      var cur = U.$('.hud-nav__item.is-active');
      moveInk(cur);
    }, 150));

    /* 音效状态同步 */
    U.bus.on('sound:change', syncSoundUI);

    /* 导航外点击关闭抽屉 */
    document.addEventListener('pointerdown', function (e) {
      if (!nav || !burger) return;
      if (nav.classList.contains('is-open') &&
          !nav.contains(e.target) && !burger.contains(e.target)) {
        setDrawer(false);
      }
    }, { passive: true });
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    nav      = U.$('#hud-nav');
    ink      = U.$('#hud-nav-ink');
    burger   = U.$('#hud-burger');
    clockEl  = U.$('#hud-clock');
    soundBtn = U.$('#sound-btn');
    soundIco = U.$('#sound-ico');
    accentBtn= U.$('#accent-btn');
    accentDot= U.$('#accent-dot');
    termBtn  = U.$('#terminal-btn');
    items    = U.$$('.hud-nav__item');

    /* 恢复上次主题 */
    var saved = null;
    try { saved = localStorage.getItem(ACCENT_KEY); } catch (e) {}
    applyAccent(saved && ACCENTS.indexOf(saved) > -1 ? saved : 'yellow', { silent: true });

    syncSoundUI(CYBER.sound.isEnabled());
    buildTicker();
    tickClock();
    setInterval(tickClock, 1000);

    bind();

    /* 等字体与布局稳定后再定位游标 */
    var reposition = function () {
      var cur = U.$('.hud-nav__item.is-active') || items[0];
      moveInk(cur);
    };
    root.addEventListener('load', reposition);
    setTimeout(reposition, 120);
    setTimeout(reposition, 700);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposition);
  }

  CYBER.nav = { init: init, setActive: setActive, applyAccent: applyAccent, cycleAccent: cycleAccent };
  CYBER.register('nav', { order: 40, init: init });
})(window);
