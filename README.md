# GST·AI — NIGHT CITY DOSSIER

赛博朋克 2077 风格的**交互式个人简历单页**。纯 HTML / CSS / 原生 JavaScript，**零 npm 依赖、零构建**，双击 `index.html` 即可离线运行；字体与区块底图为**可选网络增强**，断网自动回退（见「素材与授权」）。

---

## 快速开始

| 方式 | 操作 |
|---|---|
| 最简单 | 直接双击工程根目录下的 `index.html` |
| 本地服务（推荐，字体与懒加载更稳定） | 在工程根目录执行 `python -m http.server 8080`，访问 `http://127.0.0.1:8080/` |

> 经典 `<script>` 顺序加载而非 ES Module，就是为了让 `file://` 双击打开也能正常工作（ES Module 在本地文件协议下会被 CORS 拦截）。

---

## 目录结构

```
ccc-main/
├─ index.html              外壳与语义结构（内容区多为空容器，由 JS 渲染）
├─ css/
│  ├─ tokens.css           设计令牌：配色 / 字体 / 字号阶梯 / 切角 / 缓动 / 层级
│  ├─ base.css             重置、排版、可访问性基线、通用关键帧（blink / fadeIn）
│  ├─ layout.css           背景层、HUD 框架、导航、区块骨架、跑马灯
│  ├─ components/          组件样式（按区块拆分，加载顺序即下表顺序）
│  │  ├─ primitives.css    通用基件：面板 / 故障文字 / 按钮
│  │  ├─ hero.css          01 STATUS：Hero 主视觉、数据条、身份卡、姓名纹章
│  │  ├─ profile.css       「关于我」卡片网格（图标 + 标签 + 值）
│  │  ├─ skills.css        02 SKILLS：技能条、雷达容器、能力参数
│  │  ├─ career.css        03 CAREER：时间线、可复用条目组件、徽章、荣誉奖项、教育条
│  │  ├─ works.css         04 WORKS：筛选条、作品卡、空状态提示
│  │  ├─ contact.css       05 CONTACT：频道复制列表、表单
│  │  └─ empty.css         数据缺失占位（诚实状态，不编造内容）
│  ├─ fx.css               CRT 叠加层、启动序列、准星、命令终端、Toast、打印样式
│  └─ responsive.css       断点适配（1180 / 980 / 760 / 480）+ 减弱动效 + 强制色彩模式
├─ js/
│  ├─ data/resume.js       ★ 唯一内容源，改简历只改这里
│  ├─ core/utils.js        DOM 助手、事件总线、帧循环、缓动、剪贴板、颜色工具、CYBER.VERSION
│  ├─ core/registry.js     模块注册表：CYBER.register(name, {order, init})，初始化顺序唯一来源
│  ├─ core/sound.js        WebAudio 程序化音效（零音频文件）
│  ├─ core/toast.js        HUD 通知
│  ├─ core/hints.js        无障碍提示（首次 Tab 快捷键）、减弱动效说明、控制台横幅
│  ├─ fx/background.js     Canvas 动态背景引擎
│  ├─ fx/reticle.js        自定义 HUD 准星
│  ├─ fx/scroll.js         滚动揭示、进度轨、区块侦测、HUD 自动收起
│  ├─ fx/tilt.js           3D 倾斜（[data-tilt] 事件委托，覆盖动态卡片）
│  ├─ fx/glitch.js         全局故障联动与 14–26s 随机调度（页面隐藏自动暂停）
│  ├─ ui/boot.js           启动序列
│  ├─ ui/nav.js            HUD 导航、主题与音效开关、时钟、跑马灯
│  ├─ ui/hero.js           01 STATUS：HUD 品牌位、Hero、身份卡、关于我九宫格、个人摘要
│  ├─ ui/skills.js         02 SKILLS：技能条、八轴雷达图、能力参数
│  ├─ ui/career.js         03 CAREER：相关经历（日期 + 徽章 + 查看职责）与荣誉奖项
│  ├─ ui/works.js          04 WORKS：技术栈筛选 + 作品卡
│  ├─ ui/contact.js        05 CONTACT：频道复制 + 表单校验
│  ├─ ui/terminal.js       命令终端（goto 区块清单运行时从 DOM 派生）
│  └─ app.js               编排层：按注册表顺序初始化、错误边界、广播 app:ready
├─ docs/
│  └─ optimization-review.md  重构建议报告（P0/P1/P2 共 53 条）
└─ assets/                 项目配图 work-1..4.jpg、分享预览图 og.png（1200×630，head 的 og:image 引用）；头像按需自行放入 avatar.jpg
```

---

## 架构与约定

**模块注册与初始化生命周期**
- 每个 JS 模块在文件末尾自注册：`CYBER.register('hero', { order: 50, init: init })`。
  `index.html` 的 `<script>` 顺序只保证「文件加载顺序」；初始化顺序统一由 `order` 决定，
  模块清单的唯一来源是 `js/core/registry.js`（不再有第二份清单需要同步）。
- 所有 `init()` 必须**幂等**：入口先 `if (inited) return;`，重复初始化不会重复绑定监听或重复渲染。
- `app.js` 的 `bootAll()` 逐个执行并隔离失败：命名空间缺失（`<script>` 没加载）与 `init` 抛错
  分开报错，单个模块失败不拖垮整页，全部结束后广播 `app:ready`。

**模块间通信**
- 单向 `UI → core`（sound / toast / scroll）允许直调，但必须做存在性防御：`if (CYBER.scroll && CYBER.scroll.goTo)`；
- 跨 UI 模块协作一律走事件总线 `U.bus`，不互相直接调用。现有事件：
  `boot:done` `boot:typed` `app:ready` `accent:change` `section:change` `sound:change`
  `bg:glitch` `term:open` `hero:reveal` `skills:reveal` `print:freeze` `print:resume`。
  其中 `print:freeze` / `print:resume` 由打印钩子（`beforeprint` / `afterprint`，见 `js/fx/scroll.js`）
  在打印开始 / 结束时广播：前者冻结打字机与随机故障、补齐揭示与展开状态，后者按原状态精确回滚。

**CSS 加载顺序契约**（`index.html` 的 link 块上方有同款注释，勿调整）

`tokens → base → layout → components/* → fx → responsive`（`responsive` 必须最后：断点与减弱动效补丁依赖最后加载）

**版本号**

唯一定义在 `js/core/utils.js` 的 `CYBER.VERSION`；启动面板与终端标题栏由 JS 回填，
`resume.js` 的 MOTD 属内容源，可独立维护。

**新增一个区块的检查清单**
1. `index.html`：加 `<section class="sect" id="…">` 与对应导航项；
2. `css/components/`：新增区块样式，或复用 `career.css` 的可复用条目组件（`.job*` / `.tl-*` / `.timeline`）；
   需要移动端适配时补 `responsive.css` 断点；
3. 逻辑层：新模块文件末尾 `CYBER.register('xxx', { order: N, init: init })`，
   并在 `index.html` 补一个 `<script>` 标签（终端 `goto` 会自动识别新 id，无需改其他清单）；
4. 内容一律进 `js/data/resume.js`，最后同步本 README 的目录树。

---

## 改内容

**只改 `js/data/resume.js`。** 里面是全部文本与数值，其余文件都是渲染逻辑。

```js
meta:      { name, nameCn, avatar, heroName, title, titleEn, brand, id,
             location, availability, dossierNo }
profile:   [{ ico, k, v, copy?, href? }]   // 「关于我」九宫格，建议刚好 9 条
idcard:    [{ k, v }]                      // 身份卡里的字段行
summary:   ['段落一', '段落二']
experience:[{ company, role, period, badge, badgeKey, points }]
awards:    [{ date, level, levelKey, title, cert }]
skills:    [{ name, short, level, years }]
attributes:[{ k, label, v }]
projects:  [{ name, code, year, desc, stack, tags, image, url, metric }]
```

约定：
- **【方括号】是占位符**：当前版本按「广东科学技术职业学院 · 人工智能应用专业 · 在读学生」预填了身份，`姓名 / 邮箱 / 手机 / 微信 / GitHub / 城市` 等带 `【】` 的字段需要换成真实信息后去掉括号。
- `meta.avatar` 留 `null` 时身份卡显示**姓名首字纹章**；填 `'assets/avatar.jpg'`（把照片放进 `assets/`）即自动启用照片，并叠加双色调与扫描线。
- `meta.heroName` 决定 Hero 大标题用 `'cn'` 中文名还是 `'en'` 拉丁名。中文名会自动放大字号并取消全大写转换。
- `profile[].copy: true` 给该卡片加复制按钮；`href` 把值渲染成外链。建议凑满 9 条，三列栅格刚好三行。
- `experience[].badgeKey` 取 `lead / senior / normal / intern`，决定徽章配色档位。
- `awards` 为空数组时「荣誉奖项」小节**整个隐藏**；填入后自动出现。`cert` 是证书链接，留 `null` 会显示「证书待补充」并提示补在哪。
- `projects[].stack` 用于**展示**完整技术栈；`tags` 用于**筛选**（建议每个项目 ≤2 个，否则筛选条会变长）。
- `projects[].metric` 形如 `{ label, value, unit }`，卡片里按「标签 → 数值 → 单位」渲染，不需要时留 `null`；`image` 留 `null` 时不写入图片属性，卡片 16:9 媒体区显示渐变底 + 居中描边的项目代号（悬停有扫光动效；配图可放 `assets/` 后填路径）。
- `projects[].url` 为**可选外链**（如仓库/演示地址）：有值时**整卡可点击**（标题渲染为 `<a target="_blank" rel="noopener noreferrer">`，`Tab` 聚焦标题、`Enter` 原生打开，标题后有常驻 ↗ 标识，悬停为手型光标，带 hover/焦点态与音效反馈），省略或留 `null` 则卡片为纯展示。
- **缺失的信息保持 `null` / `[]`**：页面会自动隐藏对应区块，或显示封存式「待补充」占位（访客只看到状态；URL 加 **`?edit=1`** 可展开字段填法与代码示例）。**不要填假数据。**

---

## 设计系统要点

| 项 | 值 |
|---|---|
| 主色（标题/高亮，占比 <10%） | `#fcee0a` |
| 交互色（链接/数据/准星） | `#00f0ff` |
| 危险色（错误/告警） | `#ff003c` |
| 背景梯度 | `#04010b → #0a0418 → #120726 → #1c0b3a → #27104f` |
| 标题字体 | Orbitron（Google Fonts，OFL） |
| 正文字体 | Rajdhani（OFL） |
| 数据/等宽 | Share Tech Mono（OFL） |
| 中文 | Noto Sans SC（OFL，按 unicode-range 自动分片，只下载用到的分片） |
| 缓动 | `cubic-bezier(.2,.9,.1,1)` 硬入硬出，**刻意不用柔和的 ease-in-out** |
| 时长 | 80 / 140 / 220 / 380 / 620 ms |

三种主题强调色（黄 / 青 / 红）通过 `<html data-accent>` 切换，选择会存进 `localStorage`。

---

## 动态背景

单张 Canvas，一次 rAF 循环内分层绘制：

`星野 → 数据雨 → 程序化天际线（离屏烘焙 + 少量闪烁窗）→ 地平线辉光 → 透视网格 → 浮尘粒子 → 扫描带 → 故障切片`

性能策略：
- DPR 上限 **2**（移动端 1.5）
- 帧率无关：所有位移用 `deltaTime` 驱动，`dt` 钳制在 0.05s 以内
- 天际线用**离屏 canvas 烘焙**，每帧只重绘 1–2 扇闪烁窗，而不是上千个窗格
- 粒子上限 90（移动端 36）；悬停/离开不重建对象
- `document.hidden` 时**停掉整个帧循环**；`prefers-reduced-motion: reduce` 时只画一帧静态图并隐藏 canvas
- 鼠标视差用指数趋近（`damp`）平滑，不直接跟随

---

## 交互清单

**首屏 / 全局**
- 启动序列：逐字打印 8 行日志 + 进度条；任意键补全，再按一次进入；同一会话内刷新会跳过
- 自定义 HUD 准星：跟随指针，悬停交互元素时放大旋转并显示 `ACTIVATE / INPUT / TARGET LOCKED / FILTER / EXPAND / COPY / DECRYPT`（作品卡悬停 = `TARGET LOCKED`）
- 赛博强化：作品卡/按钮悬停**四角括号收拢**、点击 **RGB 故障错位**、数据条**乱码翻牌**后落数、封存占位盖 **CLASSIFIED** 旋转图章、背景**霓虹汉字**（鬼/電脳/夜城/夢，品红远景层被楼宇遮挡）与**品红地平线辉光**、面板右上角 `SN-2.077 · ENC: AES-256` 元数据小字（全部尊重 `prefers-reduced-motion`）
- 赛博强化（第二批）：区块大标题**乱码解密入场**（滚动揭示时左→右定形，期间色差伪层暂停）、背景**飞行器光点**（红白闪烁 + 青色尾迹，每 9–18 秒穿梭一次，静态帧预置 1 架）、面板揭示**唤醒动效**（标题条扫入 + 边框青光）、筛选命中**弹匣弹跳**、媒体区/头像 **halftone 网点**、全局**胶片划痕层**（`fx-scratch`，随 fx-stack 打印隐藏）、区块编号后**危险斜纹 tape** 标记
- 赛博强化（第三批）：面板**马赛克解码入场**（steps(4) 分级去模糊）+ 揭示时**青色扫描带扫过**（动画后自删）、飞行器**拉烟**（8 段冷暖渐隐烟点）、面板**双角切**（右上+左下，新令牌 `--cut-tr-bl`）、面板标题行右端**点阵渐隐**、打字机换句前 **260ms 乱码解码**、右缘**竖排 HUD 代码**（`DOSSIER ACCESS // NIGHT CITY NET`，≤1359px 收起）、数据条末格**黄黑斜纹警示牌**、作品卡徽标升级 `FILE #01 · UNLOCKED/LOCKED`（锁态标对应有无 url）、`?edit=1` 代码示例**打字机式揭示**
- 顶部 HUD：向下滚动自动收起、向上滚动展开；导航游标滑动跟随；实时时钟；底部无缝跑马灯（悬停暂停）
- 滚动进度轨（青→黄→红渐变）、滚动揭示动画（同容器内自动错峰）
- 主题强调色循环、音效开关（状态存 localStorage）
- 打印 / 导出 PDF：终端 `resume` 指令与浏览器 `Ctrl+P` 走同一幂等路径 —— 打印前自动展开全部揭示与经历明细、
  打字机定格在首行完整文案、暂停随机故障（广播 `print:freeze`），打印结束后按原状态精确恢复（广播 `print:resume`）

**区块**
- 01 STATUS：Hero 打字机轮播、数据条数字滚动、身份卡鼠标 3D 倾斜 + 扫描光带 + （无照片时）姓名首字纹章；「关于我」九宫格悬停浮起、带标记的卡片可一键复制
- 02 SKILLS：技能条按顺序填充、八轴雷达图渐进入场后保持轻微呼吸、能力参数条
- 03 CAREER：相关经历用「日期标签 + 级别徽章 + 查看职责」版式，点击展开明细（默认展开最近一段），时间轴节点随展开状态点亮；荣誉奖项为同一套版式，带证书外链或「证书待补充」提示
- 04 WORKS：按技术栈筛选（带计数）、空状态提示与一键重置、卡片 3D 倾斜、悬停时配图从灰度转为彩色；条目 ≤2 时网格自动收窄（单卡变宽卡），无配图卡片显示描边代号并以悬停扫光替代去灰度动效；区块标题右侧有超大描边幽灵编号（<980px 隐藏、打印隐藏）
- 05 CONTACT：频道一键复制、表单实时校验（错误态同时用**颜色 + ⚠ 符号 + 文本**表达，不单靠颜色）、600 字上限、发送时模拟传输进度后唤起邮件客户端

**版式来源**
「关于我」的图标卡网格与「相关经历」的「日期标签 + 级别徽章 + 查看链接」条目，是按用户提供的版式参考图实现的；同时实现了配套的「荣誉奖项」小节，`awards` 为空时自动隐藏、有数据时自动出现。数据缺失的区块统一显示封存式占位块（字段填法与示例代码仅在 `?edit=1` 时可见），而不是渲染空壳或编造内容。

**命令终端（`Ctrl/⌘ + K`）**
支持 Tab 补全、`↑↓` 历史、别名。指令：`help` `profile` `about` `skills` `exp` `works` `contact` `mail` `goto` `theme` `sound` `glitch` `whoami` `date` `resume` `open` `ls` `sudo` `banner` `clear` `exit`。

**键盘快捷键**

| 键 | 作用 |
|---|---|
| `Ctrl/⌘ + K` | 开关命令终端 |
| `1` – `5` | 跳转到对应区块 |
| `T` | 循环主题强调色 |
| `M` | 开关音效 |
| `Esc` | 关闭终端 / 关闭移动端抽屉 |
| `Tab`（首次） | 弹出快捷键提示 |

---

## 可访问性

- 语义化结构：`header / nav / main / section / footer`，每个 section 有 `aria-labelledby`
- 跳转链接（skip link）、全部交互元素有可见焦点环（青色 2px outline）
- 技能条与属性条用 `role="meter"` + `aria-valuenow/min/max`
- 时间线手风琴用 `aria-expanded` / `aria-controls`；有 `url` 的作品卡**整卡可点**（标题为真外链：`Tab` 聚焦、`Enter` 新窗口打开），无 `url` 的卡片纯展示、无可聚焦假控件
- 表单错误用 `aria-invalid` + `role="alert"`，且不依赖单一颜色传达
- 颜色对比度以 WCAG 2.2 AA 为目标：正文 `#b0a9cf` on `#0a0418`；避免大面积纯黄文字
- 闪烁类动效频率远低于 3Hz；`prefers-reduced-motion: reduce` 时关闭 Canvas 背景、噪点、扫描线、故障与位移动画
- `forced-colors: active`（高对比度模式）下关闭故障伪元素、改用系统色
- 打印样式：自动隐藏所有 HUD / 背景 / 特效，输出干净的纸质简历（`终端 resume` 指令可直接调用）

---

## 音效

**没有任何音频文件。** 所有音效由 WebAudio 的振荡器与噪声缓冲实时合成（`js/core/sound.js`）：
`hover / click / toggle / confirm / error / open / close / glitch / type / boot / scan`。

这么做同时解决了两个问题：免费音效图库普遍**不允许热链**，以及音频文件体积。
默认静音（不打扰），首次用户手势后解锁 `AudioContext`，开关状态存 `localStorage`。

---

## 素材与授权

| 素材 | 来源 | 授权 |
|---|---|---|
| Orbitron / Rajdhani / Share Tech Mono / Noto Sans SC | Google Fonts | SIL OFL 1.1，可商用 |
| `assets/work-1..4.jpg` | 复用自同工作区 `resume/` 工程 | 项目自有素材 |
| `assets/og.png` | 按本工程配色本地绘制（GDI+，1200×630） | 项目自有素材，不含个人信息 |
| 区块氛围底图（Hero / Career） | Unsplash | Unsplash License，允许热链；已做紫色 multiply 双色调处理 |

> 底图是**可选装饰**：断网时不会报错，页面仍然完整可用（Canvas 背景与所有信息都在本地）。

---

## 已知取舍

- 命令终端的 `resume` 会调用 `window.print()`；打印样式已单独适配，导出 PDF 建议用 Chrome → 打印 → 另存为 PDF。
- 联系表单是纯静态页，不做后端提交：校验通过后拼接 `mailto:` 唤起本地邮件客户端。
- **没有使用任何非本人的占位头像**。身份卡默认显示姓名首字纹章；要换成自己的照片，把图片放进 `assets/avatar.jpg`，再把 `resume.js` 的 `meta.avatar` 改成 `'assets/avatar.jpg'` 即可（建议竖版方图，页面会自动做双色调与扫描线处理）。
- 旧简历工程遗留的头像素材已从本工程移除，避免误用他人照片。
