/* ═══════════════════════════════════════════════════════════════
   js/ui/skills.js — 02 SKILLS：技能条、八轴雷达图、能力参数
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils, D = CYBER.data;

  var cvs, ctx, SIZE = 440, DPR = 1, R = 0, CX = 0, CY = 0;
  var progress = 0, drawn = false;

  /* ────────── 技能条 ────────── */
  function renderBars() {
    var box = U.$('#skill-bars');
    if (!box) return;
    var fills = [];

    D.skills.forEach(function (s) {
      var fill = U.el('span', { class: 'bar__fill' });
      var track = U.el('div', {
        class: 'bar__track',
        role: 'meter',
        'aria-label': s.name + ' 熟练度',
        'aria-valuenow': String(s.level),
        'aria-valuemin': '0',
        'aria-valuemax': '100'
      }, [fill]);

      box.appendChild(U.el('li', {}, [
        U.el('div', { class: 'bar__top' }, [
          U.el('span', { class: 'bar__name', text: s.name }),
          U.el('span', { class: 'bar__meta', text: s.level + ' / 100 · ' + s.years + ' 年' })
        ]),
        track
      ]));
      fills.push({ node: fill, level: s.level });
    });

    U.bus.on('skills:reveal', function () {
      fills.forEach(function (f, i) {
        setTimeout(function () { f.node.style.width = f.level + '%'; }, i * 70);
      });
    });
  }

  /* ────────── 能力参数 ────────── */
  function renderAttrs() {
    var box = U.$('#attr-list');
    if (!box) return;
    var fills = [];

    D.attributes.forEach(function (a) {
      var bar = U.el('span');
      box.appendChild(U.el('li', { class: 'attr' }, [
        U.el('span', { class: 'attr__k', text: a.k }),
        U.el('span', {
          class: 'attr__bar',
          role: 'meter',
          'aria-label': a.k + ' ' + a.label,
          'aria-valuenow': String(a.v),
          'aria-valuemin': '0', 'aria-valuemax': '100'
        }, [bar]),
        U.el('span', { class: 'attr__v', text: String(a.v) })
      ]));
      fills.push({ node: bar, level: a.v });
    });

    U.bus.on('skills:reveal', function () {
      fills.forEach(function (f, i) {
        setTimeout(function () { f.node.style.width = f.level + '%'; }, 260 + i * 110);
      });
    });
  }

  /* ────────── 雷达图 ────────── */
  function setupCanvas() {
    cvs = U.$('#radar-canvas');
    if (!cvs) return false;
    ctx = cvs.getContext('2d');
    if (!ctx) return false;

    DPR = Math.min(root.devicePixelRatio || 1, 2);
    cvs.width = SIZE * DPR;
    cvs.height = SIZE * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    CX = SIZE / 2;
    CY = SIZE / 2;
    R = SIZE / 2 - 62;
    return true;
  }

  function axisPoint(i, n, r) {
    // 从正上方开始，顺时针
    var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: CX + Math.cos(ang) * r, y: CY + Math.sin(ang) * r, ang: ang };
  }

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  /* 把 40–100 的评分映射到 0–1 半径，避免所有点都挤在外圈变成"圆饼" */
  var FLOOR = 40, SPAN = 60;
  function norm(level) {
    return U.clamp((level - FLOOR) / SPAN, 0, 1);
  }

  function drawRadar(p) {
    if (!ctx) return;
    var n = D.skills.length;
    var accent = cssVar('--accent', '#fcee0a');
    var cyan = '#00f0ff';

    ctx.clearRect(0, 0, SIZE, SIZE);

    /* 同心网格 */
    ctx.strokeStyle = 'rgba(0,240,255,0.20)';
    ctx.lineWidth = 1;
    for (var ring = 1; ring <= 4; ring++) {
      var rr = R * (ring / 4);
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var pt = axisPoint(i % n, n, rr);
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    /* 轴线 */
    ctx.strokeStyle = 'rgba(0,240,255,0.30)';
    for (var a = 0; a < n; a++) {
      var end = axisPoint(a, n, R);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    /* 数据多边形 */
    ctx.beginPath();
    for (var k = 0; k <= n; k++) {
      var idx = k % n;
      var val = norm(D.skills[idx].level) * p;
      var pp = axisPoint(idx, n, R * val);
      k === 0 ? ctx.moveTo(pp.x, pp.y) : ctx.lineTo(pp.x, pp.y);
    }
    ctx.closePath();

    var grad = ctx.createRadialGradient(CX, CY, 6, CX, CY, R);
    grad.addColorStop(0, hexA(cyan, 0.32));
    grad.addColorStop(1, hexA(accent, 0.10));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = hexA(accent, 0.7);
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* 顶点 */
    for (var v = 0; v < n; v++) {
      var val2 = norm(D.skills[v].level) * p;
      var vp = axisPoint(v, n, R * val2);
      ctx.fillStyle = cyan;
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 3, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = hexA(accent, 0.9);
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 1.4, 0, 6.2832);
      ctx.fill();
    }

    /* 轴标签 */
    ctx.font = '11px "Share Tech Mono", monospace';
    for (var L = 0; L < n; L++) {
      var lp = axisPoint(L, n, R + 26);
      var cos = Math.cos(lp.ang);
      ctx.textAlign = cos > 0.3 ? 'left' : cos < -0.3 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(lp.ang) > 0.3 ? 'top' : Math.sin(lp.ang) < -0.3 ? 'bottom' : 'middle';
      ctx.fillStyle = 'rgba(234,232,244,0.9)';
      ctx.fillText(D.skills[L].short, lp.x, lp.y);
    }
  }

  /* 与背景引擎共用 utils 的实现，全仓只此一份（原 hexA 重复实现已删除） */
  var hexA = U.rgba;

  function renderLegend() {
    var box = U.$('#radar-legend');
    if (!box) return;
    D.skills.forEach(function (s) {
      box.appendChild(U.el('li', {}, [
        U.el('i', { 'aria-hidden': 'true' }),
        U.el('span', { text: s.short }),
        U.el('b', { text: String(s.level) })
      ]));
    });
  }

  var pulseId = null, curScale = 0;
  function startPulse() {
    // 静止后保留极轻微的呼吸感，避免整块死板
    if (U.reducedMotion()) return;
    var dir = 1;
    curScale = 1;
    pulseId = 'radar-pulse';
    U.loop.add(pulseId, function (dt) {
      curScale += dir * dt * 0.22;
      if (curScale > 1.035) { curScale = 1.035; dir = -1; }
      if (curScale < 0.975) { curScale = 0.975; dir = 1; }
      drawRadar(curScale);
    });
  }

  function reveal() {
    if (drawn) return;
    drawn = true;
    U.bus.emit('skills:reveal');

    if (U.reducedMotion()) { curScale = 1; drawRadar(1); return; }

    U.tween({
      from: 0, to: 1, duration: 1150, ease: U.easeOutCubic,
      onUpdate: function (v) { curScale = v; drawRadar(v); },
      onDone: function () {
        curScale = 1;
        drawRadar(1);
        root.setTimeout(startPulse, 700);
      }
    });
  }

  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    var skills = D.skills || [];
    var attrs = D.attributes || [];

    /* 没有数据时诚实显示占位，而不是渲染一张空壳面板 */
    if (!skills.length && !attrs.length) {
      var grid = U.$('#skills-grid');
      if (grid) grid.hidden = true;
      var miss = U.$('#skills-missing');
      if (miss) {
        miss.hidden = false;
        miss.appendChild(U.emptyState({
          code: 'NO SKILL DATA',
          title: '技能矩阵待补充',
          desc: '在 <code>js/data/resume.js</code> 的 <code>skills</code> 数组里按下面的形状填入条目，' +
                '技能条与雷达图会自动恢复。',
          snippet:
'{\n' +
'  name:  \'JavaScript / TypeScript\',  // 完整名\n' +
'  short: \'JS / TS\',                   // 雷达图轴标签，尽量 ≤7 字\n' +
'  level: 95,                           // 熟练度 0-100\n' +
'  years: 5                             // 实际使用年限\n' +
'}'
        }));
      }
      return;
    }

    /* 雷达图至少要 3 个轴才有形状 */
    if (skills.length < 3) {
      var radarPanel = U.$('.panel--radar');
      if (radarPanel) radarPanel.hidden = true;
    }

    renderBars();
    renderAttrs();
    if (skills.length >= 3) renderLegend();

    /* F7：能否画雷达与「是否揭示技能条」解耦——
       轴不足 / 无 Canvas(getContext 失败) / 无 IntersectionObserver 的任何回退路径
       都保证 emit 'skills:reveal'，技能条不再静默停留在 0 宽 */
    var canRadar = skills.length >= 3 && setupCanvas();
    if (canRadar) drawRadar(0);

    // 主题色切换时重绘（保留当前动画缩放）
    U.bus.on('accent:change', function () { if (canRadar) drawRadar(curScale || 1); });

    var panel = U.$('.panel--radar');
    if (canRadar && panel && root.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { reveal(); io.disconnect(); }
        });
      }, { threshold: 0.25 });
      io.observe(panel);
    } else {
      /* 无条件回退：没有雷达或没有观察器时直接触发技能条/参数条填充 */
      U.bus.emit('skills:reveal');
    }
  }

  CYBER.skills = { init: init };
  CYBER.register('skills', { order: 60, init: init });
})(window);
