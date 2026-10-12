/* ═══════════════════════════════════════════════════════════════
   js/ui/boot.js — 启动序列
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var LINES = [
    { t: '> NIGHT CITY NET — DOSSIER TERMINAL v' + CYBER.VERSION, cls: 'hl' },
    { t: '> 建立安全链路 ................ OK', cls: 'ok' },
    { t: '> 解密档案 [LIN_MO.dossier] .... OK', cls: 'ok' },
    { t: '> 载入视觉模块 / CANVAS ....... OK', cls: 'ok' },
    { t: '> 校准 HUD 叠加层 ............. OK', cls: 'ok' },
    { t: '> 挂载数据源 resume.js ........ OK', cls: 'ok' },
    { t: '> 校验访问权限 ............... GRANTED', cls: 'hl' },
    { t: '> 欢迎回来，经纪人。', cls: '' }
  ];

  var overlay, logEl, barEl, pctEl, enterBtn, progEl;
  var done = false, timers = [], typed = 0, inited = false;
  var totalChars = LINES.reduce(function (a, l) { return a + l.t.length; }, 0);

  var SESSION_KEY = 'cyber:booted';

  function setProgress(ratio) {
    var p = U.clamp(ratio, 0, 1);
    if (barEl) barEl.style.width = (p * 100).toFixed(1) + '%';
    if (pctEl) pctEl.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    if (progEl) progEl.setAttribute('aria-valuenow', Math.round(p * 100));
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /** 立即把日志补全 */
  function finishTyping() {
    clearTimers();
    U.clear(logEl);
    LINES.forEach(function (l) {
      var p = document.createElement('div');
      p.className = l.cls;
      p.textContent = l.t;
      logEl.appendChild(p);
    });
    setProgress(1);
    typed = totalChars;
    onTypingEnd();
  }

  function onTypingEnd() {
    if (enterBtn) enterBtn.hidden = false;
    announce('档案载入完成，按任意键或点击「接入档案」继续。');   // D3：完成态一次性播报
    U.bus.emit('boot:typed');
  }

  /** D3：进度/完成态走 role=status 的 sr-only 元素，日志本体不再逐字播报 */
  function announce(msg) {
    var status = U.$('#boot-status');
    if (status) status.textContent = msg;
  }

  /** D3：启动序列期间给背景内容加 inert（现代浏览器）与 aria-hidden（旧浏览器兜底），
      读屏与 Tab 焦点不穿透遮罩；dismiss() 时先移除再交还焦点 */
  function setBackgroundInert(on) {
    ['header', 'main', 'footer'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }

  /** 逐字打印 */
  function typeAll() {
    var li = 0, ci = 0, lineNode = null;
    var speed = U.reducedMotion() ? 0 : 11;

    function step() {
      if (li >= LINES.length) { onTypingEnd(); return; }

      if (!lineNode) {
        lineNode = document.createElement('div');
        lineNode.className = LINES[li].cls;
        logEl.appendChild(lineNode);
      }

      var full = LINES[li].t;
      if (ci <= full.length) {
        lineNode.textContent = full.slice(0, ci);
        ci++;
        typed++;
        setProgress(typed / totalChars);
        if (speed && ci % 3 === 0) CYBER.sound.play('type');
        timers.push(setTimeout(step, speed + (Math.random() * 9 | 0)));
      } else {
        li++; ci = 0; lineNode = null;
        timers.push(setTimeout(step, speed ? 90 : 0));
      }
    }
    step();
  }

  function dismiss() {
    if (done) return;
    done = true;
    clearTimers();
    setBackgroundInert(false);   // D3：先解除背景 inert，焦点才能落回 main
    overlay.classList.add('is-done');
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    CYBER.sound.play('confirm');
    U.bus.emit('boot:done');
    timers.push(setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 700));
    /* 焦点交还页面。
       注意不要 focus 到 <a href="#…">：那样用户再按一次 Enter 会直接跳区块
       （链接的 Enter 激活是默认行为，遮罩已关闭后没人再 preventDefault）。
       标准做法是把焦点移到主内容容器上。 */
    var main = U.$('#main');
    if (main && main.focus) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }

  function alreadyBooted() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  function init() {
    if (inited) return;   // init 幂等：重复调用不再重复绑定/重复渲染
    inited = true;

    overlay = U.$('#boot');
    if (!overlay) return;

    logEl   = U.$('#boot-log');
    barEl   = U.$('#boot-bar-fill');
    pctEl   = U.$('#boot-pct');
    enterBtn= U.$('#boot-enter');
    progEl  = U.$('#boot-progress');

    /* 面板版本号回填（版本唯一定义在 utils.js 的 CYBER.VERSION） */
    var verEl = U.$('.boot__ver');
    if (verEl) verEl.textContent = 'DOSSIER TERMINAL v' + CYBER.VERSION;

    // 同一次会话内已看过，直接跳过（避免刷新被重复打断）
    if (alreadyBooted()) {
      overlay.parentNode && overlay.parentNode.removeChild(overlay);
      done = true;
      // 延后到宏任务：确保整个同步 bootAll 跑完、所有 boot:done 订阅者已就位
      setTimeout(function () { U.bus.emit('boot:done'); }, 0);
      return;
    }

    /* D3：日志区静默打字（HTML 已 aria-live=off，此处运行时兜底）；
       背景 header/main/footer 置 inert，焦点与读屏不穿透遮罩；开始时一次状态播报 */
    if (logEl) logEl.setAttribute('aria-live', 'off');
    setBackgroundInert(true);
    announce('正在载入档案…');

    setProgress(0);
    CYBER.sound.play('boot');

    var startAt = Date.now();

    // 第一条日志缓冲一下再开始
    timers.push(setTimeout(typeAll, U.reducedMotion() ? 0 : 260));

    // 期间任意输入 → 直接补全
    function skipHandler(e) {
      if (done) return;
      if (e && e.type === 'keydown' && (e.key === 'Tab')) return; // 保留 Tab 无障碍
      if (typed < totalChars) { finishTyping(); }
      else { dismiss(); }
    }

    root.addEventListener('keydown', function (e) {
      if (done) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        skipHandler(e);
        return;
      }
      if (e.key === 'Tab') return;
      skipHandler(e);
    });

    root.addEventListener('pointerdown', function (e) {
      if (done) return;
      if (Date.now() - startAt < 220) return;   // 防止误触
      skipHandler(e);
    });

    enterBtn.addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
  }

  CYBER.boot = { init: init, dismiss: dismiss };
  CYBER.register('boot', { order: 10, init: init });
})(window);
