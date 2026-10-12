/* ═══════════════════════════════════════════════════════════════
   js/fx/background.js — Canvas 动态背景引擎
   图层：星野 → 数据雨 → 程序化天际线 → 地平线辉光 → 透视网格 → 浮尘 → 扫描带 → 故障切片
   性能策略：DPR 上限 2、帧率无关、天际线离屏烘焙、页面隐藏即停、
             prefers-reduced-motion 只画一帧静态图。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var cvs, ctx, stack;
  var GLYPH = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789<>[]{}/\\|=+-*#@$%&';

  var W = 0, H = 0, DPR = 1, horizon = 0;
  var stars = [], rain = [], dots = [], blobs = [];
  var sky = null, skyCtx = null, skyRim = [];
  var t = 0, glitchUntil = 0, live = false;

  var par = { x: 0, y: 0 };        // 当前视差
  var parTarget = { x: 0, y: 0 };  // 目标视差

  var accent = '#fcee0a';
  var CYAN = '#00f0ff', RED = '#ff003c', MAG = '#ff2ad4';

  var MAX_DOTS_DESKTOP = 90, MAX_DOTS_MOBILE = 36;

  /* ══════════ 霓虹汉字（Quick Win #2：品红远景层）══════════
     位置按归一化坐标定义、resize 时构建一次；帧循环只读（C1 零分配）。
     绘制在天际线之前 → 被大楼遮挡，形成「楼宇间的全息招牌」层次。 */
  var NEON_DEFS = [
    { ch: '鬼',   x: 0.12, y: 0.34, s: 0.15 },
    { ch: '電脳', x: 0.74, y: 0.24, s: 0.10 },
    { ch: '夜城', x: 0.52, y: 0.42, s: 0.12 },
    { ch: '夢',   x: 0.30, y: 0.17, s: 0.08 }
  ];
  var neon = [], neonShadow = 16;
  function buildNeon() {
    neon = [];
    neonShadow = U.isMobile() ? 0 : 16;   // 移动端省掉 shadowBlur 开销
    for (var i = 0; i < NEON_DEFS.length; i++) {
      var d = NEON_DEFS[i];
      var size = Math.round(d.s * H);
      neon.push({
        ch: d.ch,
        x: Math.round(d.x * W),
        y: Math.round(d.y * horizon),
        font: '900 ' + size + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif',
        ph: Math.random() * 6.2832,
        sp: 0.4 + Math.random() * 0.7
      });
    }
  }

  /* ══════════ 飞行器（批次2-B：远景穿梭光点）══════════
     2 架对象池复用、构建期定参；红/白机身交替闪烁 + 青色尾迹。
     静态帧（reduced-motion）预置 1 架在场、不再生成新的。 */
  var crafts = [];
  function buildCrafts() {
    crafts = [];
    var still = U.reducedMotion();
    for (var i = 0; i < 2; i++) {
      var c = {
        on: false, x: -40, y: horizon * (0.14 + i * 0.08),
        dir: 1, sp: 170 + Math.random() * 150,
        ph: Math.random() * 6.2832,
        next: still ? -1 : 5 + i * 6 + Math.random() * 5
      };
      if (still && i === 0) { c.on = true; c.x = W * 0.6; }
      crafts.push(c);
    }
  }

  /* ══════════ 颜色 ══════════ */
  function readAccent() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (v) accent = v;
    } catch (e) { /* 保持默认 */ }
  }
  /* 实现统一上收到 utils（与 skills 雷达图共用一份），此处仅保留调用别名 */
  var rgba = U.rgba;

  /* ══════════ C1：帧循环零分配 ══════════
     帧内不新建字符串与渐变对象：颜色一律用「常量基色 + globalAlpha 合成」
     （与 rgba(base, α) 数学等效），渐变在 resize / accent:change 时预建缓存。 */
  var STAR_BASE = '#cdd6ff';   // 星野基色
  var RAIN_HEAD = '#dffcff';   // 数据雨首字符基色
  var scrimGrad = null;        // 天际线底部压暗（依赖 horizon / H）
  var horizonGrad = null;      // 地平线辉光（依赖 horizon + accent）
  var sweepGrad = null;        // 扫描带（单位区间，绘制时 translate 平移）

  /** 预建三张线性渐变（文本上位于 draw() 之前，帧循环只读缓存） */
  function buildGradients() {
    if (!ctx) return;
    scrimGrad = ctx.createLinearGradient(0, horizon - H * 0.18, 0, horizon + 8);
    scrimGrad.addColorStop(0, 'rgba(4,1,11,0)');
    scrimGrad.addColorStop(1, 'rgba(4,1,11,0.72)');

    horizonGrad = ctx.createLinearGradient(0, horizon - 46, 0, horizon + 26);
    horizonGrad.addColorStop(0, rgba(accent, 0));
    horizonGrad.addColorStop(0.5, rgba(accent, 0.10));
    horizonGrad.addColorStop(0.66, rgba('#ffffff', 0.16));
    horizonGrad.addColorStop(0.8, rgba(MAG, 0.16));   // Quick Win #2：品红带
    horizonGrad.addColorStop(1, rgba(MAG, 0));

    sweepGrad = ctx.createLinearGradient(0, 0, 0, H * 0.16);
    sweepGrad.addColorStop(0, rgba(CYAN, 0));
    sweepGrad.addColorStop(0.5, rgba(CYAN, 0.045));
    sweepGrad.addColorStop(1, rgba(CYAN, 0));
  }

  /* ══════════ 尺寸 ══════════ */
  function resize() {
    if (!cvs) return;
    var w = cvs.clientWidth || stack.clientWidth;
    var h = cvs.clientHeight || stack.clientHeight;
    if (!w || !h) return;

    W = w; H = h;
    DPR = Math.min(root.devicePixelRatio || 1, U.isMobile() ? 1.5 : 2);
    cvs.width = Math.round(W * DPR);
    cvs.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = 'round';

    horizon = Math.round(H * 0.60);

    buildStars();
    buildSkyline();
    buildRain();
    buildDots();
    buildBlobs();
    buildGradients();   // C1：渐变随尺寸预建，帧循环只读
    buildNeon();        // 霓虹汉字随尺寸重建
    buildCrafts();      // 飞行器对象池随尺寸重建
  }

  /* ══════════ 星野 ══════════ */
  function buildStars() {
    stars = [];
    var n = U.isMobile() ? 70 : 150;
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * horizon * 1.1,
        r: Math.random() * 1.25 + 0.25,
        a: Math.random() * 0.5 + 0.12,
        ph: Math.random() * 6.283,
        sp: Math.random() * 0.9 + 0.25
      });
    }
  }

  /* ══════════ 天际线（离屏烘焙 + 少量闪烁窗）══════════ */
  function buildSkyline() {
    sky = document.createElement('canvas');
    sky.width = Math.round(W * DPR);
    sky.height = Math.round(H * DPR);
    skyCtx = sky.getContext('2d');
    skyCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

    skyRim = [];
    var rnd = U.seeded(20770);
    var x = -50;
    var maxH = H * 0.30;

    while (x < W + 50) {
      var bw = 24 + rnd() * 74;
      var bh = 34 + Math.pow(rnd(), 1.75) * maxH;
      var top = horizon - bh;

      // 楼体：近黑到深紫的竖向渐变（刻意压暗，只做剪影）
      var g = skyCtx.createLinearGradient(0, top, 0, horizon);
      var base = 5 + rnd() * 6;
      g.addColorStop(0, 'rgb(' + Math.round(base + 6) + ',' + Math.round(base / 2) + ',' + Math.round(base * 2.2) + ')');
      g.addColorStop(1, '#03010a');
      skyCtx.fillStyle = g;
      skyCtx.fillRect(x, top, bw, bh);

      // 顶缘霓虹描边（唯一的亮部）
      if (rnd() > 0.55) {
        skyCtx.fillStyle = rgba(rnd() > 0.5 ? CYAN : MAG, 0.34);
        skyCtx.fillRect(x, top, bw, 1.2);
      }
      // 侧缘描边
      if (rnd() > 0.7) {
        skyCtx.fillStyle = rgba(CYAN, 0.14);
        skyCtx.fillRect(rnd() > 0.5 ? x : x + bw - 1, top, 1, bh);
      }

      // 窗格：低密度、低亮度，避免画面噪声化
      var winW = 3, winH = 4.4, gapX = 5.2, gapY = 8.2;
      var cols = Math.max(1, Math.floor((bw - 6) / gapX));
      var rows = Math.max(1, Math.floor((bh - 8) / gapY));
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var v = rnd();
          if (v < 0.70) continue;                // 只有约 30% 亮灯
          var wx = x + 4 + c * gapX;
          var wy = top + 5 + r * gapY;
          var col = v > 0.975 ? accent : (v > 0.925 ? CYAN : '#ffe9a8');
          skyCtx.fillStyle = rgba(col, 0.05 + rnd() * 0.15);
          skyCtx.fillRect(wx, wy, winW, winH);
        }
      }

      // 少数窗户登记为「闪烁窗」，主循环里单独叠加
      if (rows > 2 && cols > 1) {
        skyRim.push({
          x: x, top: top, bw: bw, bh: bh,
          rows: rows, cols: cols, gapX: gapX, gapY: gapY,
          ph: rnd() * 6.283,
          sp: 0.5 + rnd() * 2.4,
          col: rnd() > 0.6 ? CYAN : accent
        });
      }

      // 天线
      if (rnd() > 0.82) {
        var ax = x + bw * (0.25 + rnd() * 0.5);
        var ah = 10 + rnd() * 34;
        skyCtx.strokeStyle = rgba(CYAN, 0.42);
        skyCtx.lineWidth = 1;
        skyCtx.beginPath();
        skyCtx.moveTo(ax, top); skyCtx.lineTo(ax, top - ah);
        skyCtx.stroke();
        skyCtx.fillStyle = rgba(RED, 0.8);
        skyCtx.fillRect(ax - 1.4, top - ah - 2, 2.8, 2.8);
      }

      x += bw + 2 + rnd() * 12;
    }
  }

  /* ══════════ 数据雨 ══════════ */
  function buildRain() {
    rain = [];
    var gap = U.isMobile() ? 52 : 40;
    var cols = Math.floor(W / gap);
    for (var i = 0; i < cols; i++) {
      rain.push({
        x: i * gap + Math.random() * 12,
        y: Math.random() * horizon - horizon,
        sp: U.rand(26, 92),
        len: Math.floor(U.rand(3, 7)),
        ph: Math.random() * 6.283,
        size: Math.random() > 0.82 ? 11 : 12
      });
    }
  }

  /* ══════════ 浮尘粒子 ══════════ */
  function buildDots() {
    dots = [];
    var n = U.isMobile() ? MAX_DOTS_MOBILE : MAX_DOTS_DESKTOP;
    for (var i = 0; i < n; i++) {
      dots.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: U.rand(0.5, 2.4),
        vy: -U.rand(6, 26),
        sway: U.rand(0.2, 1),
        ph: Math.random() * 6.283,
        sp: U.rand(0.3, 1.2),
        a: U.rand(0.06, 0.3),
        hot: Math.random() > 0.72
      });
    }
  }

  /* ══════════ 大团辉光 ══════════ */
  function buildBlobs() {
    blobs = [];
    var defs = [
      { x: 0.16, y: 0.22, r: 0.46, c: CYAN,  a: 0.055 },
      { x: 0.84, y: 0.16, r: 0.40, c: MAG,   a: 0.060 },
      { x: 0.50, y: 0.62, r: 0.55, c: accent,a: 0.045 }
    ];
    defs.forEach(function (d, i) {
      blobs.push({
        bx: d.x, by: d.y, br: d.r, c: d.c, a: d.a,
        ph: i * 2.1, sp: 0.16 + i * 0.07,
        grad: null
      });
    });
    rebuildBlobGradients();
  }
  function rebuildBlobGradients() {
    if (!ctx) return;
    blobs.forEach(function (b) {
      var r = Math.max(W, H) * b.br;
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(b.c, b.a));
      g.addColorStop(1, rgba(b.c, 0));
      b.grad = g;
      b.r = r;
    });
  }

  /* ══════════ 绘制 ══════════ */
  function draw(now, dt) {
    dt = (typeof dt === 'number' && dt > 0) ? Math.min(dt, 0.05) : 1 / 60;
    t += dt;

    ctx.clearRect(0, 0, W, H);

    // 视差平滑趋近
    par.x = U.damp(par.x, parTarget.x, 3.2, dt);
    par.y = U.damp(par.y, parTarget.y, 3.2, dt);
    var ox = par.x * 26, oy = par.y * 14;

    /* ── 1. 大团辉光 ── */
    ctx.save();
    blobs.forEach(function (b) {
      var bx = b.bx * W + Math.sin(t * b.sp + b.ph) * 40 + ox * 0.6;
      var by = b.by * H + Math.cos(t * b.sp * 0.8 + b.ph) * 30 + oy * 0.6;
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = b.grad;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    /* ── 2. 星野 ── */
    ctx.save();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
      ctx.globalAlpha = s.a * tw;          // C1：常量基色 + globalAlpha，不拼接字符串
      ctx.fillStyle = STAR_BASE;
      ctx.fillRect(s.x + ox * 0.18, s.y + oy * 0.12, s.r, s.r);
    }
    ctx.restore();

    /* ── 3. 数据雨（在地平线之上，被天际线遮挡）── */
    ctx.save();
    ctx.font = '12px "Share Tech Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    for (var j = 0; j < rain.length; j++) {
      var col = rain[j];
      col.y += col.sp * dt;
      if (col.y - horizon > col.len * 13) {
        col.y = -U.rand(20, H * 0.5);
        col.sp = U.rand(26, 92);
        col.len = Math.floor(U.rand(3, 7));
      }
      var headY = col.y + horizon * 0.06;
      for (var k = 0; k < col.len; k++) {
        var cy = headY - k * 13;
        if (cy < -14 || cy > horizon - 4) continue;
        var gi = (k * 7 + j * 13 + Math.floor(t * 6)) % GLYPH.length;
        var fade = 1 - k / col.len;
        if (k === 0) { ctx.fillStyle = RAIN_HEAD; ctx.globalAlpha = 0.32 * fade + 0.08; }
        else { ctx.fillStyle = CYAN; ctx.globalAlpha = 0.20 * fade * fade; }   // C1：alpha 纯算术
        ctx.fillText(GLYPH.charAt(gi), col.x, cy);
      }
    }
    ctx.restore();

    /* ── 3.5 霓虹汉字（Quick Win #2：品红远景层，天际线之前绘制 → 被楼遮挡）── */
    if (neon.length) {
      ctx.save();
      ctx.textBaseline = 'middle';
      if (neonShadow) { ctx.shadowColor = MAG; ctx.shadowBlur = neonShadow; }
      for (var nz = 0; nz < neon.length; nz++) {
        var nw = neon[nz];
        ctx.font = nw.font;
        ctx.globalAlpha = 0.10 + 0.05 * Math.sin(t * nw.sp + nw.ph);   // 缓慢闪烁
        ctx.fillStyle = MAG;
        ctx.fillText(nw.ch, nw.x + ox * 0.5, nw.y + oy * 0.4);
      }
      if (neonShadow) ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* ── 3.6 飞行器（批次2-B：红白闪烁的远景穿梭光点，楼宇之后绘制→可被遮挡）── */
    ctx.save();
    for (var ci = 0; ci < crafts.length; ci++) {
      var cf = crafts[ci];
      if (!cf.on) {
        if (cf.next >= 0 && t > cf.next) {
          cf.on = true;
          cf.dir = Math.random() < 0.5 ? 1 : -1;
          cf.x = cf.dir > 0 ? -30 : W + 30;
          cf.y = horizon * (0.12 + Math.random() * 0.26);
          cf.sp = 170 + Math.random() * 150;
        }
        continue;
      }
      cf.x += cf.sp * dt * cf.dir;
      if (cf.x < -46 || cf.x > W + 46) {
        cf.on = false;
        if (cf.next >= 0) cf.next = t + 9 + Math.random() * 9;
        continue;
      }
      var blink = Math.sin(t * 9 + cf.ph) > -0.2;
      var cx2 = cf.x + ox * 0.4, cy2 = cf.y + oy * 0.3;
      ctx.globalAlpha = 0.35;                 // 尾迹（近段）
      ctx.fillStyle = CYAN;
      ctx.fillRect(cf.dir > 0 ? cx2 - 16 : cx2 + 4, cy2, 12, 1.5);
      /* 批次3-C：拉烟——8 段交替冷暖渐隐烟点，固定偏移零分配 */
      for (var sm = 1; sm <= 8; sm++) {
        ctx.globalAlpha = 0.30 * (1 - sm / 9);
        ctx.fillStyle = sm % 2 ? '#9adfff' : '#ffb9cf';
        ctx.fillRect(cx2 - cf.dir * (18 + sm * 8), cy2 + (sm % 2 ? 1.5 : -1.5), 2.6, 1.8);
      }
      ctx.globalAlpha = 0.9;                  // 机身光点
      ctx.fillStyle = blink ? '#ff5b6e' : '#e8f6ff';
      ctx.fillRect(cx2, cy2 - 1, 3.5, 3.5);
    }
    ctx.restore();

    /* ── 4. 天际线（烘焙图 + 闪烁窗）── */
    if (sky) {
      ctx.save();
      ctx.globalAlpha = 0.9;                    // 整体压暗，让前景文字始终是主体
      ctx.drawImage(sky, ox * 0.35, oy * 0.3, W, H);
      ctx.restore();

      ctx.save();
      for (var b = 0; b < skyRim.length; b++) {
        var bl = skyRim[b];
        var pulse = Math.sin(t * bl.sp + bl.ph);
        if (pulse < 0.62) continue;
        // 每次只点亮 1~2 扇窗，控制绘制量
        var n = 1 + ((b + Math.floor(t * 2)) % 2);
        for (var q = 0; q < n; q++) {
          var rr = (b * 3 + q * 5 + Math.floor(t * 1.6)) % bl.rows;
          var cc = (b * 2 + q * 7 + Math.floor(t * 1.1)) % bl.cols;
          var wx = bl.x + 4 + cc * bl.gapX + ox * 0.35;
          var wy = bl.top + 5 + rr * bl.gapY + oy * 0.3;
          if (wy > horizon - 6) continue;
          ctx.fillStyle = bl.col;
          ctx.globalAlpha = 0.24 * (pulse - 0.62) / 0.38 + 0.10;   // C1
          ctx.fillRect(wx, wy, 3, 4.4);
        }
      }
      ctx.restore();

      // 天际线底部压暗，与网格自然衔接（C1：渐变缓存）
      ctx.save();
      ctx.fillStyle = scrimGrad;
      ctx.fillRect(0, horizon - H * 0.18, W, H * 0.18 + 10);
      ctx.restore();
    }

    /* ── 5. 地平线辉光（C1：渐变缓存，accent:change 时重建）── */
    ctx.save();
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, horizon - 46, W, 72);
    ctx.restore();

    /* ── 6. 透视网格 ── */
    drawGrid(ox, oy);

    /* ── 7. 浮尘 ── */
    ctx.save();
    for (var d = 0; d < dots.length; d++) {
      var p = dots[d];
      p.y += p.vy * dt;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      var px = p.x + Math.sin(t * p.sp + p.ph) * p.sway * 22 + ox * 0.5;
      ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(t * p.sp * 1.7 + p.ph));   // C1
      ctx.fillStyle = p.hot ? accent : CYAN;
      ctx.beginPath();
      ctx.arc(px, p.y + oy * 0.5, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();

    /* ── 8. 扫描带（C1：渐变缓存 + translate 平移，等效原逐帧建渐变）── */
    var sweep = ((t * 0.055) % 1);
    var sy = -H * 0.16 + sweep * (H * 1.32);
    ctx.save();
    ctx.translate(0, sy);
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(0, 0, W, H * 0.16);
    ctx.restore();

    /* ── 9. 故障切片 ── */
    if (now < glitchUntil) drawGlitchBands();
  }

  function drawGrid(ox, oy) {
    var cx = W / 2 + ox * 0.9;
    var y0 = horizon + oy * 0.5;
    var bottom = H + 2;

    /* 纵向线 */
    var n = U.isMobile() ? 16 : 24;
    ctx.save();
    ctx.globalAlpha = 0.12;               // C1：常量色 + globalAlpha 等效 rgba(CYAN,.12)
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var bx = cx + (i - n / 2) * (W * 2.6 / n);
      ctx.moveTo(cx, y0);
      ctx.lineTo(bx, bottom);
    }
    ctx.stroke();

    /* 横向线（透视，向观者滚动） */
    var rows = U.isMobile() ? 11 : 15;
    var frac = (t * 0.32) % 1;
    var K = 2.4;
    for (var j = 0; j < rows; j++) {
      var z = j + frac;
      var pp = z / (z + K);
      var y = y0 + (bottom - y0) * pp;
      var a = 0.30 * (1 - pp) + 0.04;
      ctx.globalAlpha = a;                 // C1
      ctx.strokeStyle = j % 3 === 0 ? accent : CYAN;
      ctx.lineWidth = j % 3 === 0 ? 1.1 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlitchBands() {
    ctx.save();
    var bands = 5 + (Math.random() * 4 | 0);
    for (var i = 0; i < bands; i++) {
      var by = Math.random() * H;
      var bh = U.rand(6, 42);
      var dx = U.rand(-46, 46);
      var sx = Math.max(0, -dx) * DPR;
      var sw = Math.max(1, (W - Math.abs(dx)) * DPR);
      try {
        ctx.drawImage(cvs, sx, by * DPR, sw, bh * DPR, Math.max(0, dx), by, W - Math.abs(dx), bh);
      } catch (e) { /* 越界忽略 */ }
      ctx.fillStyle = Math.random() > 0.5 ? RED : CYAN;
      ctx.globalAlpha = U.rand(0.05, 0.16);   // C1：不拼接 rgba 字符串
      ctx.fillRect(0, by, W, bh);
    }
    ctx.restore();
  }

  /* ══════════ 主循环 ══════════ */
  function tick(dt, now) {
    draw(now, dt);
  }

  function start() {
    if (!ctx) return;
    if (U.reducedMotion()) { draw(performance.now()); reveal(); return; }
    U.loop.add('bg', tick);
    reveal();
  }
  function stop() { U.loop.remove('bg'); }
  function reveal() {
    if (live) return;
    live = true;
    if (stack) stack.classList.add('is-live');
  }

  function triggerGlitch(ms) {
    glitchUntil = performance.now() + (ms || 240);
    if (U.reducedMotion()) { draw(performance.now()); }
  }

  /* ══════════ 初始化 ══════════ */
  var inited = false;
  function init() {
    if (inited) return;   // init 幂等
    inited = true;

    cvs = U.$('#bg-canvas');
    stack = U.$('.bg-stack');
    if (!cvs || !stack) return;

    ctx = cvs.getContext('2d', { alpha: true });
    if (!ctx) return;

    readAccent();
    resize();

    U.bus.on('accent:change', function () {
      readAccent();
      rebuildBlobGradients();
      buildSkyline();
      buildGradients();   // C1：辉光渐变依赖 accent，主题切换时重建一次
      draw(performance.now());
    });

    /* 视差 */
    if (U.finePointer() && !U.reducedMotion()) {
      root.addEventListener('pointermove', function (e) {
        parTarget.x = (e.clientX / root.innerWidth - 0.5) * 2;
        parTarget.y = (e.clientY / root.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    /* 尺寸变化 */
    var onResize = U.debounce(function () {
      resize();
      if (U.reducedMotion()) draw(performance.now());
    }, 180);
    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', onResize);
    if (root.ResizeObserver) {
      new ResizeObserver(onResize).observe(stack);
    }

    var go = function () { start(); };
    if (document.readyState === 'complete') go();
    else root.addEventListener('load', go, { once: true });

    /* 页面隐藏时停循环（utils 里已全局处理，这里保证恢复时补帧）*/
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !U.reducedMotion()) draw(performance.now());
    });
  }

  CYBER.background = { init: init, start: start, stop: stop, glitch: triggerGlitch, isLive: function () { return live; } };
  CYBER.register('background', { order: 20, init: init });
})(window);
