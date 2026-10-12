/* ═══════════════════════════════════════════════════════════════
   js/core/registry.js — 模块注册表（初始化清单的唯一来源）
   各模块在文件末尾自注册：
     CYBER.register('hero', { order: 50, init: init });
   约定：
   · index.html 的 <script> 顺序只保证「文件加载顺序」；
   · 初始化顺序统一由 def.order 决定（数值小的先 init），app.js 按序执行；
   · 新增模块只需「加 <script> 标签 + 自身 register」，不再改 app.js 的清单。
   加载顺序：必须在 utils.js 之后、任何业务模块之前。
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CYBER = root.CYBER = root.CYBER || {};

  var mods = [];
  var seq = 0;

  /**
   * 注册一个模块
   * @param {string} name  模块名，必须与 CYBER[name] 导出的命名空间一致
   * @param {{order:number, init:function}} def  order 决定初始化顺序（缺省 1000）
   */
  CYBER.register = function (name, def) {
    if (!name || !def || typeof def.init !== 'function') {
      console.error('[registry] 非法模块注册:', name, def);
      return;
    }
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].name === name) {
        console.error('[registry] 模块重复注册:', name);
        return;
      }
    }
    mods.push({
      name: name,
      order: typeof def.order === 'number' ? def.order : 1000,
      seq: seq++
    });
  };

  /** 按初始化顺序返回已注册模块快照 [{name, order}]（同 order 按注册先后） */
  CYBER.moduleList = function () {
    return mods.slice().sort(function (a, b) {
      return a.order - b.order || a.seq - b.seq;
    });
  };

  /** 已注册模块名（按初始化顺序），供控制台横幅等自检输出 */
  CYBER.moduleNames = function () {
    return CYBER.moduleList().map(function (m) { return m.name; });
  };
})(window);
