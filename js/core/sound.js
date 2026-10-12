/* ═══════════════════════════════════════════════════════════════
   js/core/sound.js — WebAudio 程序化音效（零音频文件）
   所有音效由振荡器 / 噪声实时合成，无需下载 mp3，
   也规避了「免费音效图库不可热链」的问题。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  var STORE_KEY = 'cyber:sound';
  var ctx = null, master = null;
  var enabled = false;

  /* ── 惰性初始化（必须在用户手势后调用，浏览器策略要求）── */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = 0.20;
    master.connect(ctx.destination);
    return ctx;
  }

  function ready() { return enabled && ensure(); }

  /* ── 基础音色：振荡器 + 指数衰减包络 ── */
  function tone(o) {
    if (!ready()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.09;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.gain == null ? 0.5 : o.gain, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    var dest = master;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.filter;
      f.Q.value = 1.1;
      osc.connect(f); f.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* ── 噪声爆（用于故障音）── */
  function noise(o) {
    if (!ready()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = o.dur || 0.14;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = o.gain == null ? 0.28 : o.gain;
    var f = ctx.createBiquadFilter();
    f.type = o.filterType || 'highpass';
    f.frequency.value = o.filter || 900;
    src.connect(f); f.connect(gain); gain.connect(master);
    src.start(t0);
  }

  /* ── 音效库 ── */
  var bank = {
    hover:   function () { tone({ freq: 1750, to: 2100, dur: 0.035, gain: 0.16, type: 'square' }); },
    click:   function () { tone({ freq: 880, to: 320, dur: 0.075, gain: 0.42 }); },
    toggle:  function () { tone({ freq: 420, to: 1180, dur: 0.10, gain: 0.36, type: 'sawtooth', filter: 1400 }); },
    confirm: function () {
      tone({ freq: 660, dur: 0.07, gain: 0.34, type: 'square' });
      tone({ freq: 990, dur: 0.11, gain: 0.30, type: 'square', delay: 0.075 });
    },
    error:   function () {
      tone({ freq: 200, to: 96, dur: 0.24, gain: 0.42, type: 'sawtooth' });
      noise({ dur: 0.13, gain: 0.16, filter: 500, filterType: 'lowpass' });
    },
    open:    function () {
      tone({ freq: 300, to: 1500, dur: 0.16, gain: 0.30, type: 'sawtooth', filter: 1800 });
    },
    close:   function () {
      tone({ freq: 1300, to: 240, dur: 0.15, gain: 0.28, type: 'sawtooth', filter: 1600 });
    },
    glitch:  function () {
      noise({ dur: 0.20, gain: 0.22, filter: 1100 });
      tone({ freq: 1400, to: 180, dur: 0.16, gain: 0.20, type: 'square' });
    },
    type:    function () { tone({ freq: U.rand(1500, 2100) | 0, dur: 0.012, gain: 0.07, type: 'square' }); },
    boot:    function () {
      tone({ freq: 110, to: 880, dur: 0.55, gain: 0.30, type: 'sawtooth', filter: 2000 });
      tone({ freq: 220, to: 1760, dur: 0.62, gain: 0.16, type: 'square', delay: 0.06 });
      noise({ dur: 0.5, gain: 0.06, filter: 2400 });
    },
    scan:    function () { tone({ freq: 2400, to: 900, dur: 0.06, gain: 0.10, type: 'sine' }); }
  };

  function play(name) {
    if (!enabled) return;
    var fn = bank[name];
    if (!fn) return;
    try { fn(); } catch (e) { /* 音频失败不影响功能 */ }
  }

  /* ── 开关 ── */
  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      ensure();
      play('toggle');
    }
    try { localStorage.setItem(STORE_KEY, enabled ? '1' : '0'); } catch (e) {}
    U.bus.emit('sound:change', enabled);
    return enabled;
  }
  function toggle() { return setEnabled(!enabled); }
  function isEnabled() { return enabled; }

  /* 读取用户上次选择（默认静音，符合"不打扰"原则） */
  function restore() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    enabled = saved === '1';
    return enabled;
  }
  restore();

  /* 首次任意手势时解锁 AudioContext */
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    root.addEventListener(evt, function unlock() {
      if (enabled) ensure();
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) {
        root.removeEventListener(e, unlock);
      });
    }, { once: false, passive: true });
  });

  CYBER.sound = { play: play, toggle: toggle, setEnabled: setEnabled, isEnabled: isEnabled };
})(window);
