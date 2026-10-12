/* ═══════════════════════════════════════════════════════════════
   js/data/resume.js — 【唯一内容源】
   改简历只需要改这个文件，其余都是渲染逻辑。
   缺失的字段一律保持 null / []，渲染层会跳过或显示「待补充」，不做编造。

   ★ 当前身份：广东科学技术职业学院 · 人工智能应用专业 · 在读学生
   ★ 方括号【】里的内容是可替换的占位符，填好真实信息后删掉方括号即可。
   ═══════════════════════════════════════════════════════════════ */
window.CYBER = window.CYBER || {};

CYBER.data = {

  /* ── 基本信息 ── */
  meta: {
    /* 姓名：方括号里换成你自己的名字，例如 nameCn:'高翎翔' name:'GAO LINGXIANG' */
    name: 'YOUR NAME',
    nameCn: 'ccc',
    /* 头像：留 null 时显示姓名首字纹章；填 'assets/avatar.jpg' 即启用照片 */
    avatar: null,
    /* Hero 大标题用哪一档：'cn' 中文名 / 'en' 拉丁名 */
    heroName: 'cn',
    title: '人工智能应用专业 · 在读学生',
    titleEn: 'AI APPLICATION · UNDERGRADUATE',
    /* 顶部 HUD 品牌位用的短名 */
    brand: { name: 'GST·AI', sub: '在读学生' },
    id: 'GST-AI-202X',
    location: '广东',
    availability: 'OPEN TO INTERNSHIP',
    dossierNo: '#GST-AI'
  },

  /* ── Hero 打字机轮播 ── */
  typeLines: [
    '人工智能应用专业在读，主攻机器学习与计算机视觉方向。',
    '在校持续打磨 Python 与深度学习框架的工程能力。',
    '正在把课程项目沉淀成可展示的个人作品集。',
    '目标：用 AI 解决真实场景的问题，欢迎实习与合作。'
  ],

  /* ── Hero 数据条（v 可为数字，也可为文字；文字会直接显示、不滚动）── */
  stats: [
    { k: '身份', v: '在读学生', u: '' },
    { k: '院校', v: '广东科学技术职业学院', u: '' },
    { k: '专业', v: '人工智能应用', u: '' },
    { k: '状态', v: '求职准备中', u: '' }
  ],

  /* ── 关于我 · 九宫格（版式参考「图标 + 标签 + 值」卡片网格）
     字段按本工程实际掌握的信息组织，缺的一律不填；方括号为占位符 ── */
  profile: [
    { ico: 'NAME',  k: '姓名',     v: 'ccc' },
    { ico: 'ROLE',  k: '当前身份', v: '在读学生' },
    { ico: 'SCH',   k: '院校',     v: '广东科学技术职业学院' },
    { ico: 'MAJOR', k: '专业',     v: '人工智能应用' },
    { ico: 'LOC',   k: '所在城市', v: '广东 · 【珠海】' },
    { ico: 'MAIL',  k: '邮箱',     v: '【you】@example.com', copy: true },
    { ico: 'TEL',   k: '手机',     v: '【138 0000 0000】',     copy: true },
    { ico: 'GH',    k: 'GitHub',   v: 'https://github.com/ttk-9527', href: 'https://github.com/ttk-9527' },
    { ico: 'FOCUS', k: '技术方向', v: '机器学习 · 计算机视觉' }
  ],

  /* ── 身份卡字段（取九宫格里最有识别度的几项，不重复堆砌）── */
  idcard: [
    { k: 'ROLE',       v: '在读学生' },
    { k: 'MAJOR',      v: '人工智能应用' },
    { k: 'SCHOOL',     v: '广东科学技术职业学院' },
    { k: 'FOCUS',      v: '机器学习 · CV' }
  ],

  /* ── 联系方式 ── */
  contact: {
    email:    '【you】@example.com',
    phone:    '【138 0000 0000】',
    github:   'github.com/【your-id】',
    wechat:   '【your-wechat】',
    location: '广东 · 【珠海】'
  },

  /* ── 个人摘要 ── */
  summary: [
    '广东科学技术职业学院 人工智能应用专业在读学生，方向为机器学习与计算机视觉。',
    '系统学习 Python、数据结构、深度学习与数据处理，正在把课程作业转化为可展示的项目。',
    '习惯用工程化方式复盘学习过程，目标是在毕业前积累扎实的 AI 应用落地经验。'
  ],

  /* ── 相关经历（版式参考「日期标签 + 级别徽章 + 查看链接 + 条目标题）
     badge = 徽章文案，badgeKey = 徽章配色档位 lead/senior/normal/intern
     学生可放：实习 / 校内项目 / 竞赛 / 社团等 ── */
  experience: [],

  /* ── 荣誉奖项 ── 无数据 → 留空数组，不显示该区块
     shape: { date, level, levelKey, title, cert } */
  awards: [],

  /* ── 教育 ── */
  education: '广东科学技术职业学院 · 人工智能应用专业（在读）',

  /* ── 技能矩阵 ── 空数组 → 显示「技能矩阵待补充」占位块
     shape: { name, short, level: 0-100, years } */
  skills: [],

  /* ── 能力参数（游戏化自评）── 空数组 → 与技能一并进入待补充 */
  attributes: [],

  /* ── 项目与作品 ── 空数组 → 显示「作品待补充」占位块
     stack = 展示用完整技术栈；tags = 筛选用粗粒度分类（建议每个项目 ≤2 个）
     image 无配图时保持 null（渲染层跳过图片属性，卡片走渐变占位）；不做编造
     url 可选：有值时卡片标题渲染为外链（新窗口打开），省略/null 即纯展示卡 ── */
  projects: [
    {
      name:  '算命 Skill 套件',
      code:  'SUANMING SKILL',
      year:  '2026',
      desc:  '托管于 GitHub 的公开仓库 —— Claude Code 算命 Skill 套件：fortune-telling 分发器按需调度六爻、梅花易数、塔罗、生命灵数、八字、求签、星座、生肖八个方法 Skill，知识库以《周易》、韦特塔罗等权威典籍为准，仅在用户显式请求时调用。',
      stack: ['Claude Code', 'Agent Skills', 'Slash Commands', 'Markdown'],
      tags:  ['AI', '公开仓库'],
      image: null,
      url:   'https://github.com/ttk-9527/suanming-skill',
      metric: { label: '一个分发器调度', value: '8', unit: '个方法 Skill' }
    }
  ],

  /* ── 底部跑马灯 ── */
  ticker: [
    'AI APPLICATION MAJOR · 广东科学技术职业学院',
    'PYTHON / MACHINE LEARNING / COMPUTER VISION',
    'CURRENTLY <i>OPEN TO INTERNSHIP</i>',
    'BUILDING PERSONAL PORTFOLIO',
    'COURSE PROJECTS → <b>SHIPPABLE</b>',
    'STUDENT · GST',
    'LEARN · BUILD · SHIP'
  ],

  /* ── 终端欢迎语 ── */
  termMOTD: [
    'DOSSIER SHELL v2.077 — 已建立安全链路。',
    '输入 <b>help</b> 查看全部指令，<b>Tab</b> 补全，<b>↑↓</b> 历史。'
  ]
};
