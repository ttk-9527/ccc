/* ═══════════════════════════════════════════════════════════════
   js/core/toast.js — HUD 通知
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var stack = null;
  var MAX = 4;

  function mount() {
    stack = U.$('#toast-stack');
    return stack;
  }

  /**
   * @param {string} msg   正文
   * @param {object} [opt] { kind:'info'|'ok'|'err'|'warn', key:'标签', ms:毫秒 }
   */
  function show(msg, opt) {
    opt = opt || {};
    if (!stack && !mount()) return;

    // 超出上限先移除最早的
    while (stack.children.length >= MAX) stack.removeChild(stack.firstChild);

    var kind = opt.kind || 'info';
    var keyMap = { info: 'SYS', ok: 'OK', err: 'ERR', warn: 'WARN' };

    var node = U.el('div', { class: 'toast toast--' + kind, role: 'status' }, [
      U.el('span', { class: 'toast__k', text: opt.key || keyMap[kind] || 'SYS' }),
      U.el('span', { class: 'toast__m', text: msg })
    ]);
    stack.appendChild(node);

    var ms = opt.ms || 2600;
    var timer = setTimeout(function () {
      node.classList.add('is-out');
      node.addEventListener('animationend', function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, { once: true });
    }, ms);

    // 点击可提前关闭
    node.addEventListener('click', function () {
      clearTimeout(timer);
      node.classList.add('is-out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
    });

    return node;
  }

  CYBER.toast = {
    show: show,
    ok:   function (m, o) { return show(m, Object.assign({ kind: 'ok' }, o)); },
    err:  function (m, o) { return show(m, Object.assign({ kind: 'err' }, o)); },
    warn: function (m, o) { return show(m, Object.assign({ kind: 'warn' }, o)); }
  };
})(window);
