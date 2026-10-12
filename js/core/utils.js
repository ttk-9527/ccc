/* ═══════════════════════════════════════════════════════════════
   js/core/utils.js — DOM 助手 / 事件总线 / 帧循环 / 数学工具
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var CYBER = root.CYBER = root.CYBER || {};

  /* 版本号唯一定义处：JS 文案统一引用；index.html 两处静态文案由 boot/terminal 回填 */
  CYBER.VERSION = '2.077';

  /* ────────── DOM ────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /** 创建元素：el('div', {class:'x', html:'…'}, [child…]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /** 转义，防止数据里的 & < > 破坏结构 */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 允许白名单标签（仅用于跑马灯里的 <b>/<i>） */
  function escLite(str) {
    return esc(str).replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>');
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* ────────── 事件总线 ────────── */
  var bus = {
    _map: {},
    on: function (evt, fn) {
      (this._map[evt] = this._map[evt] || []).push(fn);
      return function () { bus.off(evt, fn); };
    },
    off: function (evt, fn) {
      var list = this._map[evt]; if (!list) return;
      var i = list.indexOf(fn); if (i > -1) list.splice(i, 1);
    },
    emit: function (evt, payload) {
      (this._map[evt] || []).slice().forEach(function (fn) {
        try { fn(payload); } catch (e) { /* 单个订阅者出错不影响其他 */ console.error('[bus]', evt, e); }
      });
    }
  };

  /* ────────── 数学 / 缓动 ────────── */
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  /** 帧率无关的指数趋近插值 */
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /** 可复现随机（保证天际线等程序化图形刷新后一致） */
  function seeded(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ────────── 节流 / 防抖 ────────── */
  function throttle(fn, wait) {
    var last = 0, timer = null, lastArgs;
    return function () {
      var now = Date.now(), args = arguments;
      lastArgs = args;
      if (now - last >= wait) { last = now; fn.apply(this, args); }
      else if (!timer) {
        timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(this, lastArgs); }, wait - (now - last));
      }
    };
  }
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  /* ────────── 环境 ────────── */
  var mqReduce = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(mqReduce && mqReduce.matches); }

  var mqFine = root.matchMedia ? root.matchMedia('(hover: hover) and (pointer: fine)') : null;
  function finePointer() { return !!(mqFine && mqFine.matches); }

  var mqMobile = root.matchMedia ? root.matchMedia('(max-width: 760px)') : null;
  function isMobile() { return !!(mqMobile && mqMobile.matches); }

  /* ────────── 帧循环（单例，帧率无关）────────── */
  var loop = (function () {
    var subs = {}, running = false, last = 0, raf = 0;

    function frame(now) {
      raf = root.requestAnimationFrame(frame);
      var dt = (now - last) / 1000;
      last = now;
      if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
      dt = clamp(dt, 0.001, 0.05);              // 钳制，切后台回来不跳帧
      Object.keys(subs).forEach(function (id) {
        try { subs[id](dt, now); } catch (e) { console.error('[loop]', id, e); }
      });
    }
    function start() {
      if (running) return;
      running = true; last = root.performance ? performance.now() : Date.now();
      raf = root.requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    return {
      add: function (id, fn) { subs[id] = fn; start(); return id; },
      remove: function (id) { delete subs[id]; if (!Object.keys(subs).length) stop(); },
      start: start,
      stop: stop
    };
  })();

  /* 页面不可见时自动暂停所有动画，省电省 CPU */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) loop.stop(); else loop.start();
  });

  /* ────────── 一次性入场动画 ────────── */
  function tween(opts) {
    var from = opts.from == null ? 0 : opts.from;
    var to = opts.to == null ? 1 : opts.to;
    var dur = opts.duration || 600;
    var ease = opts.ease || easeOutCubic;
    var id = 'tween-' + Math.random().toString(36).slice(2);
    var t0 = null;

    if (reducedMotion()) { opts.onUpdate && opts.onUpdate(to); opts.onDone && opts.onDone(); return function () {}; }

    loop.add(id, function (dt, now) {
      if (t0 === null) t0 = now;
      var p = clamp((now - t0) / dur, 0, 1);
      var v = lerp(from, to, ease(p));
      opts.onUpdate && opts.onUpdate(v);
      if (p >= 1) { loop.remove(id); opts.onDone && opts.onDone(); }
    });
    return function () { loop.remove(id); };
  }

  /* ────────── 剪贴板 ────────── */
  function copyText(text) {
    if (navigator.clipboard && root.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = el('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' } });
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand 失败'));
      } catch (e) { reject(e); }
    });
  }

  /* ────────── 数据缺失时的占位块 ──────────
     宁可显式告诉用户「这里还没有数据」，也不编造内容 */
  function emptyState(cfg) {
    var node = el('div', { class: 'empty-state', role: 'note' }, [
      el('span', { class: 'empty-state__code', text: cfg.code || 'DATA MISSING' }),
      el('h3', { class: 'empty-state__title', text: cfg.title || '暂无数据' })
    ]);
    /* 站长向的填法说明与代码示例包进 .owner-hint：访客视图只看到封存状态，
       URL 加 ?edit=1（html.edit-mode）时才展开，避免把开发提示展示给访客 */
    var owner = el('div', { class: 'empty-state__owner owner-hint' }, [
      el('p', { class: 'empty-state__desc', html: cfg.desc || '' })
    ]);
    if (cfg.snippet) {
      owner.appendChild(el('pre', { class: 'empty-state__snippet', text: cfg.snippet }));
    }
    node.appendChild(owner);
    return node;
  }

  /* ────────── 颜色（背景引擎与雷达图共用，全仓只此一份实现）────────── */
  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** hex + alpha → 'rgba(r,g,b,a)' 字符串 */
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ── 对外 ── */
  CYBER.utils = {
    $: $, $$: $$, el: el, esc: esc, escLite: escLite, clear: clear,
    bus: bus,
    hexToRgb: hexToRgb, rgba: rgba,
    clamp: clamp, lerp: lerp, rand: rand, damp: damp,
    easeOutCubic: easeOutCubic, easeOutExpo: easeOutExpo, easeInOutQuad: easeInOutQuad,
    seeded: seeded, throttle: throttle, debounce: debounce,
    reducedMotion: reducedMotion, finePointer: finePointer, isMobile: isMobile, loop: loop, tween: tween,
    copyText: copyText, emptyState: emptyState
  };
})(window);
