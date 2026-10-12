/* ═══════════════════════════════════════════════════════════════
   js/ui/career.js — 03 CAREER
   版式参考：日期标签 + 级别徽章 + 「查看…」动作链接 + 条目标题
   两种数据共用同一套视觉：
     · experience[] → 工作经历，动作链接为「查看职责」（展开明细）
     · awards[]     → 荣誉奖项，动作链接为「查看证书」（外链，缺链接时提示待补充）
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var rows = [];

  var CHEVRON =
    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">' +
    '<path d="M3 1.5L6.5 5L3 8.5" stroke="currentColor" stroke-width="1.4"/></svg>';

  var ICON_BUILDING =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2.5 14V5.5L8 2.5l5.5 3V14" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M1 14h14" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M6 14V9.5h4V14" stroke="currentColor" stroke-width="1.3"/></svg>';

  var ICON_MEDAL =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<circle cx="8" cy="10" r="4.2" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M5.6 1.5L7 6.2M10.4 1.5L9 6.2" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M8 8.2l.9 1.7 1.9.3-1.4 1.3.3 1.9L8 12.5l-1.7.9.3-1.9-1.4-1.3 1.9-.3z" ' +
    'fill="currentColor" opacity=".85"/></svg>';

  /* ══════════ 工作经历 ══════════ */
  function buildJob(item, index) {
    var bodyId = 'job-body-' + index;
    var headId = 'job-head-' + index;

    var meta = U.el('span', { class: 'job__meta' }, [
      U.el('span', { class: 'job__days', text: item.period }),
      U.el('span', {
        class: 'tl-badge tl-badge--' + (item.badgeKey || 'normal'),
        text: item.badge || '全职'
      }),
      U.el('span', {
        class: 'tl-action',
        html: '<span class="tl-action__txt">查看职责</span>' + CHEVRON
      })
    ]);

    var main = U.el('span', { class: 'job__main' }, [
      U.el('span', { class: 'job__ico', html: ICON_BUILDING, 'aria-hidden': 'true' }),
      U.el('span', { class: 'job__text' }, [
        U.el('span', { class: 'job__co', text: item.company }),
        U.el('span', { class: 'job__role', text: item.role })
      ])
    ]);

    var head = U.el('button', {
      class: 'job__head', type: 'button', id: headId,
      'aria-expanded': 'false', 'aria-controls': bodyId
    }, [meta, main]);

    var list = U.el('ul', { class: 'job__list' },
      (item.points || []).map(function (p) { return U.el('li', { text: p }); }));   // F1：points 缺失按空明细降级

    var body = U.el('div', {
      class: 'job__body', id: bodyId, role: 'region', 'aria-labelledby': headId
    }, [U.el('div', { class: 'job__inner' }, [list])]);

    /* .job 带 clip-path（右上切角），会裁掉向外伸出的时间轴节点，
       所以节点画在无裁剪的外层 .job-row 上 */
    var card = U.el('div', { class: 'job' }, [head, body]);
    var row = U.el('li', { class: 'job-row' }, [card]);

    head.addEventListener('click', function () { toggleRow(row, head); });
    head.addEventListener('pointerenter', function () { CYBER.sound.play('hover'); });

    return { node: row, head: head };
  }

  function toggleRow(row, head, force) {
    var open = typeof force === 'boolean' ? force : !row.classList.contains('is-open');
    row.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    CYBER.sound.play(open ? 'open' : 'close');
  }

  /* ══════════ 荣誉奖项 ══════════ */
  function buildAward(item, index) {
    var block = document.getElementById('awards-block');
    var titleId = 'award-title-' + index;

    /* 有证书链接就外链，没有就诚实提示「待补充」 */
    var action = U.el('span', {
      class: 'tl-action' + (item.cert ? '' : ' tl-action--todo'),
      html: '<span class="tl-action__txt">' + (item.cert ? '查看证书' : '证书待补充') + '</span>' + CHEVRON
    });

    if (item.cert) {
      var a = U.el('a', {
        class: 'award__link',
        href: item.cert,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': item.title + ' — 查看证书'
      }, [action]);
      action = a;
    } else {
      action.addEventListener('click', function () {
        CYBER.sound.play('scan');
        CYBER.toast.warn('证书链接尚未填写 — 在 resume.js 的 awards[' + index + '].cert 里补上即可', { key: 'CERT' });
      });
    }

    var meta = U.el('span', { class: 'job__meta' }, [
      U.el('span', { class: 'job__days', text: item.date }),
      U.el('span', {
        class: 'tl-badge tl-badge--' + (item.levelKey || 'normal'),
        text: item.level
      }),
      action
    ]);

    var main = U.el('span', { class: 'job__main' }, [
      U.el('span', { class: 'job__ico', html: ICON_MEDAL, 'aria-hidden': 'true' }),
      U.el('span', { class: 'job__text' }, [
        U.el('span', { class: 'job__co award__title', id: titleId, text: item.title })
      ])
    ]);

    /* 奖项本身不是折叠内容，用 div 而不是 button，避免误导键盘用户 */
    var head = U.el('div', { class: 'job__head job__head--static' }, [meta, main]);
    var card = U.el('div', { class: 'job job--award' }, [head]);
    return U.el('li', { class: 'job-row job-row--award' }, [card]);
  }

  /* ══════════ 渲染 ══════════ */
  function render() {
    var box = U.$('#career-timeline');
    var missing = U.$('#career-missing');
    var edu = U.$('#edu-text');

    if (edu) edu.textContent = D.education || '—';

    /* 工作经历 */
    var jobs = D.experience || [];
    if (box) {
      U.clear(box);
      rows = [];          // 与 DOM 清理同步，避免重复初始化时条目句柄翻倍
      if (jobs.length) {
        jobs.forEach(function (item, i) {
          var j = buildJob(item, i);
          box.appendChild(j.node);
          rows.push(j);
        });
        /* 默认展开最近一段 */
        if (rows[0]) setTimeout(function () { toggleRow(rows[0].node, rows[0].head, true); }, 260);
      } else {
        box.hidden = true;
      }
    }
    if (missing && !jobs.length) {
      missing.hidden = false;
      missing.appendChild(U.emptyState({
        code: 'NO SERVICE RECORD',
        title: '工作经历待补充',
        desc: '在 <code>js/data/resume.js</code> 的 <code>experience</code> 数组里按下面的形状补上即可，' +
              '页面会自动渲染成与右侧同一套版式。',
        snippet:
'{\n' +
'  company: \'公司名\',\n' +
'  role:    \'职位\',\n' +
'  period:  \'2024.07 — 至今\',\n' +
'  badge:   \'全职\',          // 徽章文案\n' +
'  badgeKey:\'normal\',        // lead / senior / normal / intern\n' +
'  points:  [\'职责要点一\', \'职责要点二\']\n' +
'}'
      }));
    }

    /* 荣誉奖项 */
    var awards = D.awards || [];
    var awardBox = U.$('#awards-timeline');
    var awardBlock = U.$('#awards-block');
    if (awardBox && awardBlock) {
      if (awards.length) {
        awardBlock.hidden = false;
        U.clear(awardBox);
        awards.forEach(function (item, i) { awardBox.appendChild(buildAward(item, i)); });
      } else {
        awardBlock.hidden = true;
      }
    }
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;
    render();
  }

  CYBER.career = { init: init };
  CYBER.register('career', { order: 70, init: init });
})(window);
