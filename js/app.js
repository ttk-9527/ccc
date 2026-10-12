/* ═══════════════════════════════════════════════════════════════
   js/app.js — 应用编排层（唯一职责：启动与错误边界）
   · 模块清单的唯一来源是各模块自己的 CYBER.register()（js/core/registry.js），
     本文件不再维护第二份清单；
   · bootAll 按 register 的 order 逐个初始化，单个模块失败不拖垮整页；
   · 全部就绪后广播 'app:ready'；
   · 表现层交互已拆出：3D 倾斜 → js/fx/tilt.js、故障联动 → js/fx/glitch.js、
     无障碍提示与控制台横幅 → js/core/hints.js。
   加载顺序由 index.html 决定（经典 script，双击即可离线运行）。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER, U = CYBER.utils;

  /* ────────── 模块初始化（注册表驱动，单个失败不拖垮整页）────────── */
  function bootAll() {
    var missing = [];   // 文件未加载 / 导出被覆盖：命名空间缺失
    var failed = [];    // init() 执行期抛错
    var started = [];

    CYBER.moduleList().forEach(function (m) {
      var ns = CYBER[m.name];
      if (!ns || typeof ns.init !== 'function') {
        missing.push(m.name);
        console.error('[app] 模块命名空间缺失（<script> 未加载或导出被覆盖）:', m.name);
        return;
      }
      started.push(m.name);
      try {
        ns.init();
      } catch (e) {
        failed.push(m.name);
        console.error('[app] 模块初始化失败:', m.name, e);
      }
    });

    var bad = missing.concat(failed);
    if (bad.length) {
      var msg = '部分模块加载失败：' + bad.join(' / ');
      /* toast 自身可能不可用，防御一下 */
      if (CYBER.toast && CYBER.toast.warn) CYBER.toast.warn(msg, { key: 'BOOT', ms: 5000 });
      else console.error('[app]', msg);
    }

    U.bus.emit('app:ready');
    return { started: started, missing: missing, failed: failed };
  }

  /* ────────── 启动 ────────── */
  function main() {
    if (!CYBER.data) {
      console.error('[app] 数据层未加载：js/data/resume.js 缺失或解析失败');
      /* F2：不依赖数据层的最小用户可见提示（empty-state 样式），
         杜绝「骨架 + 一屏 —」的静默失败；DOM 直造，不依赖 toast */
      try {
        var hint = document.createElement('div');
        hint.className = 'empty-state';
        hint.setAttribute('role', 'note');
        hint.innerHTML =
          '<span class="empty-state__code">DATA SOURCE ERROR</span>' +
          '<h3 class="empty-state__title">数据层未能加载</h3>' +
          '<p class="empty-state__desc">js/data/resume.js 未加载或解析失败 — 请检查文件是否完整后刷新页面。</p>';
        var host = document.getElementById('main') || document.body;
        if (host) host.appendChild(hint);
      } catch (e) { /* 兜底提示自身失败时至少保留 console 记录 */ }
      return;
    }
    bootAll();
    initRuntimeReporter();
  }

  /* ────────── F3：全局错误与未处理 Promise 异常（去重后用户可见）────────── */
  function initRuntimeReporter() {
    var seen = {};
    function report(msg) {
      if (!msg || seen[msg]) return;   // 同一会话同一消息只提示一次
      seen[msg] = true;
      console.error('[runtime]', msg);
      if (CYBER.toast && CYBER.toast.warn) {
        CYBER.toast.warn('运行时异常：' + msg, { key: 'RUNTIME', ms: 5200 });
      }
    }
    window.addEventListener('error', function (e) { report(e.message); });
    window.addEventListener('unhandledrejection', function (e) {
      report((e.reason && (e.reason.message || String(e.reason))) || '异步操作失败');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})(window);
