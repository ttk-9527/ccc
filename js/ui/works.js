/* ═══════════════════════════════════════════════════════════════
   js/ui/works.js — 04 WORKS：技术栈筛选 + 作品卡
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var grid, filterRow, emptyHint, cards = [];
  var current = '*';

  /* ────────── 作品卡 ────────── */
  function buildCard(item, index) {
    /* F1：tags/stack 皆缺按空数组降级，卡片仍渲染、只是进不了任何筛选 */
    var stacks = item.tags || item.stack || [];

    /* 图片判空（t4 小瑕疵）：image 缺失/null 时不创建 <img>，
       .work__media 走渐变占位 + 居中描边代号（work__media-code），不输出无 src 的图片 */
    var mediaKids = [];
    if (item.image) {
      var img = U.el('img', {
        src: item.image,
        alt: item.name + ' 项目配图',
        loading: 'lazy',
        decoding: 'async'
      });
      img.addEventListener('error', function () { img.style.display = 'none'; });
      mediaKids.push(img);
    } else {
      mediaKids.push(U.el('span', {
        class: 'work__media-code', 'aria-hidden': 'true',
        text: item.code || item.name || ''
      }));
    }
    mediaKids.push(
      U.el('span', {
        class: 'work__no',
        /* 批次3：档案条 + 锁态标（有 url = UNLOCKED 可点，无 = LOCKED 纯展示） */
        text: 'FILE #' + String(index + 1).padStart(2, '0') + (item.url ? ' · UNLOCKED' : ' · LOCKED')
      }),
      U.el('span', { class: 'work__year', text: item.year })
    );
    var media = U.el('div', {
      class: item.image ? 'work__media' : 'work__media work__media--empty'
    }, mediaKids);

    /* D5/t9：真链接才可聚焦——有 item.url 时标题渲染成外链（target=_blank，
       Enter 原生可用），并接既有音效/准星反馈；无 url 时卡片是纯展示 article：
       不加 tabindex / aria-label / keydown 假控件 */
    var title;
    if (item.url) {
      var link = U.el('a', {
        class: 'work__name-link', href: item.url,
        target: '_blank', rel: 'noopener noreferrer', text: item.name
      });
      link.addEventListener('click', function () {
        CYBER.sound.play('confirm');
        U.bus.emit('reticle:label', 'OPEN');
      });
      title = U.el('h3', { class: 'work__name' }, [link]);
    } else {
      title = U.el('h3', { class: 'work__name', text: item.name });
    }

    var body = U.el('div', { class: 'work__body' }, [
      title,
      U.el('p', { class: 'work__desc', text: item.desc }),
      U.el('div', { class: 'work__stack' },
        item.stack.map(function (s) { return U.el('span', { text: s }); })),
      item.metric ? U.el('p', { class: 'work__metric' }, [
        U.el('span', { text: item.metric.label }),
        U.el('b', { text: item.metric.value }),
        U.el('span', { text: item.metric.unit })
      ]) : null
    ]);

    var card = U.el('article', {
      class: item.url ? 'work work--link' : 'work',
      dataset: { stacks: stacks.join('|'), tilt: '' }
    }, [media, body]);

    /* 悬停音效保留（鼠标交互）；可聚焦假控件的 focus/blur/keydown 已随 D5 移除 */
    card.addEventListener('pointerenter', function () {
      CYBER.sound.play('hover');
      U.bus.emit('reticle:label', 'TARGET LOCKED');   // Quick Win #1：锁定语感
    });

    /* 整卡可点（用户反馈：仅标题小字可点易被感知为「没有超链接」）：
       点击卡片任意位置 → 新窗口打开 url；点在标题 <a> 上时交由其原生导航，
       此处跳过以避免双开。键盘路径不变：标题 <a> 是唯一可聚焦入口（Enter 原生打开）。 */
    if (item.url) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;   // 标题链接自身处理
        CYBER.sound.play('confirm');
        U.bus.emit('reticle:label', 'OPEN');
        window.open(item.url, '_blank', 'noopener,noreferrer');
      });
    }

    return card;
  }

  /* ────────── 筛选 ────────── */
  function collectStacks() {
    var map = {};
    D.projects.forEach(function (p) {
      (p.tags || p.stack || []).forEach(function (s) { map[s] = (map[s] || 0) + 1; });   // F1
    });
    return Object.keys(map).sort(function (a, b) {
      return map[b] - map[a] || a.localeCompare(b);
    }).map(function (k) { return { name: k, n: map[k] }; });
  }

  function applyFilter(value) {
    current = value;
    var visible = 0;

    cards.forEach(function (card) {
      var stacks = card.dataset.stacks.split('|');
      var show = value === '*' || stacks.indexOf(value) > -1;
      card.classList.toggle('is-filtered-out', !show);
      if (show) visible++;
    });

    U.$$('.chip', filterRow).forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.dataset.filter === value ? 'true' : 'false');
    });

    if (emptyHint) emptyHint.hidden = visible > 0;

    // 重新触发这些卡片的揭示动画
    // 注意：动画结束后必须清掉 animation，否则 fill-mode 会一直覆盖 3D 倾斜的内联 transform
    cards.forEach(function (c, i) {
      if (c.classList.contains('is-filtered-out')) return;
      c.style.animation = 'none';
      void c.offsetWidth;                       // 强制重排以重启动画
      if (U.reducedMotion()) { c.style.animation = ''; return; }

      c.style.animation = 'fadeUpIn 320ms cubic-bezier(0.2,0.9,0.1,1) ' +
                          (Math.min(i, 8) * 40) + 'ms both';
      c.addEventListener('animationend', function once() {
        c.style.animation = '';
        c.removeEventListener('animationend', once);
      });
    });
  }

  /* ────────── 渲染 ────────── */
  function render() {
    grid = U.$('#works-grid');
    filterRow = U.$('#works-filters');
    emptyHint = U.$('#works-empty');
    if (!grid) return;

    /* 先清空旧内容，保证重复渲染不会让卡片/筛选按钮翻倍 */
    U.clear(grid);
    if (filterRow) U.clear(filterRow);
    cards = [];

    /* 没有项目数据时，收起筛选与网格，显示占位而不是空壳 */
    var list = D.projects || [];
    /* 条目 ≤2 时收窄网格（.work-grid--few）：不让 3 列布局留出大片空白 */
    grid.classList.toggle('work-grid--few', list.length > 0 && list.length <= 2);
    if (!list.length) {
      grid.hidden = true;
      if (filterRow) filterRow.hidden = true;
      if (emptyHint) emptyHint.hidden = true;
      var miss = U.$('#works-missing');
      if (miss) {
        miss.hidden = false;
        miss.appendChild(U.emptyState({
          code: 'NO ARCHIVE DATA',
          title: '项目作品待补充',
          desc: '在 <code>js/data/resume.js</code> 的 <code>projects</code> 数组里按下面的形状填入条目，' +
                '筛选条与作品卡会自动出现。配图可直接用工程内已有的 ' +
                '<code>assets/work-1.jpg</code> ~ <code>work-4.jpg</code>。',
          snippet:
'{\n' +
'  name:  \'影时间可视化引擎\',\n' +
'  code:  \'DARK HOUR VIZ\',        // 英文代号\n' +
'  year:  \'2025\',\n' +
'  desc:  \'一句话说明做了什么、解决了什么。\',\n' +
'  stack: [\'Canvas\', \'WebWorker\'], // 展示用完整技术栈\n' +
'  tags:  [\'可视化\', \'Canvas\'],    // 筛选用，建议每项 ≤2 个\n' +
'  image: \'assets/work-1.jpg\',\n' +
'  url:   \'https://example.com/repo\', // 可选：外链，整卡可点击（标题为真链接）新窗口打开\n' +
'  metric:{ value: \'60\', unit: \'FPS\', label: \'十万级数据点\' }\n' +
'}'
        }));
      }
      return;
    }

    /* 卡片 */
    list.forEach(function (p, i) {
      var card = buildCard(p, i);
      grid.appendChild(card);
      cards.push(card);
    });

    /* 筛选按钮 */
    if (filterRow) {
      var all = U.el('button', {
        class: 'chip', type: 'button', dataset: { filter: '*' },
        'aria-pressed': 'true', text: '全部'
      });
      all.appendChild(U.el('span', { class: 'chip__n', text: String(list.length) }));
      filterRow.appendChild(all);

      collectStacks().forEach(function (s) {
        var chip = U.el('button', {
          class: 'chip', type: 'button', dataset: { filter: s.name },
          'aria-pressed': 'false', text: s.name
        });
        chip.appendChild(U.el('span', { class: 'chip__n', text: String(s.n) }));
        filterRow.appendChild(chip);
      });

      filterRow.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip || !filterRow.contains(chip)) return;
        CYBER.sound.play('click');
        applyFilter(chip.dataset.filter);
      });
    }

    /* 重置按钮（空状态里） */
    U.$$('[data-filter-reset]').forEach(function (b) {
      b.addEventListener('click', function () {
        CYBER.sound.play('click');
        applyFilter('*');
      });
    });

    /* D5：原「卡片上 Enter 播放音效+故障」的假控件键盘分支已移除——
       有 url 的标题是真 <a>（Enter 原生激活），无 url 的卡片不聚焦、自然无键盘陷阱 */
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;
    render();
  }

  CYBER.works = { init: init, filter: applyFilter };
  CYBER.register('works', { order: 80, init: init });
})(window);
