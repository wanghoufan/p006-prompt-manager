import type { Card } from '@/lib/types'

function iso(daysAgo: number, hoursAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString()
}

export const DEMO_CARDS: Card[] = [
  {
    id: 'demo-001',
    title: 'React 代码审查助手',
    code: 'code-review',
    body: `你是一名资深前端工程师，负责代码审查。请审查下面这段代码：
1. 指出潜在的性能问题与内存泄漏风险
2. 指出可读性和维护性问题
3. 给出具体的优化建议，附修改后的代码示例
要求：回答使用 markdown 格式，先总评再逐条分析。`,
    tags: ['代码审查', '性能优化'],
    rating: 5,
    copyCount: 42,
    thinkingSummary:
      '该提示词采用「专家角色 + 多维审查清单 + 输出约束」的框架：先以资深工程师身份建立权威性，再用三个编号问题锚定审查维度（性能、可读性、优化建议），最后约束输出格式为 markdown 并明确回答顺序。值得借鉴的是用「先总评再逐条」的结构控制回答节奏，让审查结论可执行、可对照。',
    notes: '在提 PR 前自查时使用；可直接把 diff 全量贴进去。结论优先用来排「必修」与「建议」，不一定要逐条采纳。',
    versions: [
      { id: 'demo-001-v1', body: '你是一名资深前端工程师，请审查下面这段代码，指出问题并给出优化建议。', createdAt: iso(18) },
      { id: 'demo-001-v2', body: '你是一名资深前端工程师，请审查下面这段代码：\n1. 指出性能问题\n2. 指出可读性问题\n3. 给出优化建议', createdAt: iso(9) },
    ],
    createdAt: iso(21),
    updatedAt: iso(2, 3),
  },
  {
    id: 'demo-002',
    title: '产品需求拆解顾问',
    code: 'prd-split',
    body: `现在你是一名资深产品经理。我将向你描述一个产品想法，请你：
1. 帮我梳理目标用户与核心痛点
2. 提出 3 个可行的功能方案并对比
3. 给出 MVP 范围建议与验收标准
请用结构化的方式回答，先给结论再展开。`,
    tags: ['角色扮演', '需求分析'],
    rating: 4,
    copyCount: 18,
    thinkingSummary:
      '采用角色扮演框架，将抽象的产品想法投射到资深产品经理的职责视角，通过三连问（用户、方案、MVP）把开放性讨论收敛为结构化输出。亮点是「先给结论再展开」，以及把验收标准显式化，适合任何需要把模糊需求落地的场景。',
    notes: '适合在脑子只有一个朦胧想法、需要快速形成初步方案时使用。如果你已经有详细 PRD，直接给需求文档比用这条更高效。',
    versions: [],
    createdAt: iso(19),
    updatedAt: iso(4),
  },
  {
    id: 'demo-003',
    title: '文章要点总结器',
    code: 'summary',
    body: `请用 markdown 格式总结下面这段文字：
1. 先给出 3 句话的核心摘要
2. 再按主题分点列出关键信息
3. 最后给出我的行动建议
要求：语言简洁，不要复述原文。`,
    tags: ['总结', '写作'],
    rating: 4,
    copyCount: 30,
    thinkingSummary: null,
    notes: '对长文档效果最好，200 字以内短文直接让 AI「一句话概括」即可，不要套这条容易过度输出。',
    versions: [],
    createdAt: iso(16),
    updatedAt: iso(5, 6),
  },
  {
    id: 'demo-004',
    title: '中英翻译润色专家',
    code: 'translate',
    body: `你是一名专业的中英互译专家。请将下面这段中文翻译成英文，并：
1. 先给出直译版本
2. 再给出一版自然流畅的意译
3. 指出原文中容易引起歧义的表述
翻译时注意保持专业术语的一致性。`,
    tags: ['翻译', '润色'],
    rating: 3,
    copyCount: 12,
    thinkingSummary:
      '使用「双版本翻译 + 歧义标注」的结构：直译保证忠实、意译保证自然，两者对照让用户能判断语义取舍；要求标注歧义表述则把翻译问题显式化。值得借鉴的是在输出中加入元层反思（指出原文问题），提升了提示词的工具属性。',
    notes: '若原文是合同 / 法务文本，建议你再加一句「保留条款编号与列举项」。本条默认面向通用商务写作。',
    versions: [
      { id: 'demo-004-v1', body: '请将下面的中文翻译成英文，要求专业、自然。', createdAt: iso(11) },
    ],
    createdAt: iso(15),
    updatedAt: iso(6, 2),
  },
  {
    id: 'demo-005',
    title: '前端面试官模拟器',
    code: 'interview',
    body: `你是一名技术面试官，正在面试一名中级前端工程师。请根据我的要求生成面试问题：
1. 围绕 JavaScript 闭包与事件循环出 3 道题
2. 每题给出考察要点和参考答案
3. 最后给出追问思路
难度递进，先基础后深入。`,
    tags: ['面试', '角色扮演'],
    rating: 5,
    copyCount: 25,
    thinkingSummary: null,
    notes: '改用「3 道题」即可控制节奏；如果想要 5 道题，直接在末尾追加一句「再来 2 道延伸题」。',
    versions: [],
    createdAt: iso(14),
    updatedAt: iso(7, 4),
  },
  {
    id: 'demo-006',
    title: '复杂问题拆解助手',
    code: 'decompose',
    body: `请你帮我拆解下面这个复杂问题：
1. 先明确问题的核心目标
2. 把问题分解成 3~5 个可独立解决的子问题
3. 为每个子问题给出解决思路和优先级
如果信息不足，请先向我提问补齐。`,
    tags: ['问题拆解', '分析'],
    rating: 3,
    copyCount: 7,
    thinkingSummary: null,
    notes: '如果你的问题本身就一句话，先自己补 2~3 条子问题再用本条更稳；不要把整段乱糟糟的吐槽直接抛进来。',
    versions: [],
    createdAt: iso(12),
    updatedAt: iso(8),
  },
  {
    id: 'demo-007',
    title: '提示词优化师',
    code: 'prompt-optimize',
    body: `你是一名提示词工程专家。请优化下面这条提示词：
1. 指出它的问题：指令不明确、缺少约束、缺少输出格式
2. 给出优化后的完整版本
3. 解释每处修改的原因
优化后的版本要更具体、可执行。`,
    tags: ['优化', '分析'],
    rating: 4,
    copyCount: 15,
    thinkingSummary:
      '该提示词是「元提示词」：让 AI 扮演提示词工程专家，对自己的另一条提示词进行诊断。通过编号问题强制输出结构化分析（问题、优化版、原因），把修改理由显式化，便于用户理解与复用；前后版本对照的结构是值得借鉴的核心技巧。',
    notes: '适合对已有提示词做「体检」。新建提示词前先用「任务 → 角色 → 约束」三段法手写一版，比一开始就用本条更省时间。',
    versions: [
      { id: 'demo-007-v1', body: '请帮我改进下面这条提示词，让它效果更好。', createdAt: iso(10) },
    ],
    createdAt: iso(13),
    updatedAt: iso(3, 5),
  },
  {
    id: 'demo-008',
    title: '单元测试生成器',
    code: 'unit-test',
    body: `你是一名熟悉 Vitest 的测试工程师。请为下面的函数生成单元测试：
1. 覆盖正常输入、边界值和异常输入
2. 使用 describe/it 组织用例
3. 每个用例写明测试意图
不要修改被测函数的实现。`,
    tags: ['测试', '代码'],
    rating: 2,
    copyCount: 4,
    thinkingSummary: null,
    notes: '仅适用于纯函数（含 class 静态方法）。对于依赖全局状态、副作用重的函数，先 mock 再测，别直接套本条。',
    versions: [],
    createdAt: iso(11),
    updatedAt: iso(9, 2),
  },
  {
    id: 'demo-009',
    title: '四周 TS 学习计划',
    code: 'ts-plan',
    body: `请帮我制定一个为期 4 周的 TypeScript 学习计划：
1. 每周设定一个主题和产出目标
2. 推荐学习资源和练习项目
3. 每周留出复习与总结时间
假设我每天有 1 小时学习时间，已经熟悉 JavaScript 基础。`,
    tags: ['规划', '学习'],
    rating: 0,
    copyCount: 1,
    thinkingSummary: null,
    notes: '把「已经熟悉 JavaScript 基础」改成你当前的实际水平会让计划更贴脸；本条对完全 TS 新手偏激进。',
    versions: [],
    createdAt: iso(9),
    updatedAt: iso(9),
  },
  {
    id: 'demo-010',
    title: '慢查询性能分析',
    code: 'sql-slow',
    body: `你是一名数据库性能优化专家。请分析下面这条慢查询：
1. 解释查询的执行过程与性能瓶颈
2. 给出索引优化建议
3. 给出改写后的 SQL 并对比
请用 EXPLAIN 的思路进行分析。`,
    tags: ['SQL', '代码', '性能优化'],
    rating: 4,
    copyCount: 9,
    thinkingSummary: null,
    notes: '贴 SQL 之前先把表结构 / 索引同步贴进去；如果只能贴一条 SQL，明确告诉 AI「数据量约 X 行」。',
    versions: [],
    createdAt: iso(8),
    updatedAt: iso(2, 8),
  },
  {
    id: 'demo-011',
    title: '周报自动生成',
    code: 'weekly-report',
    body: `请根据我提供的本周工作记录，生成一份周报：
1. 按「本周完成 / 进行中 / 下周计划 / 风险与求助」分节
2. 每节用要点式表达，语言精炼
3. 帮我提炼 3 条最重要的进展作为开头
以下是本周记录：...`,
    tags: ['写作', '总结'],
    rating: 1,
    copyCount: 2,
    thinkingSummary: null,
    notes: '先把一周的会议纪要 / 任务流水贴到「以下是本周记录」前面，再让 AI 出周报；空贴会让模型自己编。',
    versions: [],
    createdAt: iso(6),
    updatedAt: iso(1, 5),
  },
  {
    id: 'demo-012',
    title: '数据清洗方案师',
    code: 'data-clean',
    body: `你是一名数据分析师。请为下面的数据清洗任务制定方案：
1. 列出可能的数据质量问题
2. 给出清洗规则和实现步骤
3. 说明如何验证清洗结果
假设数据以 CSV 形式提供，使用 Python 处理。`,
    tags: ['数据', '分析'],
    rating: 0,
    copyCount: 0,
    thinkingSummary: null,
    notes: '若已知目标字段类型，在备注里加一句「输出字段类型严格保持 string / number / date」会更稳。',
    versions: [],
    createdAt: iso(5),
    updatedAt: iso(5),
  },
]