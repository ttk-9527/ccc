/* ═══════════════════════════════════════════════════════════════
   js/ui/hero.js — 01 STATUS
   HUD 品牌位、Hero 文案与身份卡、关于我九宫格、个人摘要
   全部内容都从 CYBER.data 读取，改内容不用碰这个文件
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var typeEl, typeIdx = 0, charIdx = 0, deleting = false, typeTimer = null, typingOn = false;
  var printFrozen = false;   // 打印期间打字机冻结在第一行完整文案（报告 D1）

  /* ══════════ 静态文案回填 ══════════ */
  function fillStatic() {
    var m = D.meta;

    /* 顶部 HUD 品牌 */
    var bn = U.$('#brand-name'), bs = U.$('#brand-sub');
    if (bn) bn.textContent = (m.brand && m.brand.name) || m.name;
    if (bs) bs.textContent = (m.brand && m.brand.sub) || m.titleEn;

    /* 引导行 */
    var eye = U.$('#eyebrow-meta');
    if (eye) eye.textContent = 'ID / ' + m.id + ' · ' + m.location;

    /* Hero 主标题：中文名更好看时用中文，否则用拉丁名 */
    var useCn = m.heroName === 'cn' && m.nameCn;
    var big = U.$('#hero-name');
    var sub = U.$('#hero-name-sub');
    if (big) {
      var txt = useCn ? m.nameCn : m.name;
      big.textContent = txt;
      big.setAttribute('data-text', txt);
      big.classList.toggle('hero__name--cn', !!useCn);
    }
    if (sub) sub.textContent = useCn ? m.name : (m.nameCn || '');

    var role = U.$('#hero-role'), roleEn = U.$('#hero-role-en');
    if (role) role.textContent = m.title;
    if (roleEn) roleEn.textContent = m.titleEn;

    /* 身份卡 */
    var no = U.$('#idcard-no');
    if (no) no.textContent = m.dossierNo;
    var st = U.$('#idcard-status');
    if (st) {
      var label = st.querySelector('span');
      if (label) label.textContent = m.availability || '—';
      st.classList.toggle('is-off', !m.availability);
    }

    /* 浏览器标题 */
    document.title = (m.nameCn || '').replace(/\s/g, '') + ' ' + m.name + ' — ' + m.title + ' // NIGHT CITY DOSSIER';
  }

  /* ══════════ 身份卡照片 / 姓名纹章 ══════════ */
  function renderPhoto() {
    var box = U.$('#idcard-photo');
    if (!box) return;
    U.clear(box);

    var src = D.meta.avatar;
    if (src) {
      var img = U.el('img', { src: src, alt: D.meta.nameCn + ' 的头像', decoding: 'async' });
      img.addEventListener('error', function () {
        box.classList.remove('has-photo');
        if (img.parentNode) img.parentNode.removeChild(img);
        box.insertBefore(monogram(), box.firstChild);
      });
      box.classList.add('has-photo');
      box.appendChild(img);
    } else {
      box.appendChild(monogram());
    }

    /* 扫描光带与 HUD 内框始终在最上层 */
    box.appendChild(U.el('span', { class: 'idcard__scan', 'aria-hidden': 'true' }));
    box.appendChild(U.el('span', { class: 'idcard__bracket', 'aria-hidden': 'true' }));
  }

  function monogram() {
    var ch = (D.meta.nameCn || D.meta.name || '?').replace(/\s/g, '').charAt(0);
    return U.el('span', { class: 'idcard__monogram', 'aria-hidden': 'true' }, [
      ch,
      U.el('small', { class: 'owner-hint', text: 'AVATAR PENDING · 填 meta.avatar 即启用照片' })
    ]);
  }

  /* ══════════ 数据条（数字滚动）══════════ */
  /* 数字节点只保存在渲染层局部数组，不回写 D.stats（保持数据层纯数据、可序列化） */
  var statNodes = [];
  function renderStats() {
    var box = U.$('#hero-stats');
    if (!box || !D.stats) return;
    U.clear(box);
    statNodes = [];

    D.stats.forEach(function (s) {
      /* 极长值（≥12 字）才降档：全宽数据带下院校全称 10 字已能同字号单行放下 */
      var longVal = String(s.v == null ? '' : s.v).length >= 12;
      var num = U.el('b', { class: longVal ? 'stat__v stat__v--long' : 'stat__v', text: '0' });
      box.appendChild(U.el('li', { class: 'stat' }, [
        U.el('span', { class: 'stat__k', text: s.k }),
        U.el('span', {}, [num, U.el('span', { class: 'stat__u', text: s.u || '' })])
      ]));
      statNodes.push(num);
    });

    U.bus.on('hero:reveal', function () {
      D.stats.forEach(function (s, i) {
        var node = statNodes[i];
        if (!node) return;
        var target = parseFloat(s.v);
        /* 非数字（如身份/院校/专业这类文字）直接显示，不做滚动 */
        if (isNaN(target)) {
          node.textContent = String(s.v);
          return;
        }
        var isFloat = String(s.v).indexOf('.') > -1;
        var rollTween = function () {
          setTimeout(function () {
            U.tween({
              from: 0, to: target, duration: 900 + i * 90, ease: U.easeOutExpo,
              onUpdate: function (v) {
                node.textContent = isFloat ? v.toFixed(1) : Math.round(v);
              }
            });
          }, i * 80);
        };
        /* Quick Win #4：老虎机乱码翻牌前缀（reduced-motion 直接落数） */
        if (U.reducedMotion()) { rollTween(); return; }
        var digits = String(s.v).length;
        var scr = setInterval(function () {
          var out = '';
          for (var k = 0; k < digits; k++) out += '0123456789<>/\\'.charAt((Math.random() * 12) | 0);
          node.textContent = out;
        }, 45);
        setTimeout(function () { clearInterval(scr); rollTween(); }, 200);
      });
    });
  }

  /* ══════════ 身份卡字段 ══════════ */
  function renderIdcard() {
    var box = U.$('#idcard-rows');
    if (!box || !D.idcard) return;
    U.clear(box);
    D.idcard.forEach(function (row) {
      box.appendChild(U.el('div', {}, [
        U.el('dt', { text: row.k }),
        U.el('dd', { text: row.v })
      ]));
    });
  }

  /* ══════════ 关于我 · 九宫格 ══════════ */
  function renderProfile() {
    var box = U.$('#profile-grid');
    if (!box || !D.profile) return;
    U.clear(box);

    D.profile.forEach(function (item) {
      /* 值：可跳转 / 纯文本 */
      var valueNode = item.href
        ? U.el('a', {
            class: 'profile-card__v', href: item.href,
            target: '_blank', rel: 'noopener noreferrer', text: item.v
          })
        : U.el('span', { class: 'profile-card__v', text: item.v });

      var children = [
        U.el('span', { class: 'profile-card__ico', text: item.ico, 'aria-hidden': 'true' }),
        U.el('span', { class: 'profile-card__body' }, [
          U.el('span', { class: 'profile-card__k', text: item.k }),
          valueNode
        ])
      ];

      if (item.copy) {
        var btn = U.el('button', {
          class: 'profile-card__copy', type: 'button',
          'aria-label': '复制' + item.k,
          html: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
                '<rect x="3.2" y="3.2" width="7" height="7" stroke="currentColor" stroke-width="1.2"/>' +
                '<path d="M1.6 8V1.6H8" stroke="currentColor" stroke-width="1.2"/></svg>'
        });
        btn.addEventListener('click', function () {
          U.copyText(item.v).then(function () {
            btn.classList.add('is-done');
            CYBER.sound.play('confirm');
            CYBER.toast.ok(item.k + ' 已复制到剪贴板', { key: 'COPY' });
            setTimeout(function () { btn.classList.remove('is-done'); }, 1700);
          }).catch(function () {
            CYBER.sound.play('error');
            CYBER.toast.err('复制失败，请手动选取', { key: 'COPY' });
          });
        });
        children.push(btn);
      } else {
        /* 占位，保证三列栅格对齐 */
        children.push(U.el('span', { 'aria-hidden': 'true' }));
      }

      box.appendChild(U.el('li', { class: 'profile-card' }, children));
    });
  }

  /* ══════════ 个人摘要 ══════════ */
  function renderBrief() {
    var box = U.$('#profile-brief');
    if (!box || !D.summary) return;
    U.clear(box);
    D.summary.forEach(function (p) { box.appendChild(U.el('p', { text: p })); });
  }

  /* ══════════ 打字机 ══════════ */
  function typeStep() {
    if (!typeEl) return;
    /* F1：typeLines 为空/缺失时静默停机，避免 % 0 = NaN 在定时器里抛错 */
    if (!D.typeLines || !D.typeLines.length) return;
    var line = D.typeLines[typeIdx % D.typeLines.length];
    var delay = 52;

    if (!deleting) {
      charIdx++;
      typeEl.textContent = line.slice(0, charIdx);
      if (charIdx % 4 === 0) CYBER.sound.play('type');
      if (charIdx >= line.length) {
        deleting = true;
        delay = 2000;
      } else {
        delay = 40 + Math.random() * 46;
      }
    } else {
      charIdx -= 2;
      if (charIdx <= 0) {
        charIdx = 0;
        deleting = false;
        typeIdx++;
        typeEl.textContent = '';
        /* 批次3-E：新句先来一段 260ms 乱码解码，再逐字打出（reduced-motion 不进此分支） */
        var newLine = D.typeLines[typeIdx % D.typeLines.length];
        var scr = setInterval(function () {
          var out = '';
          for (var k = 0; k < newLine.length; k++) {
            var cch = newLine.charAt(k);
            out += (cch === ' ') ? ' ' : '▓▒░<>/\\=+*#01'.charAt((Math.random() * 14) | 0);
          }
          typeEl.textContent = out;
        }, 45);
        setTimeout(function () {
          clearInterval(scr);
          if (!typingOn) return;          // 打印冻结/手动停止则不再续排
          typeEl.textContent = '';
          typeTimer = setTimeout(typeStep, 80);
        }, 260);
        return;                            // 跳过外层 typeTimer 重排
      } else {
        typeEl.textContent = line.slice(0, charIdx);
        delay = 18;
      }
    }
    typeTimer = setTimeout(typeStep, delay);
  }

  function startTyping() {
    if (typingOn || !typeEl || printFrozen) return;   // 打印期间不启动/不续打
    if (!D.typeLines || !D.typeLines.length) return;  // F1：空轮播不启动
    typingOn = true;
    if (U.reducedMotion()) { typeEl.textContent = D.typeLines[0]; return; }
    typeTimer = setTimeout(typeStep, 400);
  }
  function stopTyping() { typingOn = false; clearTimeout(typeTimer); }

  /* ══════════ 初始化 ══════════ */
  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    typeEl = U.$('#hero-type');

    fillStatic();
    renderPhoto();
    renderStats();
    renderIdcard();
    renderProfile();
    renderBrief();

    /* 首屏揭示 → 数字滚动 */
    var statRow = U.$('#status .stat-row');
    if (statRow && root.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { U.bus.emit('hero:reveal'); io.disconnect(); }
        });
      }, { threshold: 0.3 });
      io.observe(statRow);
    } else {
      U.bus.emit('hero:reveal');
    }

    /* 等启动序列结束再开始打字 */
    var started = false;
    U.bus.on('boot:done', function () {
      if (started) return;
      started = true;
      setTimeout(startTyping, 340);
    });
    setTimeout(function () { if (!started) { started = true; startTyping(); } }, 6000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTyping();
      else if (started && !typingOn) startTyping();
    });

    /* 打印 / 导出 PDF（报告 D1）：停在第一行完整文案，打印结束后恢复轮播。
       即使打字机尚未启动（首访 boot 未完成），打印稿也会有完整的首行文案。 */
    U.bus.on('print:freeze', function () {
      if (printFrozen) return;
      printFrozen = true;
      stopTyping();
      if (typeEl && D.typeLines && D.typeLines.length) typeEl.textContent = D.typeLines[0];
    });
    U.bus.on('print:resume', function () {
      if (!printFrozen) return;
      printFrozen = false;
      if (started && !typingOn) startTyping();
    });
  }

  CYBER.hero = { init: init };
  CYBER.register('hero', { order: 50, init: init });
})(window);
