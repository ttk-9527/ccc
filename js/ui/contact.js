/* ═══════════════════════════════════════════════════════════════
   js/ui/contact.js — 05 CONTACT：频道复制 + 表单校验与发送
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var form, hint;
  var MAX_MSG = 600;

  /* ────────── 直达频道 ────────── */
  function renderChannels() {
    var box = U.$('#copy-list');
    if (!box) return;
    var C = D.contact || {};   // F1：contact 缺失按空对象降级，频道行由 r.v 判空自动跳过

    var rows = [
      { ico: '@',   k: 'EMAIL',    v: C.email,    raw: C.email },
      { ico: 'TEL', k: 'PHONE',    v: C.phone,    raw: C.phone },
      { ico: 'GH',  k: 'GITHUB',   v: C.github,   raw: 'https://' + C.github, href: 'https://' + C.github },
      { ico: 'WX',  k: 'WECHAT',   v: C.wechat,   raw: C.wechat },
      { ico: 'LOC', k: 'LOCATION', v: C.location, raw: C.location }
    ].filter(function (r) { return r.v; });

    rows.forEach(function (r) {
      var btn = U.el('button', {
        class: 'copy-item__btn', type: 'button',
        'aria-label': '复制 ' + r.k,
        text: '复制'
      });
      btn.addEventListener('click', function () {
        U.copyText(r.raw).then(function () {
          btn.textContent = '已复制 ✓';
          CYBER.sound.play('confirm');
          CYBER.toast.ok(r.k + ' 已复制', { key: 'COPY' });
          setTimeout(function () { btn.textContent = '复制'; }, 1700);
        }).catch(function () {
          CYBER.sound.play('error');
          CYBER.toast.err('复制失败，请手动选取', { key: 'COPY' });
        });
      });

      var valueNode = r.href
        ? U.el('a', { class: 'copy-item__v', href: r.href, target: '_blank', rel: 'noopener noreferrer', text: r.v })
        : U.el('span', { class: 'copy-item__v', text: r.v });

      box.appendChild(U.el('li', { class: 'copy-item' }, [
        U.el('span', { class: 'copy-item__ico', text: r.ico, 'aria-hidden': 'true' }),
        U.el('span', {}, [
          U.el('span', { class: 'copy-item__k', text: r.k }),
          valueNode
        ]),
        btn
      ]));
    });
  }

  /* ────────── 校验规则 ────────── */
  var RULES = {
    name: function (v) {
      if (!v.trim()) return '请填写称呼';
      if (v.trim().length < 2) return '至少 2 个字符';
      return '';
    },
    email: function (v) {
      if (!v.trim()) return '请填写邮箱，否则我无法回信';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return '邮箱格式看起来不对，请检查';
      return '';
    },
    message: function (v) {
      if (!v.trim()) return '请简单描述一下岗位或项目';
      if (v.trim().length < 10) return '再多写几个字吧（至少 10 字）';
      if (v.length > MAX_MSG) return '超出 ' + MAX_MSG + ' 字上限，当前 ' + v.length + ' 字';
      return '';
    }
  };

  function fieldOf(input) { return input.closest('.field'); }

  function setError(input, msg) {
    var field = fieldOf(input);
    if (!field) return;
    var err = U.$('.field__err', field);
    field.classList.toggle('has-error', !!msg);
    if (err) err.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  function validateOne(input) {
    var rule = RULES[input.name];
    if (!rule) return true;
    return setError(input, rule(input.value));
  }

  function validateAll() {
    var ok = true;
    ['name', 'email', 'message'].forEach(function (n) {
      var input = form.elements[n];
      if (!input) return;
      if (!validateOne(input)) ok = false;
    });
    return ok;
  }

  /* ────────── 发送 ────────── */
  function buildMailto(vals) {
    var subject = '[简历联络] 来自 ' + vals.name;
    var body = '称呼：' + vals.name + '\n'
             + '邮箱：' + vals.email + '\n\n'
             + vals.message + '\n';
    var to = (D.contact && D.contact.email) || '';   // F1：contact 缺失不抛错
    return 'mailto:' + to
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
  }

  function send() {
    var vals = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim()
    };

    var btn = U.$('#cf-submit');
    var label = U.$('.btn__label', btn);
    var original = label.textContent;

    btn.disabled = true;
    label.textContent = '传输中';
    hint.textContent = '正在建立加密链路…';
    CYBER.sound.play('open');

    var steps = [0, 26, 58, 82, 100];
    var i = 0;
    var timer = setInterval(function () {
      var p = steps[Math.min(i, steps.length - 1)];
      hint.textContent = '传输中 … ' + p + '%';
      if (p >= 100) {
        clearInterval(timer);
        finish(vals, btn, label, original);
      }
      i++;
    }, U.reducedMotion() ? 20 : 210);
  }

  function finish(vals, btn, label, original) {
    btn.disabled = false;
    label.textContent = original;
    hint.textContent = '已唤起邮件客户端；若未自动打开，可直接复制上方邮箱。';
    U.bus.emit('bg:glitch');
    CYBER.sound.play('confirm');
    CYBER.toast.ok('讯息已封装，正在唤起你的邮件客户端', { key: 'SENT', ms: 4200 });

    try { root.location.href = buildMailto(vals); } catch (e) { /* 忽略 */ }
  }

  /* ────────── 初始化 ────────── */
  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    renderChannels();

    form = U.$('#contact-form');
    if (!form) return;
    hint = U.$('#form-hint');

    var msg = form.elements.message;
    var counter = U.$('#cf-count');

    /* 实时校验 */
    ['name', 'email', 'message'].forEach(function (n) {
      var input = form.elements[n];
      if (!input) return;
      input.addEventListener('blur', function () { validateOne(input); });
      input.addEventListener('input', function () {
        var field = fieldOf(input);
        if (field && field.classList.contains('has-error')) validateOne(input);
      });
      input.addEventListener('focus', function () { CYBER.sound.play('scan'); });
    });

    /* 字数统计 + 上限保护 */
    if (msg && counter) {
      var sync = function () {
        counter.textContent = String(msg.value.length);
        if (msg.value.length >= MAX_MSG) {
          msg.value = msg.value.slice(0, MAX_MSG);
          counter.textContent = String(MAX_MSG);
        }
      };
      msg.addEventListener('input', sync);
      sync();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateAll()) {
        CYBER.sound.play('error');
        CYBER.toast.err('表单还有未通过校验的字段', { key: 'VALIDATE' });
        var bad = U.$('.field.has-error .field__input', form);
        if (bad) bad.focus();
        return;
      }
      CYBER.sound.play('click');
      send();
    });
  }

  CYBER.contact = { init: init };
  CYBER.register('contact', { order: 90, init: init });
})(window);
