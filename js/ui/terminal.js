/* ═══════════════════════════════════════════════════════════════
   js/ui/terminal.js — 命令终端（Ctrl/⌘ + K）
   支持：Tab 补全、↑↓ 历史、Esc 关闭、别名
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var wrap, out, form, input, opened = false, ready = false;
  var history = [], hIndex = -1;
  var lastFocus = null;

  /* ────────── 输出 ────────── */
  function line(html, cls) {
    var p = U.el('p', { class: cls || '', html: html });
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
    return p;
  }
  function gap() { out.appendChild(U.el('p', { class: 't-gap' })); }
  function echo(cmd) {
    line('<span class="t-dim">lm@nightcity:~$</span> <span class="t-cmd">' + U.esc(cmd) + '</span>');
  }

  /* ────────── 命令表 ────────── */
  var CMDS = {
    help: {
      desc: '列出全部可用指令',
      run: function () {
        line('<span class="t-hl">可用指令（Tab 补全 · ↑↓ 翻历史）</span>');
        gap();
        Object.keys(CMDS).forEach(function (k) {
          line('  <span class="t-key">' + k.padEnd(12, ' ') + '</span>' +
               '<span class="t-dim">' + U.esc(CMDS[k].desc) + '</span>');
        });
      }
    },

    about: {
      desc: '查看个人摘要',
      run: function () {
        line('<span class="t-hl">' + U.esc(D.meta.nameCn + ' ' + D.meta.name) + '</span> · ' + U.esc(D.meta.title));
        line('<span class="t-dim">ID ' + U.esc(D.meta.id) + ' · ' + U.esc(D.meta.location) + '</span>');
        gap();
        D.summary.forEach(function (s) { line('  ' + U.esc(s)); });
      }
    },

    profile: {
      desc: '列出「关于我」全部字段',
      aliases: ['info', 'me'],
      run: function () {
        var list = D.profile || [];
        if (!list.length) { line('<span class="t-dim">暂无资料。</span>'); return; }
        line('<span class="t-hl">关于我</span>');
        gap();
        list.forEach(function (p) {
          line('  <span class="t-key">' + U.esc(p.k.padEnd(6, '　')) + '</span>' +
               '<span class="t-hl">' + U.esc(p.v) + '</span>');
        });
        gap();
        line('<span class="t-dim">提示：<span class="t-key">mail</span> 可直接复制邮箱。</span>');
      }
    },

    skills: {
      desc: '输出技能矩阵（含年限）',
      run: function () {
        var list = D.skills || [];
        if (!list.length) {
          line('<span class="t-dim">技能矩阵暂无数据 — 在 resume.js 的 <span class="t-key">skills</span> 里补充。</span>');
          return;
        }
        line('<span class="t-hl">SKILL MATRIX</span>');
        list.forEach(function (s) {
          var n = Math.round(s.level / 5);
          var bar = '█'.repeat(n) + '░'.repeat(20 - n);
          line('  <span class="t-key">' + U.esc(s.short.padEnd(8, ' ')) + '</span>' +
               '<span class="t-ok">' + bar + '</span> ' +
               '<span class="t-dim">' + s.level + '/100 · ' + s.years + ' 年</span>');
        });
        if ((D.attributes || []).length) {
          gap();
          line('<span class="t-dim">能力参数：</span>' + D.attributes.map(function (a) {
            return '<span class="t-key">' + a.k + '</span> ' + a.v;
          }).join('  '));
        }
      }
    },

    exp: {
      desc: '输出工作经历',
      aliases: ['career'],
      run: function () {
        var list = D.experience || [];
        if (!list.length) { line('<span class="t-dim">工作经历暂无数据。</span>'); return; }
        list.forEach(function (e) {
          line('<span class="t-hl">' + U.esc(e.company) + '</span> <span class="t-key">' + U.esc(e.role) + '</span> ' +
               '<span class="t-dim">' + U.esc(e.period) + '</span>');
          e.points.forEach(function (p) { line('  <span class="t-dim">▸</span> ' + U.esc(p)); });
          gap();
        });
      }
    },

    works: {
      desc: '输出项目作品',
      aliases: ['proj', 'projects'],
      run: function () {
        var list = D.projects || [];
        if (!list.length) { line('<span class="t-dim">项目作品暂无数据。</span>'); return; }
        list.forEach(function (p) {
          line('<span class="t-hl">' + U.esc(p.name) + '</span> <span class="t-dim">· ' + U.esc(p.year) + '</span>');
          line('  ' + U.esc(p.desc));
          line('  <span class="t-key">' + p.stack.map(U.esc).join(' / ') + '</span>');
          gap();
        });
      }
    },

    contact: {
      desc: '输出联系方式',
      run: function () {
        [['EMAIL', D.contact.email], ['PHONE', D.contact.phone],
         ['GITHUB', D.contact.github], ['WECHAT', D.contact.wechat],
         ['BASE', D.contact.location]].forEach(function (r) {
          line('  <span class="t-key">' + r[0].padEnd(8, ' ') + '</span><span class="t-hl">' + U.esc(r[1]) + '</span>');
        });
        gap();
        line('<span class="t-dim">提示：<span class="t-key">mail</span> 复制邮箱到剪贴板，' +
             '或直接点页面上的「复制」按钮。</span>');
      }
    },

    mail: {
      desc: 'mail 复制邮箱到剪贴板',
      aliases: ['copy', 'cb'],
      run: function () {
        U.copyText(D.contact.email).then(function () {
          line('<span class="t-ok">邮箱已复制：' + U.esc(D.contact.email) + '</span>');
          CYBER.sound.play('confirm');
        }).catch(function () {
          line('<span class="t-err">复制失败，邮箱是：' + U.esc(D.contact.email) + '</span>');
        });
      }
    },

    goto: {
      desc: 'goto <status|skills|career|works|contact>',
      run: function (args) {
        /* 区块清单运行时从 DOM 派生，与导航 / <section> 天然同步（新增区块零改动） */
        var ids = U.$$('main .sect').map(function (s) { return s.id; });
        var target = (args[0] || '').toLowerCase();
        var alias = { about: 'status', home: 'status', exp: 'career', proj: 'works', hire: 'contact' }[target];
        if (alias) target = alias;
        if (ids.indexOf(target) === -1) {
          line('<span class="t-err">未知区块：' + U.esc(args[0] || '') + '</span> 可选项：' + ids.join(' / '), '');
          return false;
        }
        /* UI → core 直调，缺模块时降级为提示而不是指令报错 */
        if (CYBER.scroll && CYBER.scroll.goTo) {
          CYBER.scroll.goTo(target);
          line('<span class="t-ok">→ 已跳转至 ' + target.toUpperCase() + '</span>');
          return true;
        }
        line('<span class="t-dim">滚动模块未加载，无法跳转。区块 id：' + U.esc(target) + '</span>');
        return false;
      }
    },

    theme: {
      desc: 'theme <yellow|cyan|red> 切换主题配色',
      run: function (args) {
        if (!CYBER.nav || !CYBER.nav.applyAccent) {
          line('<span class="t-err">导航模块未加载，主题切换不可用。</span>');
          return false;
        }
        var name = (args[0] || '').toLowerCase();
        if (!name) {
          var cur = CYBER.nav.cycleAccent();
          line('<span class="t-ok">主题已循环至 ' + cur + '</span>');
          return true;
        }
        if (['yellow', 'cyan', 'red'].indexOf(name) === -1) {
          line('<span class="t-err">可用主题：yellow / cyan / red</span>');
          return false;
        }
        CYBER.nav.applyAccent(name);
        line('<span class="t-ok">主题已切换 → ' + name + '</span>');
        return true;
      }
    },

    sound: {
      desc: 'sound <on|off> 控制音效',
      run: function (args) {
        var v = (args[0] || '').toLowerCase();
        if (v !== 'on' && v !== 'off') {
          line('<span class="t-dim">当前音效：' + (CYBER.sound.isEnabled() ? 'ON' : 'OFF') +
               '　用法：sound on / sound off</span>');
          return true;
        }
        CYBER.sound.setEnabled(v === 'on');
        line('<span class="t-ok">音效已 ' + (v === 'on' ? '开启' : '静音') + '</span>');
        return true;
      }
    },

    glitch: {
      desc: 'glitch 触发一次故障效果',
      run: function () {
        U.bus.emit('bg:glitch');
        CYBER.sound.play('glitch');
        line('<span class="t-err">!! SIGNAL CORRUPTED !!</span>');
      }
    },

    whoami: {
      desc: '打印当前身份',
      run: function () {
        line('<span class="t-hl">' + U.esc(D.meta.nameCn + ' ' + D.meta.name) + '</span>');
        line('<span class="t-dim">' + U.esc(D.meta.title) + ' · ' + U.esc(D.meta.location) + ' · ' +
             U.esc(D.meta.availability) + '</span>');
        line('<span class="t-dim">DOSSIER ' + U.esc(D.meta.id) + ' · ' + U.esc(D.meta.dossierNo) + '</span>');
      }
    },

    date: {
      desc: '打印当前时间',
      run: function () { line('<span class="t-hl">' + new Date().toString() + '</span>'); }
    },

    resume: {
      desc: 'resume 打印 / 另存为 PDF',
      run: function () {
        line('<span class="t-dim">正在调用系统打印…选择「另存为 PDF」即可导出简历。</span>');
        setTimeout(printResume, 320);
      }
    },

    open: {
      desc: 'open <github|email> 打开外部链接',
      run: function (args) {
        var k = (args[0] || '').toLowerCase();
        if (k === 'github') { root.open('https://' + D.contact.github, '_blank', 'noopener'); line('<span class="t-ok">已打开 GitHub</span>'); return true; }
        if (k === 'email') { root.location.href = 'mailto:' + D.contact.email; line('<span class="t-ok">已唤起邮件客户端</span>'); return true; }
        line('<span class="t-err">用法：open github / open email</span>');
        return false;
      }
    },

    ls: {
      desc: '列出档案目录',
      run: function () {
        line('<span class="t-key">./ccc-main/</span>');
        ['index.html                     页面外壳与语义结构',
         'js/data/resume.js              ★ 唯一内容源，改简历只改这里',
         'css/tokens·base·layout         设计令牌 / 基线 / 骨架',
         'css/components/*               按区块拆分的组件样式',
         'css/fx·css/responsive          特效与打印 / 断点适配',
         'js/core·js/fx·js/ui            渲染逻辑（见 README 目录树）'].forEach(function (f) {
          line('  <span class="t-dim">' + U.esc(f) + '</span>');
        });
      }
    },

    sudo: {
      desc: '提升权限（大概吧）',
      run: function () {
        line('<span class="t-err">Permission denied: 你已经有全部权限了，直接联系我就行。</span>');
        CYBER.sound.play('error');
      }
    },

    banner: {
      desc: 'banner 打印 HUD 横幅',
      run: function () {
        line('<span class="t-cmd">' +
'  _     ___ _   _   __  __ ___ \n' +
' | |   |_ _| \\ | | |  \\/  | __|\n' +
' | |__  | ||  \\| | | |\\/| | _| \n' +
' |____||___|_|\\__| |_|  |_|___|</span>');
        gap();
        line('<span class="t-dim">' + U.esc(D.meta.titleEn) + ' · NIGHT CITY DOSSIER v' + CYBER.VERSION + '</span>');
      }
    },

    clear: {
      desc: '清空终端输出',
      run: function () { U.clear(out); }
    },

    exit: {
      desc: '关闭终端',
      aliases: ['close', 'q'],
      run: function () { close(); }
    }
  };

  /* 别名索引 */
  var ALIAS = {};
  Object.keys(CMDS).forEach(function (k) {
    (CMDS[k].aliases || []).forEach(function (a) { ALIAS[a] = k; });
  });

  function resolve(name) {
    if (CMDS[name]) return name;
    if (ALIAS[name]) return ALIAS[name];
    return null;
  }

  /* ────────── 执行 ────────── */
  function exec(raw) {
    var cmd = raw.trim();
    if (!cmd) return;
    echo(cmd);
    history.push(cmd);
    hIndex = history.length;

    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    var key = resolve(name);
    if (!key) {
      CYBER.sound.play('error');
      line('<span class="t-err">未识别的指令：' + U.esc(name) + '</span>');
      line('<span class="t-dim">输入 <span class="t-key">help</span> 查看全部指令</span>');
      return;
    }
    try {
      CMDS[key].run(args);
    } catch (e) {
      line('<span class="t-err">指令执行异常：' + U.esc(e.message || String(e)) + '</span>');
    }
  }

  /* ────────── 打印 / 导出 PDF ──────────
     与浏览器 Ctrl+P 走同一条路径：preparePrint 幂等，
     随后的 window.print() 触发 beforeprint 会再次进入 preparePrint（no-op）。 */
  function printResume() {
    if (CYBER.scroll && CYBER.scroll.preparePrint) CYBER.scroll.preparePrint();
    root.print();
  }

  /* ────────── 开 / 关 ────────── */
  function open(initialCmd) {
    if (!wrap) return;
    lastFocus = document.activeElement;
    wrap.hidden = false;
    opened = true;
    document.body.style.overflow = 'hidden';
    CYBER.sound.play('open');

    if (!ready) { greet(); ready = true; }

    if (initialCmd) {
      input.value = initialCmd;
      setTimeout(function () { onEnter(); }, 180);
    }
    setTimeout(function () { input.focus(); }, 40);
  }

  function close() {
    if (!wrap || !opened) return;
    wrap.hidden = true;
    opened = false;
    document.body.style.overflow = '';
    CYBER.sound.play('close');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function greet() {
    D.termMOTD.forEach(function (l) { line(U.escLite(l)); });
    gap();
    line('<span class="t-dim">快速开始：<span class="t-key">about</span> · <span class="t-key">skills</span> · ' +
         '<span class="t-key">works</span> · <span class="t-key">goto contact</span></span>');
  }

  /* ────────── 输入事件 ────────── */
  function onEnter() {
    exec(input.value);
    input.value = '';
  }

  function complete() {
    var v = input.value.trim().toLowerCase();
    if (!v) return;
    var pool = Object.keys(CMDS).concat(Object.keys(ALIAS));
    var hits = pool.filter(function (k) { return k.indexOf(v) === 0; });
    if (hits.length === 1) {
      input.value = hits[0] + ' ';
    } else if (hits.length > 1) {
      echo(input.value);
      line('<span class="t-dim">' + hits.map(function (h) { return '<span class="t-key">' + h + '</span>'; }).join('  ') + '</span>');
    }
  }

  function bind() {
    form.addEventListener('submit', function (e) { e.preventDefault(); onEnter(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        hIndex = Math.max(0, hIndex - 1);
        input.value = history[hIndex] || '';
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        hIndex = Math.min(history.length, hIndex + 1);
        input.value = history[hIndex] || '';
        return;
      }
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); U.clear(out); return; }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    U.$$('[data-term-close]', wrap).forEach(function (n) {
      n.addEventListener('click', close);
    });

    U.$$('[data-term]').forEach(function (btn) {
      btn.addEventListener('click', function () { open(btn.dataset.term); });
    });

    /* 全局快捷键 */
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        opened ? close() : open();
      }
    });

    U.bus.on('term:open', function (cmd) { open(cmd); });
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    wrap  = U.$('#term');
    if (!wrap) return;
    out   = U.$('#term-out');
    form  = U.$('#term-form');
    input = U.$('#term-cmd');

    /* 标题栏版本号回填（版本唯一定义在 utils.js 的 CYBER.VERSION） */
    var titleEl = U.$('.term__title', wrap);
    if (titleEl) titleEl.textContent = 'DOSSIER SHELL · v' + CYBER.VERSION;

    bind();
  }

  CYBER.terminal = { init: init, open: open, close: close, exec: exec };
  CYBER.register('terminal', { order: 100, init: init });
})(window);
