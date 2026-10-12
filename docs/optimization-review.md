# ccc-main 优化建议报告（非个人信息类）

> **审阅范围**：`ccc-main/` 全量通读 — `index.html`（411 行）、`README.md`（192 行）、`css/` 6 文件（tokens / base / layout / components / fx / responsive，合计约 73.5 KB）、`js/` 16 文件（app + core×3 + data×1 + fx×3 + ui×7，合计约 120 KB）、`assets/` 4 张配图（约 633 KB）。
>
> **明确排除（按任务约定，以下内容不在本报告中出现任何建议）**：姓名 / 邮箱 / 手机 / 微信 / 头像 / 学校等个人信息，以及 `README.md` 与 `resume.js` 中 `【】` 占位符相关内容。本报告只谈结构、代码、性能、可访问性、SEO、健壮性与文档一致性。
>
> **硬约束（所有建议必须满足）**：零依赖、零构建、双击 `index.html` 以 `file://` 离线可运行。
> 因此：**禁止改用 ES Module / `import`（`file://` 下被 CORS 拦截，README 第 14 行已说明）**；CSS 拆分只能用多个 `<link>` 并列（不要 `@import` 串联）；不允许引入运行时 npm 依赖或打包步骤。
>
> **优先级定义**：
> - **P0** — 影响项目核心承诺的缺陷，重构第一步必须处理；
> - **P1** — 功能 / 可访问性 / 一致性的明显问题，本轮重构应处理；
> - **P2** — 优化与工程卫生，可在本轮或后续处理。
>
> 每条建议格式：**文件路径（含行号）→ 问题 → 可执行改法**，可被后续重构直接采纳。

---

## 现状良好的部分（重构时请保持）

- `js/core/utils.js` 的事件总线 `bus.emit` 对单个订阅者 `try/catch`（67 行）、帧循环 `loop` 对每个订阅 `try/catch`（135 行）、`app.js` 的模块初始化逐个 `try/catch`（28–35 行）——三层错误边界思路正确。
- 数据渲染统一走 `U.el(..., {text})` 走 `textContent`，转义函数 `esc` 用在 `html` 路径上（如 `terminal.js`），XSS 面控制得好。
- `prefers-reduced-motion` 覆盖较完整（Canvas 单帧、打字机静态、揭示动画直出、`forced-colors` 适配）。
- 数据缺失时显示 `emptyState` 占位而不是空壳（`skills.js` / `career.js` / `works.js`），设计意图清晰。
- 图片有 `loading="lazy"`、`work__media` 有固定 `aspect-ratio: 16/9`（无 CLS）。

---

## A. `js/app.js` 编排层、模块耦合与命名空间

### A1 [P1] 模块初始化顺序存在「双份清单」，两处不同步会静默失效
- **文件**：`js/app.js:12–24`（`MODULES` 数组）、`index.html:394–409`（16 个 `<script>` 顺序）
- **问题**：同一份「模块顺序」写了两遍。新增模块时若只在 `index.html` 加了 `<script>` 而忘了在 `MODULES` 里登记，该模块**不会初始化也无任何报错**；反之亦然。`MODULES` 里还存在注册了但 DOM 依赖顺序的隐式约定（如 `nav` 必须在 `hero` 前、`background` 必须先于 `nav.applyAccent` 触发 `accent:change`），这些约定只存在于注释里。
- **改法**：
  1. 在 `js/core/utils.js`（或新建 `js/core/registry.js`，并在 `utils.js` 之后加载）里增加注册 API：
     ```js
     CYBER.register = function (name, def) {   // def = { order: Number, init: Function }
       (CYBER._mods = CYBER._mods || []).push({ name: name, def: def });
     };
     ```
  2. 每个模块文件末尾由 `CYBER.hero = { init }` 改为同时 `CYBER.register('hero', { order: 50, init: init })`；`index.html` 的 script 顺序只保证「文件加载顺序」，初始化顺序统一由 `order` 决定。
  3. `app.js` 的 `bootAll` 改为 `CYBER._mods.sort((a,b)=>a.def.order-b.def.order)` 后逐个执行，删除 `MODULES` 数组。
  4. `bootAll` 执行前先断言 `CYBER[name] && typeof CYBER[name].init === 'function'`，缺失时把「文件未加载」与「init 抛错」分开报错。
- **收益**：新增/删除模块只改一处；仍保持经典 `<script>`（`file://` 可用）。

### A2 [P1] 二次访问时 `boot:done` 先于订阅者发出，Hero 打字机延迟 6 秒
- **文件**：`js/ui/boot.js:124–129`（`alreadyBooted()` 分支同步 `U.bus.emit('boot:done')`）、`js/ui/hero.js:263–268`（订阅 `boot:done` + 6 秒兜底 `setTimeout`）
- **问题**：`app.js` 的 `bootAll` 按序同步执行，`boot.init()`（第 1 个）在「本会话已启动过」时**同步 emit**，而 `hero.init()`（第 5 个）还没运行到订阅那一行 → 事件丢失。结果：同会话第二次访问/刷新时，打字机只能靠 6 秒兜底定时器启动，前 6 秒 Hero 副标题空白。
- **改法**（任选其一，推荐 1）：
  1. `boot.js` 已启动分支改为 `setTimeout(function () { U.bus.emit('boot:done'); }, 0);`（宏任务晚于整个同步 `bootAll`，此时所有订阅者已就位）；
  2. `CYBER.boot` 导出 `isDone()`，`hero.js` 订阅前先判断 `if (CYBER.boot.isDone()) startTyping();`；
  3. `app.js` 在 `bootAll` 末尾统一 emit `boot:ready`，把「已跳过启动序列」作为状态而非事件处理。

### A3 [P1] 所有模块 `init()` 不幂等，重复初始化会重复绑定监听与重复渲染
- **文件**：`js/ui/hero.js:238–274`（`renderStats` 内 `U.bus.on('hero:reveal')`）、`js/ui/skills.js:38–42, 67–71`（`renderBars`/`renderAttrs` 内 `U.bus.on('skills:reveal')`）、`js/ui/nav.js:95–175`（`bind()` 直接 addEventListener）、`js/ui/works.js:144–148`（直接向 `grid` 追加卡片，不先清空）
- **问题**：模块没有 `destroy`，也没有 `inited` 守卫。任何一次二次 `init()`（重构后热更新、测试脚本、未来功能「重渲染」）都会：监听器翻倍、`#works-grid`/`#skill-bars` 内容翻倍、同一个 DOM 绑两次 click。
- **改法**：每个模块统一模式：
  ```js
  var inited = false;
  function init() { if (inited) return; inited = true; /* ... */ }
  CYBER.register('skills', { order: 50, init: init, reset: reset }); // reset 可选
  ```
  渲染型函数（`render*`）入口先 `U.clear(box)`（`career.js:146` 已这样做，`works.js` 未做）。

### A4 [P2] `app.js` 职责偏多，可拆为「编排 + 交互效果」两层
- **文件**：`js/app.js:43–84`（3D 倾斜）、`87–113`（全局故障联动 + 随机调度）、`116–144`（无障碍提示与 console 横幅）
- **问题**：文件头注释声明职责是「模块初始化、错误边界、跨模块全局交互」，但 tilt/glitch 是纯表现层，随功能增长会让编排层继续膨胀；随机故障的 `setTimeout` 递归调度（106–112）也无从关停。
- **改法**：拆出 `js/fx/tilt.js`、`js/fx/glitch.js`（各自 `CYBER.register`，order 在 `background` 之后），`app.js` 只保留 `bootAll` + 错误边界 + `app:ready`。同时给 glitch 调度器暴露 `stop()`，在 `document.hidden` 时暂停（当前仅跳过 emit，定时器仍空转）。

### A5 [P2] 跨模块直接互调无存在性防御，事件总线与直调混用没有约定
- **文件**：`js/ui/nav.js:103`（→ `CYBER.scroll.goTo`）、`js/ui/terminal.js:159, 170, 178, 193`（→ `CYBER.scroll` / `CYBER.nav` / `CYBER.sound`）、`js/ui/career.js:83`、`js/ui/works.js:171` 等
- **问题**：模块对象在文件加载时即存在，所以 `init` 失败不会导致 `undefined`；但**文件本身加载失败**（顺序写错、文件被删）时，这些直调会抛 TypeError，落在运行期（不在 `bootAll` 的错误边界内）。同时「用事件还是用直调」没有约定，后续重构容易越耦越紧。
- **改法**：
  1. 在 README / `docs/architecture` 中写明约定：**单向 UI → core（sound/toast/scroll）允许直调；跨 UI 模块协作一律走 `U.bus`**；
  2. 对确需直调的地方加防御：`if (CYBER.scroll && CYBER.scroll.goTo) CYBER.scroll.goTo(id);`（至少覆盖 `terminal.js` 的 `theme`/`goto` 命令路径，命令异常虽有 `exec` 的 `try/catch`，但体验是「指令报错」而非「功能缺失」）。

### A6 [P2] 视图状态写回数据层（`data` 被当作渲染缓存）
- **文件**：`js/ui/hero.js:100`（`s._node = num`）
- **问题**：`CYBER.data` 定位是「唯一内容源、纯数据」（`resume.js:1–8`），渲染器把 DOM 节点挂到数据对象上，使数据不可序列化、不可被其他消费者安全读取（例如未来把 `stats` 输出到终端命令时会带上 `_node`）。
- **改法**：模块内用 `var statNodes = [];` 局部数组保存引用，`renderStats` 里 `statNodes.push(num)`，`hero:reveal` 回调里按索引取。

### A7 [P2] 首次 Tab 快捷键提示因 `{once:true}` 而基本不会出现
- **文件**：`js/app.js:119–127`
- **问题**：`document.addEventListener('keydown', handler, { once: true })` 在**任意第一次按键**后即移除监听；handler 内 `if (shown || e.key !== 'Tab') return;` 说明只有第一次按键恰好是 Tab 才会提示。用户先按任意其他键后，该提示永久失效（`shown` 标志因此也成了死代码）。
- **改法**：去掉 `{ once: true }`，在真正弹出提示后手动 `document.removeEventListener('keydown', handler)`（`shown` 标志保留）。

---

## B. CSS 按区块的组织与拆分

### B1 [P1] `components.css` 35 KB / 1158 行混合 10+ 个区块职责，按区块拆分
- **文件**：`css/components.css`（35,262 B，1158 行）
- **问题**：单文件承载 面板 / 故障文字 / 按钮 / Hero / 身份卡 / STATUS 双栏 / SKILLS / CAREER / WORKS / CONTACT / 关于我 / 时间线徽章 / 空状态 / 纹章，改动任何区块都要在 1100+ 行里翻找，也与任务要求的「CSS 按区块组织」不符。
- **改法**：拆为 `css/components/` 下多个文件（保持现有选择器与规则**逐字迁移**，不改行为），`index.html:23–28` 用多个 `<link>` 按下列顺序加载（零构建，`file://` 完全可用）：
  | 新文件 | 迁移来源（components.css 行号） |
  |---|---|
  | `primitives.css` | 面板 1–57、故障文字 59–90、按钮 92–140 |
  | `hero.css` | HERO 142–242、身份卡 244–374、纹章 1126–1158 |
  | `profile.css` | 关于我卡片网格 904–994 |
  | `skills.css` | STATUS 双栏残留 376–382（清理见 B2）、SKILLS 427–536 |
  | `career.css` | CAREER 538–648、徽章/动作链接/条目 996–1069 |
  | `works.css` | WORKS 650–787 |
  | `contact.css` | CONTACT 789–902 |
  | `empty.css` | 空状态占位 1071–1124 |
  - `layout.css` 保持「背景层 / HUD / 导航 / 区块骨架 / 跑马灯」；`fx.css` 保持「启动序列 / 准星 / 终端 / Toast / 打印」。
  - 同步更新 README「目录结构」一节（否则触发 G 类不一致）。
  - 注意：`@media print` 与 `prefers-reduced-motion` 的跨文件覆盖顺序因此变得更敏感 → 必须配合 B5 的顺序契约。

### B2 [P1] 死选择器 / 死类名清理（跨 CSS、HTML、JS 三处）
- **文件与证据**：
  1. `css/components.css:377–382` `.status-grid` + `css/responsive.css:18` —— 全仓库无任何元素带该类（`index.html` 的首屏栅格类是 `.hero`）；
  2. `css/components.css:385–425` `.chan-list` / `.chan` / `.chan__ico` / `.chan__k` / `.chan__v` / `.chan__copy`、`css/responsive.css:111–112`、`js/fx/reticle.js:19` 的 `'.copy-item__btn, .chan__copy'` —— CONTACT 实际渲染的是 `.copy-item`（`contact.js:47`），`.chan*` 系列已废弃；
  3. `css/responsive.css:76` `.job__side` —— 任何 CSS/HTML/JS 都未生成该元素；
  4. `index.html:308` `class="panel panel--chan"` —— CSS 中不存在 `.panel--chan` 规则（仅 `.panel` 基础规则生效）。
- **问题**：死代码增加维护成本；`reticle.js` 里还残留一条永远不会命中的悬停规则，说明类名重构没有清干净。
- **改法**：删除上述 1–3 的规则块；第 4 项二选一 —— 要么删除该修饰类，要么补一条确有差异的规则（当前 CONTACT 两个面板视觉靠 `.panel--form`/`grid` 布局，无差异化需求，建议直接删类名）。

### B3 [P2] CRT 效果层与「布局骨架」混在 `layout.css`，`blink` 关键帧跨文件隐式依赖
- **文件**：`css/layout.css:32–105`（`.fx-stack` / 扫描线 / 噪点 / 暗角 / 色差 / 故障闪）、`css/layout.css:266–274`（`@keyframes blink`，被 `css/components.css:365` `.idcard__status i` 复用）、`css/layout.css:98–105`（`body.is-glitching`）
- **问题**：`fx.css` 的职责是「特效」，但体积最大的 CRT 叠加层却在 `layout.css`；`blink` 定义在 layout、消费在 components，文件间形成隐式顺序依赖（若按 B1 拆文件或调整 `<link>` 顺序，`components.css` 先于 `layout.css` 时关键帧仍可用，但读者无从判断归属）。
- **改法**：把 `.fx-stack` 系列与 `body.is-glitching` 迁到 `fx.css`；把 `@keyframes blink` 与 `@keyframes fadeIn` 等通用关键帧迁到 `base.css`（基线文件天然最先加载）。迁移后同步 README 中两文件的职责描述。

### B4 [P2] 变量拼写错误：`--ls-width`
- **文件**：`css/components.css:645` `letter-spacing: var(--ls-width, var(--ls-mid));`
- **问题**：`--ls-width` 未在 `tokens.css` 定义，永远走 fallback，字距意图（`--ls-wide: 0.12em`，见 `tokens.css:60`）实际未生效。
- **改法**：改为 `letter-spacing: var(--ls-wide);`，并全仓 grep `var(--ls-` 确认无其他未定义变量。

### B5 [P2] 文件加载顺序是隐式契约，需要写成显式规则
- **文件**：`css/responsive.css:135–137`（注释：「必须放在最后，否则会被 layout.css 覆盖」）、`index.html:23–28`
- **问题**：`responsive.css` 内含 `!important` 补丁来对抗加载顺序，B1 拆分后 `<link>` 数量增至 10+，顺序一旦调整就会出现「减弱动效失效」这类难查问题。
- **改法**：在 README 与 `index.html` 的 link 块上方各写一条注释契约：`tokens → base → layout → components/* → fx → responsive（必须最后）`；可选：给 `index.html` 加一个构建期外的自检（见 H4）。

### B6 [P2] 同一段说明文案在 HTML 中重复两份
- **文件**：`index.html:214`（`.sect__sub`「条形长度 = 熟练度评分…」）与 `index.html:221`（`.panel__note` 同文案）
- **问题**：两份硬编码文案，修改其一忘掉其二即不一致（当前完全相同，用户会连读两遍）。
- **改法**：保留 `.panel__note` 的面板内说明，`.sect__sub` 改为差异化文案（如说明「数据来源与更新方式」），或将两处文案统一移到 `resume.js` 的配置字段（见 F5「内容源唯一性」）。

---

## C. 性能（Canvas 背景、字体与图片、资源体积）

### C1 [P1] Canvas 背景每帧产生大量临时对象（渐变 ×3 + `rgba()` 字符串数百次）
- **文件**：`js/fx/background.js`
  - 每帧新建渐变：`320`（scrim）、`330`（地平线辉光）、`361`（扫描带）；
  - 每帧拼接颜色字符串：星野 `262`（约 150 次/帧）、数据雨 `285–288`（约 200+ 次/帧）、浮尘 `351`（约 90 次/帧）、闪烁窗 `313`。
- **问题**：60 fps 下每秒上万次字符串拼接 + 数百个渐变对象创建，触发 GC 停顿，在移动端/低端机上是页面最重的持续开销（与 README「性能策略」的初衷相悖——它优化了绘制量，却没优化分配量）。
- **改法**：
  1. 三个线性渐变只依赖 `W/H/horizon/accent` → 把创建移到 `resize()` 与 `accent:change` 中，缓存为 `scrimGrad / horizonGrad / sweepGrad` 模块级变量（扫描带渐变每帧只平移位置，可改为缓存固定渐变 + `translate` 或用 `ctx.fillRect` 前 `setTransform`）；
  2. 颜色字符串预计算：星野/浮尘的颜色在构建时（`buildStars/buildDots`）就把 `rgba(...)` 拼好存进对象，闪烁窗按 `bl.col` 缓存一个 `Map`；
  3. `hexToRgb`/`rgba`（background.js:34–43）与 `hexA`（skills.js:191–196）是重复实现 → 上提到 `utils.js` 一份。

### C2 [P1] 渲染阻塞的外部字体 CSS 与首屏竞争带宽，`file://` 离线体验依赖回退栈
- **文件**：`index.html:19–21`（Google Fonts 4 字族样式表）、`css/layout.css:351–363`（两张 Unsplash 底图，1920 宽，Hero 底图首屏即请求）
- **问题**：
  1. `fonts.googleapis.com` 的 CSS 是渲染阻塞资源，网络慢时首屏文字（回退字体）先出、字体后换，产生布局跳动；断网时 `file://` 打开要等连接超时才回退（回退栈 `PingFang SC/Microsoft YaHei` 已配好，功能不坏，但视觉与联网态差异大）；
  2. README 称「零依赖」，实际存在 3 个网络请求依赖（字体 CSS、字体文件、2 张底图），虽可降级但未在「快速开始」中说明。
- **改法**：
  1. **拉丁三字体本地化**（Orbitron / Rajdhani / Share Tech Mono 均为 OFL，woff2 合计约 70–90 KB）：下载放入 `assets/fonts/`，改用 `@font-face` + `font-display: swap`（`tokens.css` 已定义 `--font-display/body/mono`，只改字体定义处）；Noto Sans SC 体积大且按 unicode-range 分片，**保留 Google Fonts 或直接依赖系统中文回退**（二选一，README 写明取舍）；
  2. Unsplash 底图改为「`load` 事件后再注入」：CSS 中只保留渐变，脚本（如 `scroll.js` 或新 `fx/decor.js`）在 `window.onload` 后给 `.sect__bg--hero/--circuit` 追加带 URL 的类，首屏字体/脚本不再与底图抢带宽；离线时直接跳过（`Image.onerror`），保持 README「底图可选」的承诺；
  3. 若不做本地化，至少在 README「快速开始」补一行：字体与底图为可选网络增强，离线自动回退。

### C3 [P2] 数据雨每帧约 240 次 `fillText`，可离屏精灵化
- **文件**：`js/fx/background.js:269–290`
- **问题**：`ctx.font` 每帧设置一次、每个字形单独 `fillText` + 单独 `fillStyle`，是背景引擎里最碎的绘制循环。
- **改法**：启动时把 `GLYPH` 字符串渲染进一张离屏 canvas（按颜色分 2–3 张），每帧改为 `drawImage` 取字形；或把每列整条雨画成一个 `Path`/一次 `fillText(整串)`（颜色渐变用列首列尾两段拼接）。属于锦上添花，P2。

### C4 [P2] 近乎不透明的条形上仍挂全宽 `backdrop-filter`
- **文件**：`css/layout.css:450–453`（`.hud-bottom` 背景 `rgba(4,1,11,0.97)` + `backdrop-filter: blur(6px)`）、`css/responsive.css:44–46`（抽屉背景 `0.98` + `blur(12px)`）、`css/layout.css:151–153`（`.hud-top` 背景 `0.94→0.62` 渐变 + `blur(10px)`）
- **问题**：0.97/0.98 不透明度下背景模糊几乎不可见，却让合成器每帧对全宽区域做模糊采样；移动端抽屉的 `blur(12px)` 尤其贵。
- **改法**：删掉 `.hud-bottom` 与移动抽屉的 `backdrop-filter`（视觉差异 ≈ 0）；`.hud-top` 保留但可降到 `blur(6px)`，并加 `@media (max-width:760px)` 关闭（移动端导航打开时才显形，静止时不值得花这个开销）。

### C5 [P2] 全屏混合模式叠加层（噪点 + 扫描线）在移动端持续重绘
- **文件**：`css/layout.css:39–76`（`.fx-scanlines` `mix-blend-mode: multiply` + `::after` 扫掠、`.fx-noise` `inset:-50%`（4 倍视口面积）+ `mix-blend-mode: overlay` + `0.6s steps(2)` 位移动画）
- **问题**：两个全屏 blend 层 + 持续位移动画会让低端移动 GPU 持续合成，与背景 Canvas 叠加后总开销明显。
- **改法**：在 `responsive.css` 的 ≤760px 断点把 `.fx-noise` 动画停掉（保留静态噪点，`opacity` 可再降），`.fx-scanlines::after` 扫掠降频或仅桌面保留；确保 `prefers-reduced-motion` 分支继续覆盖（现 `responsive.css:137–146` 已处理，迁移时勿丢）。

### C6 [P2] `[data-reveal]` 常驻 `will-change`，数十个元素同时占用合成层
- **文件**：`css/base.css:133–141`
- **问题**：`will-change: opacity, transform` 写在初始态规则里，揭示完成后**不会自动移除**，整页所有 `data-reveal` 元素长期驻留合成层，吃显存。
- **改法**：`transitionend` 后移除：`node.addEventListener('transitionend', () => node.style.willChange = 'auto', {once:true})`（在 `scroll.js:33` 加 `is-in` 处）；或干脆删掉该行（元素数量多时收益小于成本）。

### C7 [P2] 滚动进度轨每帧写样式 + 每帧写 ARIA 属性
- **文件**：`js/fx/scroll.js:42–49`
- **问题**：rAF 内 `fill.style.width = ...`（本身有 `transition: width 90ms linear`，`layout.css:305`，transition 与逐帧更新叠加属于双份平滑）且每帧 `setAttribute('aria-valuenow', ...)`——该元素非 live region，属性高频变更纯属浪费（读屏用户不会感知 1% 的进度变化）。
- **改法**：去掉 CSS 里的 `transition`（rAF 已经足够平滑）或去掉 rAF 内的样式写入只留 transition；`aria-valuenow` 改为变化 ≥10% 才写一次。

### C8 [P2] 图片体积与请求尺寸
- **文件**：`assets/work-1..4.jpg`（204 KB / 111 KB / 256 KB / 60 KB，合计 633 KB）、`css/layout.css:354,360`（`w=1920` 的 Unsplash 图）
- **问题**：作品卡在桌面端最大宽度约 600 px（`work-grid` 300px 起 + 16:9），256 KB 的 `work-3.jpg` 远超展示所需；目前 `projects: []` 为空这些图不会被请求，一旦填入项目即变成实打实的 600+ KB 传输。
- **改法**：保持 JPG（零构建、无转换步骤）前提下用任意离线工具压到长边 ≤1200 px、质量 70–80；Unsplash 参数从 `w=1920` 降到 `w=1280`（底图仅作 0.22–0.30 透明度的雾气层，画质冗余极大）。给 `works.js:13–18` 的 `img` 补 `width/height` 属性（CSS 已有 aspect-ratio 兜底，属防御性）。

### C9 [P2] 筛选后重新入场的错峰索引用了全局下标
- **文件**：`js/ui/works.js:90–102`
- **问题**：`cards.forEach(function (c, i)...)` 里 `i` 是**全部卡片**的下标（含被过滤隐藏的），延迟取 `Math.min(i, 8) * 40`，筛选后可见卡片的错峰顺序与视觉顺序不一致（例如只剩最后两张时，它们仍按全局位置拿到延迟）。
- **改法**：先收集 `visibleCards` 数组再按其下标分配延迟。

---

## D. 可访问性

### D1 [P0] 打印 / 导出 PDF 会输出「空白 + 折叠 + 被过滤」的简历
- **文件**：`css/fx.css:314–321`（@media print）、`css/base.css:133–141`（`.js-reveal [data-reveal]{opacity:0}`）、`css/components.css:609–615`（`.job__body` `grid-template-rows:0fr` 折叠）、`css/components.css:696`（`.work.is-filtered-out{display:none}`）、`js/ui/boot.js`（`终端 resume` → `window.print()`，`terminal.js:223–229`）
- **问题**：README 与终端都主推「`resume` 指令直接打印 / 另存 PDF」，但打印样式只隐藏了 HUD/特效，**没有处理内容可见性**：
  1. 没滚动到的区块，`[data-reveal]` 仍是 `opacity:0` → 打印出来整段消失；
  2. 时间线明细默认折叠（`grid-template-rows:0fr` + `overflow:hidden`，高度为 0）→ 只有默认展开的第一段经历会打印，其余「职责」全部丢失；
  3. 若用户在 WORKS 用了筛选，`is-filtered-out` 的项目在打印稿里直接消失；
  4. Hero 打字机正打到一半时，打印稿里的副标题是**残句**（`hero.js:198–227` 无 `beforeprint` 收尾）。
- **改法**（打印是核心承诺，优先级最高）：
  1. `fx.css` 的 `@media print` 追加：
     ```css
     @media print {
       .js-reveal [data-reveal] { opacity: 1 !important; transform: none !important; }
       .job__body { grid-template-rows: 1fr !important; }
       .work.is-filtered-out { display: grid !important; }
       .sect__bg, .fx-noise, .fx-scanlines { display: none !important; }
     }
     ```
  2. `js/ui/scroll.js` 或 `js/app.js` 监听 `window.addEventListener('beforeprint', ...)`：给所有 `[data-reveal]` 补 `is-in`、给所有 `.job-row` 补 `is-open`、把打字机停在第一行完整文案（`matchMedia('print')` 亦可，`beforeprint` 兼容性更好）；
  3. 验证命令：填入 ≥2 段 `experience` 后 `终端 → resume` → 打印预览逐页核对（见文末验证清单）。

### D2 [P1] `--ink-4` 以 9–11px 大量使用，对比度约 2.5:1，远低于 README 声称的 WCAG 2.2 AA
- **文件**：`css/tokens.css:26`（`--ink-4: #514b70`）；消费点：`components.css:224`（`.stat__k`）、`407`（`.chan__k`→将删）、`445`（`.bar__meta`）、`826`（`.copy-item__k`）、`890`（`.field__count`）、`901`（`.form__hint`）、`958`（`.profile-card__k`）、`layout.css:179/204/425`（品牌副行、导航序号、`.block__sub`）、`fx.css:107/213`（`.boot__skip`、`.term__hint`）
- **计算**：`#514b70`（相对亮度 ≈0.080）on `#0a0418`（≈0.002）→ 对比度 **≈ 2.5:1**；9–11px 小字要求 4.5:1。`--ink-3 #7d76a1` ≈4.8:1（擦线通过）。
- **问题**：README「可访问性」一节声称「以 WCAG 2.2 AA 为目标」，实际标签类小字全部不达标，属于文档与实现互相矛盾。
- **改法**：
  1. `tokens.css` 将 `--ink-4` 提亮到 **`#857eb0`（≈5.4:1）**，至少不低于 `#7d76a1`（4.8:1）；`--ink-3` 可同步微调；
  2. 提亮后在 3 种 accent 主题下人工核对（尤其 `html[data-accent="cyan"]` 上的 `--accent-soft` 背景）；
  3. 用 DevTools Accessibility 面板或 `npx pa11y file:///...` 复核全页文本对比度；同步修正 README 中「正文 #b0a9cf on #0a0418」之外的遗漏说明。

### D3 [P1] 启动序列：`aria-live` 逐字播报 + `aria-modal` 对话框无焦点约束
- **文件**：`index.html:61`（`role="dialog" aria-modal="true"`）、`index.html:68`（`<pre id="boot-log" aria-live="polite">`）、`js/ui/boot.js:58–85`（逐字符 `textContent` 更新）、`js/ui/boot.js:142/154`（显式放行 Tab）
- **问题**：
  1. 打字期间每 ~11ms 改一次 live region 内容 → 读屏软件反复朗读半截日志（即使 polite 会合并，也会形成连串播报噪音）；
  2. 声称 `aria-modal` 却**不锁焦点**：用户按 Tab，焦点落到遮罩背后的 header/main（boot.js 特意对 Tab `return`），背景内容可被读屏与键盘触达，违反对话框语义；
  3. 遮罩背后内容未加 `inert`。
- **改法**：
  1. 打字阶段 `logEl.setAttribute('aria-live','off')`，`onTypingEnd()`（boot.js:52–55）时一次性改为 `polite` 并写入一条完整摘要（或直接保留 `aria-hidden="true"` + 旁边放一个 `role="status"` 的 sr-only 文本「档案载入完成」）；
  2. 显示遮罩时给 `header/main/footer` 加 `inert`（现代浏览器原生支持，零依赖），`dismiss()` 时移除；或实现最小焦点环：Tab 循环在 `.boot__enter` 与跳过按钮之间；
  3. `role="progressbar"` 已正确（index.html:69），保持。

### D4 [P1] HUD 自动收起 / 移动抽屉可能把「正在聚焦的元素」藏到屏幕外
- **文件**：`css/layout.css:157`（`.hud-top.is-hidden{transform:translateY(-100%)}`，由 `scroll.js:52–57` 滚动添加）、`css/responsive.css:49`（抽屉关闭态 `transform:translateY(-115%)`，但链接仍可 Tab 到）
- **问题**：键盘用户 Tab 到导航链接的瞬间，若 HUD 恰好处于收起态，焦点框在屏幕外（违反 WCAG 2.4.7 可见焦点）；≤760px 下关闭的抽屉里，导航链接 `transform` 移出视口却未 `visibility:hidden`，Tab 仍会进入不可见链接。
- **改法**：
  ```css
  .hud-top:focus-within { transform: none; }          /* layout.css */
  @media (max-width: 760px) {
    .hud-nav { visibility: hidden; transition: transform var(--dur-4) var(--ease-snap), visibility 0s linear var(--dur-4); }
    .hud-nav.is-open { visibility: visible; transition-delay: 0s; }
  }
  ```
  （或对抽屉关闭态直接加 `inert`，由 `nav.js:setDrawer` 切换。）

### D5 [P1] 作品卡可聚焦、可按 Enter，但没有任何实际动作
- **文件**：`js/ui/works.js:39–44`（`tabindex:'0'` + `aria-label`）、`js/ui/works.js:185–192`（Enter/Space 只播放音效 + 触发故障）
- **问题**：README 声称「作品卡可 Tab 聚焦、Enter 触发」（README:156），实际触发的只是视听效果——一个没有可感知结果的可聚焦元素对键盘/读屏用户是「假控件」（WCAG 2.1.1 / 4.1.2 语义存疑），且 `aria-label` 让读屏把它读成一个有名称的控件。
- **改法**（择一，推荐 1）：
  1. 数据模型加可选 `project.url`（`resume.js` 的 `projects` shape，**不涉及个人信息**）：有 URL 时卡片标题渲染成 `<a>`（外链 `target="_blank" rel="noopener noreferrer"`），Enter 天然可用；无 URL 时去掉 `tabindex` 与 keydown 监听，卡片降级为纯展示（`article` 仍可被读屏浏览）；
  2. 保持纯展示：移除 `tabindex="0"` 和 185–192 的 keydown 分支，同步改 README:156 的描述。
  - 无论哪种，`filter-row` 的 chips（`aria-pressed`，index.html:288）保持现状——那才是真控件。

### D6 [P2] 跳转链接指向 `#status` 而非 `<main>`
- **文件**：`index.html:34`（`<a class="skip-link" href="#status">`）、`index.html:123`（`<main id="main">` 无 `tabindex="-1"`）、`js/ui/boot.js:102–106`（运行时才补 `tabindex`）
- **问题**：惯例与语义上应跳到主内容容器；`main` 静态缺 `tabindex="-1"` 导致「已跳过启动序列」的访问路径（boot.js:124–129）下 `main` 从未获得可编程焦点的能力。
- **改法**：`href="#main"`；`<main id="main" tabindex="-1">` 直接写在 HTML 里；`base.css:65–66` 已有 `#main:focus{outline:none}`，无需改动。

### D7 [P2] 自定义准星未接入 `prefers-reduced-motion`
- **文件**：`js/fx/reticle.js:53–80`（仅判断 `finePointer`，rAF 阻尼循环常驻）、`css/fx.css:155–159`（`cursor:none` 无媒体条件）
- **问题**：减弱动效偏好下，Canvas/噪点/故障都停了，唯独准星仍持续做插值动画并隐藏系统光标——与 README「reduce 时关闭位移动画」的承诺不一致。
- **改法**：`reticle.init()` 开头加 `if (U.reducedMotion()) { node.style.display='none'; return; }`；`cursor:none` 规则改为 `@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)`。同时监听 `matchMedia` 变化（可选）。

### D8 [P2] 雷达图 `aria-label` 硬编码「八项」
- **文件**：`index.html:227`（`aria-label="八项技术栈能力雷达图"`）
- **问题**：轴数由 `D.skills.length` 决定（`skills.js:113`），数据增删后标签说谎（与「不编造内容」的项目原则冲突）。当前 `skills:[]` 时面板整体隐藏，问题在填数据后暴露。
- **改法**：`skills.js` 渲染时 `cvs.setAttribute('aria-label', D.skills.length + ' 项技术栈能力雷达图，明细见下方图例')`（`renderLegend` 已提供完整文本数据，保持不变）。

### D9 [P2] Toast 可能被双重播报
- **文件**：`index.html:383`（`#toast-stack` 有 `aria-live="polite"`）与 `js/core/toast.js:30`（每个节点 `role="status"` 也是 live region）
- **问题**：插入到 live 容器中的 live 节点存在重复朗读风险（不同读屏行为不一）。
- **改法**：二选一——容器保留 `aria-live`、节点改 `role="presentation"`；或容器去掉 `aria-live`、节点保留 `role="status"`（推荐后者，语义粒度更准）。

### D10 [P2] `aria-current` 取值建议用 `page`
- **文件**：`js/ui/nav.js:20`（`setAttribute('aria-current', on ? 'true':'false')`）
- **问题**：`true` 合法但语义泛化；本导航是页内章节导航，读屏对 `page` 的处理更明确（页内区块也可用 `location`）。
- **改法**：`'page'` / 移除属性（非当前项直接 `removeAttribute('aria-current')`，避免 `aria-current="false"` 的冗余输出）。

---

## E. SEO / 分享元信息

### E1 [P1] 分享无预览图：缺 `og:image` 与 `twitter:card`
- **文件**：`index.html:11–13`（仅有 `og:title/description/type`）
- **问题**：链接发到社交/聊天工具时只出纯文本标题，作为「在线简历」传播场景受损；OG 是最基础的分享元信息，缺失与 README 的「对外展示」定位不匹配。
- **改法**：
  1. 出一张 1200×630 的分享图（内容为页面视觉：标题文字 + 赛博朋克底色，**不含任何个人信息**），存 `assets/og.png`（建议与作品图一并压缩）；
  2. `<head>` 增加：
     ```html
     <meta property="og:image" content="assets/og.png">
     <meta property="og:image:width" content="1200">
     <meta property="og:image:height" content="630">
     <meta name="twitter:card" content="summary_large_image">
     <meta name="twitter:title" content="GST·AI — NIGHT CITY DOSSIER">
     <meta name="twitter:description" content="赛博朋克风格交互式个人简历">
     ```
  3. 注意：`file://` 下相对路径的 `og:image` 对爬虫无效——若部署到 GitHub Pages/静态托管，需补绝对 URL（见 E2）。

### E2 [P2] 缺 `canonical` / `og:url`，`og:type="profile"` 兼容性一般
- **文件**：`index.html:11–13`
- **改法**：
  1. 部署地址确定后补 `<link rel="canonical" href="...">` 与 `<meta property="og:url" content="...">`；
  2. `og:type` 建议改 `website`（`profile` 类型要求 `profile:*` 扩展字段，多数分享器不解析，容易被判为无效标签）；
  3. 可加 `<meta property="og:site_name" content="NIGHT CITY DOSSIER">`。
- **说明**：结构化数据 JSON-LD（`schema.org/Person`）字段基本由个人信息构成，按任务约定**不在本报告范围**。

### E3 [P2] `document.title` 的拼装逻辑散落在 UI 模块里
- **文件**：`js/ui/hero.js:52`（`fillStatic()` 里拼 `document.title`），静态标题在 `index.html:6`
- **问题**：SEO/head 相关逻辑住在「01 STATUS 的 UI 模块」，后续改标题、补元信息的人不会想到去 `hero.js`；静态 `<title>` 与 JS 覆盖值也分处两地无同步机制。
- **改法**：新建 `js/core/meta.js`（或并入 `app.js` 的 `main()`）统一负责 `document.title`、（未来）`og:*` 运行时同步；`hero.js` 删除 52 行。`index.html` 静态标题保持为「无 JS / 爬虫可见」的基准，二者用同一份拼装规则（数据来自 `CYBER.data.meta` 的字段结构，具体取值不变）。

---

## F. 健壮性与错误处理

### F1 [P1] 单条数据形状不合规会让整个区块模块报废
- **文件与触发点**：
  1. `js/ui/career.js:61–62` `item.points.map(...)` —— `experience` 某条缺 `points`（README 明示可留空）→ TypeError → 被 `bootAll` 捕获，**整个 CAREER 区块（含教育条 `edu-text` 的回填，career.js:141）全部不渲染**；
  2. `js/ui/works.js:41` `(item.tags || item.stack).join('|')` —— 两者皆缺 → **整个 WORKS 区块报废**（筛选条 + 所有卡片）；
  3. `js/ui/contact.js:15` `var C = D.contact;` 后直接 `C.email` —— `contact` 为 `null`（README 允许留空）→ **整个 CONTACT 模块报废，连表单校验都失效**；
  4. `js/ui/hero.js:200` `D.typeLines[typeIdx % D.typeLines.length]` —— `typeLines` 为空 → `% 0 = NaN` → 打字机 setTimeout 内抛错（**不在 bootAll 错误边界内**，只被 `window.onerror` 打到 console）。
- **改法**（统一「数据防御层」）：
  ```js
  // career.js
  (item.points || []).map(...)
  // works.js
  var tags = item.tags || item.stack || [];
  // contact.js
  var C = D.contact || {};
  // hero.js
  if (!D.typeLines || !D.typeLines.length) return;   // typeStep 入口
  ```
  更彻底的做法：在 `app.js main()` 里、`bootAll()` 之前跑一个轻量 `validateData(D)`（`utils.js` 新增），对 `experience/awards/skills/projects/contact/typeLines` 做数组/对象类型检查，输出 `console.warn` + `toast.warn` 指出具体字段，而不是让模块半路炸掉。

### F2 [P1] 数据层缺失时静默失败，用户只看到一屏「—」
- **文件**：`js/app.js:147–151`（`if (!CYBER.data) { console.error(...); return; }`）
- **问题**：`resume.js` 语法错误 / 加载失败时，页面照常显示骨架与所有占位「—」，无任何用户可见提示（noscript 提示只覆盖 JS 被禁用的场景）；对「双击打开即可用」的核心承诺而言这是最坏的失败形态。
- **改法**：
  1. `main()` 失败分支里用**不依赖数据**的最小 DOM 提示兜底（直接向 `body` 插入一个带 `.empty-state` 样式的节点：「数据层 `js/data/resume.js` 未能加载，请检查文件是否完整」）；
  2. 同时 `bootAll` 的失败提示（`app.js:36–38`）需防御 toast 自身不可用：`if (CYBER.toast && CYBER.toast.warn) CYBER.toast.warn(...) else alert(...)`。

### F3 [P2] 全局错误处理只写 console，且未覆盖 Promise 异常
- **文件**：`js/app.js:157–159`
- **改法**：
  ```js
  function report(msg) { /* 去重后 toast.warn，key:'RUNTIME'，每会话同一消息只提示一次 */ }
  window.addEventListener('error', e => report(e.message));
  window.addEventListener('unhandledrejection', e => report((e.reason && e.reason.message) || '异步操作失败'));
  ```
  注意：复制、图片 `onerror`、音效等已各自 `catch`，不会打扰用户；这里只兜真正的漏网之鱼。

### F4 [P1] `history.replaceState` 在 `file://`（Chrome）抛 `SecurityError`，导航点击处理中断
- **文件**：`js/ui/nav.js:104`（`history.replaceState(null, '', '#' + id)`，位于 click 处理器中间）
- **问题**：项目主推「双击 `index.html` 以 `file://` 打开」（README:3, 14），而 Chrome 已不支持在 `file://` 文档里用 `replaceState` 写入带 URL 的历史状态（[Stack Overflow: History replaceState no longer working in Chrome for local file](https://stackoverflow.com/questions/32398578/history-replacestate-no-longer-working-in-chrome-for-local-file)、[SecurityError when calling history.replaceState() in a file:/// context](https://github.com/servo/servo/issues/35827)），会抛 `SecurityError: ... origin 'null'`。异常发生在 `setDrawer(false)` / `setActive(id)` **之前**：
  - 桌面：点击导航后控制台报错，活动态只能等 `scroll.js` 的区块侦测补救；
  - 移动端（≤760px）：抽屉**不会关闭**，继续盖住内容——直接的功能缺陷。
- **改法**：
  ```js
  try { history.replaceState(null, '', '#' + id); }
  catch (e) { /* file:// 不支持，降级为不改写地址栏（滚动与高亮逻辑不受影响） */ }
  ```
  或统一降级：`if (location.protocol !== 'file:') history.replaceState(...)`。全仓仅此一处调用（已 grep 确认），修复成本极低。**验证**：`file://` 打开 → 点导航 → 无控制台报错、移动端抽屉正常关闭。

### F5 [P2] 「唯一内容源」原则的三处例外
- **文件**：
  1. `js/ui/boot.js:8–17` —— 8 行启动日志文案（含档案标识行）硬编码在逻辑文件里；
  2. `js/ui/terminal.js:246–248` —— `ls` 命令列出 `skills.json · experience.json · projects.json ...` 等**工程中并不存在的文件**，与 `resume.js` 唯一内容源的事实矛盾（彩蛋可以保留，但会误导使用者去找这些文件）；
  3. `index.html:214/221` —— 见 B6。
- **改法**：
  1. 启动日志数组移到 `resume.js`（如 `bootLines: [...]`，`boot.js` 只读取并保留 `cls` 结构），使「改内容只改 resume.js」（README:54）重新成立；
  2. `ls` 输出改为真实结构（`./js/data/resume.js — 唯一内容源`、`./css/…`），或明确标注 `(示意)`；
  3. B6 的文案同样入数据层。

### F6 [P2] 版本号字符串散落 5 处
- **文件**：`index.html:65`、`index.html:370`、`js/ui/boot.js:9`、`js/app.js:138`、`js/ui/terminal.js:271`（另有 `resume.js:122` 的 MOTD 属数据层，可保留）
- **改法**：`CYBER.VERSION = '2.077'` 在 `utils.js`（或 `resume.js` 的 `meta` 配置）定义一次；`index.html` 两处静态文案由 JS 回填（boot/term 面板本就由脚本初始化），或接受「HTML 静态文案不参与版本联动」并在 README 记录该约定。

### F7 [P1] 技能条揭示存在多条「永远不触发」的静默失败路径
- **文件**：`js/ui/skills.js:281`（`if (!setupCanvas()) return;` 位于观察器注册之前）、`js/ui/skills.js:295–298`（else 分支仅在 `skills.length < 3` 时才 `U.bus.emit('skills:reveal')`）
- **问题**：`renderBars` / `renderAttrs` 的宽度填充（`skills.js:38–42, 67–71`）完全依赖 `skills:reveal` 事件，而该事件只有两条发射路径：
  1. 雷达面板进入视口（`IntersectionObserver`）；
  2. `skills.length < 3` 的 else 分支。
  于是以下情形都会让**技能条与能力参数条永远停留在 0 宽**（页面看起来像「数据坏了」，却无任何报错）：
  - `skills.length >= 3` 但运行环境无 `IntersectionObserver`（else 分支条件不满足，不 emit）；
  - `radar-canvas` 缺失或 `getContext('2d')` 返回 null（`setupCanvas()` 失败 → `:281` 直接 `return`，观察器根本没注册）。
  当前 `skills:[]` 时走空数据占位分支不触发；一旦按 README 填入 ≥3 条技能，风险即暴露。
- **改法**：把「能否画雷达」与「是否揭示技能条」解耦，任何回退路径都保证 emit：
  ```js
  var canRadar = skills.length >= 3 && setupCanvas();
  if (canRadar) drawRadar(0);
  U.bus.on('accent:change', function () { if (canRadar) drawRadar(curScale || 1); });
  var panel = U.$('.panel--radar');
  if (canRadar && panel && root.IntersectionObserver) {
    var io = new IntersectionObserver(/* ... 同现状 ... */);
    io.observe(panel);
  } else {
    U.bus.emit('skills:reveal');   // 无条件回退，不再区分 length<3
  }
  ```
  验证：临时把 `skills` 填 3 条并禁用 `IntersectionObserver`（`delete window.IntersectionObserver` 后刷新），技能条仍应完成填充动画。

---

## G. README 与实际结构一致性

### G1 [P1] 快速开始与目录结构写的是不存在的根目录 `cyber-resume/`
- **文件**：`README.md:11`（`双击 cyber-resume/index.html`）、`README.md:12`（`在 cyber-resume/ 下执行 python -m http.server`）、`README.md:21`（目录树根 `cyber-resume/`）
- **问题**：实际工程根目录是 `ccc-main/`，照 README 操作直接失败——这是新使用者接触的第一段文档。
- **改法**：三处统一改为 `ccc-main/`（或用相对表述：「双击工程根目录下的 `index.html`」「在工程根目录执行…」，从根上避免目录改名再次失效）。

### G2 [P2] 目录树需补充 `docs/`
- **文件**：`README.md:20–48`
- **改法**：本报告落盘于 `ccc-main/docs/optimization-review.md` 后，目录树追加：
  ```
  └─ docs/
     └─ optimization-review.md   重构建议报告（P0/P1/P2）
  ```
  另核对：README 树中 JS 文件共 16 个，与实际一致（任务描述中的「14」与实际不符，以 README/实际的 16 为准）。

### G3 [P2] 「零依赖」表述与实际网络依赖不完全一致
- **文件**：`README.md:3`（零依赖）、`README.md:177–183`（素材与授权，已承认字体/底图来自网络）
- **改法**：第 3 行改为「零 npm 依赖、零构建；字体与区块底图为**可选网络增强**，离线自动回退到系统字体与纯渐变（见『素材与授权』）」。若采纳 C2 的字体本地化，则可写「除可选的中文字体分片外完全离线」。

### G4 [P2] 交互清单两处承诺与实现不符
- **文件**：`README.md:147`（「`Tab`（首次）→ 弹出快捷键提示」）与 `js/app.js:119–127`（A7 的 `{once:true}` bug，实际几乎不触发）；`README.md:156`（「作品卡可 Tab 聚焦、Enter 触发」）与 `works.js:185–192`（D5，触发无实际结果）
- **改法**：以「修代码使文档为真」为准：A7、D5 修复后保持 README 文案；若选择 D5 的方案 2（移除可聚焦性），同步改 README:156 为「作品卡为展示型条目，筛选与焦点交互见筛选条」。

### G5 [P2] 「已知取舍」含开发机绝对路径与历史工程细节
- **文件**：`README.md:192`（记录了本机 `D:\...` 绝对路径与旧工程遗留说明）
- **改法**：精简为与本工程相关的通用表述（如「工程不含任何第三方头像素材；如需照片放入 `assets/avatar.jpg` 并在 `resume.js` 中启用」），移除开发机专属路径，避免在其他机器上产生不可达引用。

### G6 [P2] README 结构描述需与 B1 拆分同步
- **文件**：`README.md:26–29`（css 各文件职责）、`README.md:39–46`（js 各文件职责，`app.js` 描述含「3D 倾斜、故障联动」——若采纳 A4 拆分需同步）
- **改法**：所有结构性改动（B1/A4/F5/F6）完成后统一过一遍 README 两棵树 + 「设计系统要点」表格，把 README 纳入重构验收项（见验证清单）。

---

## H. 可维护性与扩展性

### H1 [P1] 「区块」存在三份注册信息，新增一个区块要改 5 处
- **文件**：`index.html:92–99`（导航静态 5 项 + `data-nav`）、`index.html:126/206/244/277/296`（section `id`）、`js/ui/terminal.js:151–153`（`goto` 的 `ids` 数组与 alias 表硬编码）、`js/app.js:12–24`（初始化清单）、`index.html:394–409`（script 标签）
- **问题**：同一个「有哪几个区块」的知识维护在 3 个独立位置（导航、终端、初始化清单），漏改一处的表现分别是：终端 `goto` 报「未知区块」、模块不初始化、导航缺失——且都没有类型/构建期检查兜底。
- **改法**：
  1. **导航与 section 静态保留在 HTML**（这是无 JS 降级的正确做法，不建议 JS 生成）；
  2. `terminal.js:151` 改为运行时派生：`var ids = U.$$('main .sect').map(function (s) { return s.id; });`，alias 表保留（它表达的是语义别名，与区块清单正交）；
  3. 初始化清单按 A1 改为自注册；
  4. 结果：新增区块只需「HTML 加 section + 导航项 + script 标签 + css 分区」，逻辑层零改动；把剩余步骤写成 H3 的检查清单。
- **验收**：终端 `goto skills` / `goto 废弃id` 行为与现在一致；导航 1–5 快捷键（`nav.js:143–145` 从 DOM 取 `items`，已天然同步）不变。

### H2 [P2] 数据形状只靠注释，缺可被编辑器/校验器消费的类型
- **文件**：`js/data/resume.js:56–67`（README 的 shape 表格 + 注释）
- **改法**：在 `resume.js` 顶部加 JSDoc `@typedef`（`Meta` / `ProfileItem` / `ExperienceItem` / `AwardItem` / `SkillItem` / `ProjectItem` / `ContactInfo`），`CYBER.data` 标 `@type {ResumeData}`。零运行时成本，VS Code/Cursor 即可获得补全与形状错误提示；配合 F1 的 `validateData` 形成「编辑期 + 运行期」双保险。

### H3 [P2] 缺「如何新增一个区块 / 改一块样式」的维护文档
- **改法**：新增 `docs/maintenance.md`（或 README 一节），内容至少包括：
  1. 新增区块的完整检查清单（对应 H1 修完后的 4 步 + responsive.css 断点 + README 同步）；
  2. CSS 文件顺序契约（B5）；
  3. 手动冒烟清单（见本文末「验证清单」）；
  4. 明确「禁止引入 ES Module / 构建工具」的约束及原因（README:14 已有原因，收进约束清单）。

### H4 [P2] 无任何静态检查；可引入「仅开发期」工具而不违反零依赖
- **改法**：「零依赖」指**运行时**。可选加 `package.json`（`private: true`）只装 devDependencies，不参与任何构建产物：
  - `eslint`（`env: browser, es5`，校验 IIFE/严格模式）；
  - `html-validate` 或 `pa11y`/`lighthouse-ci`（对照 D 类修复做回归）；
  - 一个 20 行的 Node 脚本 `scripts/check-structure.js`：断言 `index.html` 的 `<script>` 顺序 = 自注册清单、`<link>` 顺序满足 B5、README 目录树与 `fs.readdir` 一致（顺带防 G1 复发）。
  - 若团队不想出现 `package.json`，则至少把 H3 的手动冒烟清单落成 `docs/qa-checklist.md`。

### H5 [P2] 区块「版式/文案/能力」的扩展点没有统一入口
- **现状**：新增一个与 CAREER 同版式的小节（如「项目证书」）需要同时理解 `career.js` 的 `buildJob/buildAward` 双分支、`components.css` 的 `job*`/`tl-*` 命名、`empty-state` 占位约定——这些约定是隐性的。
- **改法**：在 B1 拆分时为公共件命名归档：`.job*`/`.tl-*`/`.timeline` 抽成 `career.css` 内明确的「可复用条目组件」注释区（或独立 `entry-item.css`），并在 H3 文档里画出「条目型区块」的复用路径：`data 数组 → buildItem() → timeline 容器 → emptyState 兜底`。同时把 `badgeKey/levelKey` 的允许值（`lead/senior/normal/intern`，`career.js:39/116` + `components.css:1007–1010`）写进 typedef（H2），避免新增档位时漏加 CSS。

---

## 附 1：建议实施顺序（供重构直接排期）

| 顺序 | 条目 | 理由 |
|---|---|---|
| 1 | D1（打印空白/折叠） | 核心承诺（导出 PDF）当前不可用 |
| 2 | F4（replaceState/file://）、A2（boot 时序）、F1/F2（数据防御与静默失败）、F7（技能条揭示回退） | `file://` 与「双击可用」主路径的功能缺陷 |
| 3 | A1 + H1（注册表统一）、A3（幂等） | 后续所有重构的结构前提 |
| 4 | B1 + B2 + B5（CSS 拆分与清理）+ G1/G2（README 同步） | 依赖 3 的结构定型 |
| 5 | D2–D5（可访问性）、E1（分享图） | 独立推进，验收明确 |
| 6 | C1（Canvas 分配）、C2（字体/底图） | 性能优化，视觉回归风险需单独验证 |
| 7 | 其余 P2 | 视时间安排 |

## 附 2：重构验收 — 手动验证清单

1. **`file://` 主路径**：双击 `index.html`（Chrome + Firefox 各一次）——无控制台报错（重点验证 F4）；断网重开——字体/底图回退、页面完整（验证 C2 的降级）。
2. **打印导出**：填入 ≥2 段 `experience`、≥3 个项目并执行一次筛选 → 终端 `resume` → 打印预览逐页核对：所有区块可见、经历明细展开、被筛选掉的项目也在（验证 D1）。
3. **键盘/读屏**：Tab 走查（跳转链接 → 导航 → 工具按钮 → 表单），确认无「焦点不可见」（D4）、无「假控件」（D5）；启动序列期间焦点不逃到遮罩后（D3）。
4. **二次访问**：同会话刷新 → Hero 打字机 ≤0.5s 启动（A2）。
5. **数据健壮性**：把 `experience` 某条 `points` 置空、`projects` 某条去掉 `stack/tags`、`contact` 置 `null` → 对应区块显示占位而非整块消失，其余区块不受影响（F1）。
6. **对比度**：DevTools Accessibility 或 `pa11y` 扫描全页，文本项 ≥4.5:1（D2）。
7. **README**：按「快速开始」逐步操作一遍，目录树与实际文件一致（G1/G2）。

## 附 3：本报告明确不涉及的内容

- 一切关于姓名 / 邮箱 / 手机 / 微信 / 头像 / 学校等个人信息的取值、展示与建议；
- `README.md` 与 `js/data/resume.js` 中 `【】` 占位符相关内容；
- 依赖个人信息的结构化数据（如 `schema.org/Person` JSON-LD）。
