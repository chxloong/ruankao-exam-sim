import bcrypt from 'bcryptjs';
import { db } from './db.js';

// 幂等种子脚本：npm run seed
// 题目均为自编示例题，用于演示系统功能，非真题。

function ensureSubject(name) {
  const row = db.prepare('SELECT id FROM subjects WHERE name = ?').get(name);
  if (row) return row.id;
  return Number(db.prepare('INSERT INTO subjects (name) VALUES (?)').run(name).lastInsertRowid);
}

function ensureUser(username, password, role) {
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (row) return row.id;
  return Number(
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, bcrypt.hashSync(password, 10), role).lastInsertRowid
  );
}

function insertQuestion(subjectId, q) {
  return Number(
    db
      .prepare(
        'INSERT INTO questions (subject_id, type, stem, options, answer, answer_text, analysis) VALUES (?,?,?,?,?,?,?)'
      )
      .run(
        subjectId,
        q.type,
        q.stem,
        q.options ? JSON.stringify(q.options) : null,
        q.answer || null,
        q.answerText || null,
        q.analysis || null
      ).lastInsertRowid
  );
}

const adminId = ensureUser('admin', 'admin123', 'admin');
const studentId = ensureUser('student', '123456', 'user');

const seeded = db.prepare('SELECT COUNT(*) AS c FROM papers').get().c;
if (seeded > 0) {
  console.log('种子数据已存在，跳过（如需重建请删除 backend/data/app.db 后重跑）');
  process.exit(0);
}

// ---------- 科目 ----------
const gaojiId = ensureSubject('信息系统项目管理师');
const zhongjiId = ensureSubject('软件设计师');

// ---------- 科目一：综合知识（单选 15） ----------
const singles1 = [
  {
    type: 'single',
    stem: '下列关于项目目标的说法中，正确的是（　）。',
    options: ['项目目标一经确定就不能修改', '项目目标包括成果性目标和约束性目标', '项目目标就是产品质量目标', '项目目标由项目团队自行确定即可'],
    answer: 'B',
    analysis: '项目目标分为成果性目标（可交付成果）与约束性目标（范围、时间、成本、质量等），且随项目进展可能按变更程序调整。',
  },
  {
    type: 'single',
    stem: '项目章程通常由（　）发布。',
    options: ['项目经理', '项目团队', '项目以外的机构（如发起人或管理层）', '项目管理办公室（PMO）全体成员投票'],
    answer: 'C',
    analysis: '项目章程由项目以外的机构发布，授权项目经理动用组织资源开展项目。',
  },
  {
    type: 'single',
    stem: '工作分解结构（WBS）最底层的组成部分称为（　）。',
    options: ['控制账户', '工作包', '活动清单', '里程碑'],
    answer: 'B',
    analysis: 'WBS 自上而下逐层分解，最底层为工作包，是定义活动、估算成本与工时的基础。',
  },
  {
    type: 'single',
    stem: '在关键路径法中，关键路径是指（　）。',
    options: ['耗时最短的路径', '资源消耗最多的路径', '总浮动时间为零的路径', '风险最高的路径'],
    answer: 'C',
    analysis: '关键路径上活动的总浮动时间为零，其长度决定项目的最短工期。',
  },
  {
    type: 'single',
    stem: '挣值分析中，成本绩效指数 CPI = EV / AC。当 CPI < 1 时，说明（　）。',
    options: ['项目成本节约', '项目成本超支', '项目进度提前', '项目进度落后'],
    answer: 'B',
    analysis: 'CPI < 1 表示实际成本高于挣得价值，即成本超支；进度情况应看 SPI = EV / PV。',
  },
  {
    type: 'single',
    stem: '为应对某项风险，项目组购买了相应的保险，该风险应对策略属于（　）。',
    options: ['规避', '转移', '减轻', '接受'],
    answer: 'B',
    analysis: '通过保险、外包等手段将风险的后果转嫁给第三方，属于风险转移。',
  },
  {
    type: 'single',
    stem: '质量管理工具中，用于分析质量问题根本原因的是（　）。',
    options: ['因果图（鱼骨图）', '直方图', '控制图', '帕累托图'],
    answer: 'A',
    analysis: '因果图通过"人机料法环"等维度追溯质量问题的根本原因，又称鱼骨图或石川图。',
  },
  {
    type: 'single',
    stem: '项目组共有 10 名成员，则项目内部的沟通渠道总数为（　）条。',
    options: ['10', '45', '90', '100'],
    answer: 'B',
    analysis: '沟通渠道数 = n(n-1)/2 = 10 × 9 / 2 = 45。',
  },
  {
    type: 'single',
    stem: '下列关于甘特图的说法，正确的是（　）。',
    options: ['甘特图能清晰表示活动之间的全部依赖关系', '甘特图用横条表示活动的起止时间', '甘特图主要用于质量数据分析', '甘特图不能显示里程碑'],
    answer: 'B',
    analysis: '甘特图（横道图）以时间轴为横坐标、用横条表示各项活动的计划起止时间，直观展示进度安排。',
  },
  {
    type: 'single',
    stem: '按照规范的变更管理流程，项目变更申请首先应提交给（　）审批。',
    options: ['项目经理直接批准即可', '变更控制委员会（CCB）', '测试团队', '客户方运维人员'],
    answer: 'B',
    analysis: '变更提出后应提交变更控制委员会（CCB）评估审批，批准后方可实施并验证。',
  },
  {
    type: 'single',
    stem: '范围确认（范围核实）与质量控制的主要区别在于（　）。',
    options: ['范围确认由客户验收可交付成果，质量控制检查成果的正确性', '两者没有区别', '范围确认发生在项目启动阶段', '质量控制只在项目收尾时进行'],
    answer: 'A',
    analysis: '范围确认关注客户对可交付成果的正式接受；质量控制关注成果是否满足质量要求，两者侧重不同。',
  },
  {
    type: 'single',
    stem: '敏捷方法 Scrum 中，每日站会（Daily Scrum）的建议时长一般不超过（　）。',
    options: ['5 分钟', '15 分钟', '30 分钟', '60 分钟'],
    answer: 'B',
    analysis: '每日站会一般 15 分钟以内，聚焦昨日进展、今日计划与遇到的障碍。',
  },
  {
    type: 'single',
    stem: '识别干系人过程的主要输出是（　）。',
    options: ['干系人登记册', '项目管理计划', '风险登记册', '工作绩效报告'],
    answer: 'A',
    analysis: '识别干系人输出干系人登记册，记录干系人身份、期望、影响等信息，并贯穿项目全程更新。',
  },
  {
    type: 'single',
    stem: '当项目的采购需求范围不确定、需要双方共担风险时，通常采用（　）合同。',
    options: ['固定总价合同', '成本补偿合同', '固定单价工料合同', '口头协议'],
    answer: 'B',
    analysis: '成本补偿合同按实际成本加利润结算，适用于范围不确定、需共担风险的情形。',
  },
  {
    type: 'single',
    stem: '信息安全的三要素（CIA）是指（　）。',
    options: ['保密性、完整性、可用性', '机密性、可控性、可审查性', '完整性、可靠性、可维护性', '可用性、可扩展性、安全性'],
    answer: 'A',
    analysis: 'CIA 三要素：保密性（Confidentiality）、完整性（Integrity）、可用性（Availability）。',
  },
];

// ---------- 科目一：综合知识（多选 5） ----------
const multiples1 = [
  {
    type: 'multiple',
    stem: '下列属于项目整体管理过程的有（　）。',
    options: ['制定项目章程', '实施整体变更控制', '编制项目采购计划', '监控项目工作', '结束项目或阶段'],
    answer: 'ABDE',
    analysis: '整体管理包含制定章程、项目管理计划、指导与管理工作、监控项目工作、整体变更控制、结束项目或阶段；编制采购计划属于采购管理。',
  },
  {
    type: 'multiple',
    stem: '常用的风险识别技术包括（　）。',
    options: ['头脑风暴', '德尔菲法', 'SWOT 分析', '挣值分析', '核对单（检查表）'],
    answer: 'ABCE',
    analysis: '挣值分析用于绩效测量，不属于风险识别技术；其余均为常用风险识别方法。',
  },
  {
    type: 'multiple',
    stem: '下列属于质量一致性成本的有（　）。',
    options: ['预防成本（培训）', '评价成本（测试）', '内部失败成本（返工）', '外部失败成本（售后处理）', '质量计划编制成本'],
    answer: 'ABE',
    analysis: '一致性成本 = 预防成本 + 评价成本，用于保证质量；失败成本（内外部）属于非一致性成本。',
  },
  {
    type: 'multiple',
    stem: '敏捷宣言倡导的价值观包括（　）。',
    options: ['个体与互动 高于 流程与工具', '可工作的软件 高于 详尽的文档', '客户合作 高于 合同谈判', '详尽的文档 高于 可工作的软件', '响应变化 高于 遵循计划'],
    answer: 'ABCE',
    analysis: '敏捷宣言四大价值观：个体与互动、可工作的软件、客户合作、响应变化分别高于流程与工具、详尽文档、合同谈判、遵循计划。',
  },
  {
    type: 'multiple',
    stem: '下列沟通方式中，属于"推式沟通"的有（　）。',
    options: ['向干系人发送绩效报告', '召开视频会议', '发送电子邮件', '在知识库发布项目新闻稿', '即时在线讨论'],
    answer: 'AC',
    analysis: '推式沟通是单向发送给接收方（报告、邮件、简报）；视频会议和即时讨论属于交互式沟通；知识库发布属于拉式沟通。',
  },
];

// ---------- 科目一：案例分析（1 大题） ----------
const case1 = {
  type: 'text',
  stem:
    '【案例背景】\n' +
    '某软件公司承建一个"智慧园区综合管理平台"项目，合同工期 10 个月。项目启动后，公司指派技术骨干张工担任项目经理，但张工同时还要负责另一个项目的开发工作。项目进行到第 4 个月时出现以下情况：\n' +
    '（1）客户方多位领导分别向项目组提出新的功能要求，项目组成员碍于情面直接接受并修改代码，未履行任何变更手续，导致版本混乱、返工频繁；\n' +
    '（2）园区物业、商户等关键干系人从未参与需求确认，上线前的试运行中他们提出大量异议；\n' +
    '（3）项目已明显偏离计划进度，且无人能说清当前的进度和成本偏差究竟有多大。\n\n' +
    '【问题】\n' +
    '1. 结合案例，分析该项目管理中存在的主要问题。\n' +
    '2. 针对需求变更，说明规范的变更管理流程。\n' +
    '3. 简述本项目应如何改进干系人沟通管理。',
  answerText:
    '【参考答案要点】\n' +
    '问题一：\n' +
    '① 项目经理配置不当：张工兼职两个项目，精力不足，应由专职项目经理负责；\n' +
    '② 缺乏变更控制机制：变更未经申请、评审、审批直接实施，造成版本混乱与返工；\n' +
    '③ 干系人识别与管理缺失：未识别物业、商户等关键干系人，未安排需求确认与沟通活动；\n' +
    '④ 缺少绩效监控：未运用挣值分析等工具跟踪进度、成本偏差，项目状态失控；\n' +
    '⑤ 沟通管理计划缺失或未落实。\n\n' +
    '变更管理流程要点：\n' +
    '① 变更申请：任何干系人的需求变更均须书面提出；\n' +
    '② 影响评估：项目经理组织评估变更对范围、进度、成本、质量的影响；\n' +
    '③ CCB 审批：由变更控制委员会决定批准或否决；\n' +
    '④ 实施与验证：批准后按计划实施变更并验证结果；\n' +
    '⑤ 记录与通知：更新项目管理计划、基线和相关文档，并将结果通知干系人。\n\n' +
    '沟通管理改进：\n' +
    '① 编制沟通管理计划，明确沟通对象、内容、频率、方式与责任人；\n' +
    '② 建立干系人登记册并按权力/利益方格分类管理，重点管理物业与商户；\n' +
    '③ 定期召开项目例会、发布绩效报告；建立需求评审与确认机制；\n' +
    '④ 采用交互式沟通处理关键问题，推式/拉式沟通传递常规信息。',
  analysis: '案例题采分点：问题定位 + 流程要点 + 改进建议三部分，按要点给分。',
};

// ---------- 科目一：论文（1 题） ----------
const essay1 = {
  type: 'text',
  stem:
    '【论文题目】论项目的风险管理\n\n' +
    '项目是在复杂环境中进行的临时性努力，风险贯穿项目始终。请以你实际参与过的一个项目为例，围绕以下要点写一篇论文：\n' +
    '1. 简要介绍项目背景、规模与你在其中承担的职责；\n' +
    '2. 结合项目实际，论述你是如何开展风险管理规划、风险识别、定性与定量风险分析、风险应对规划以及风险监控的；\n' +
    '3. 总结项目风险管理的成效与不足，并提出改进建议。\n\n' +
    '写作要求：结构合理、结合实例、语言通顺，正文不少于 2000 字。',
  answerText:
    '【写作提纲参考】\n' +
    '一、项目概述（约 300 字）：交代项目名称、建设目标、周期、投资额、本人角色（建议选真实或贴近真实的项目）。\n' +
    '二、风险管理实践（主体，约 1400 字）：\n' +
    '① 规划风险管理：制定风险管理计划，明确风险类别、概率影响等级定义与风险阈值；\n' +
    '② 识别风险：采用头脑风暴、德尔菲、核对单识别出进度、需求、技术、人员、外包等类别风险，形成风险登记册；\n' +
    '③ 定性分析：用概率-影响矩阵排序，识别出若干高优先级风险；\n' +
    '④ 定量分析：对关键风险用决策树/蒙特卡洛模拟估算对工期与成本的影响；\n' +
    '⑤ 应对规划：对高优先级风险分别采取规避（调整计划）、转移（外包/保险）、减轻（技术预研、原型验证）、接受（预留应急储备）策略；\n' +
    '⑥ 监控风险：例会跟踪风险登记册，设置风险预警指标，及时更新与触发应对。\n' +
    '三、成效与不足（约 300 字）：如项目按期交付、重大风险无一失控；不足如定量分析深度不够、新风险识别滞后；建议：常态化风险复审、积累组织过程资产等。',
  analysis: '论文按摘要、正文结构、论点覆盖、实例结合度综合评分。',
};

// ---------- 科目二：软件设计师 基础知识（单选 10） ----------
const singles2 = [
  {
    type: 'single',
    stem: '栈是一种特殊的线性表，其特点是（　）。',
    options: ['先进先出', '后进先出', '随机存取', '按关键字排序存取'],
    answer: 'B',
    analysis: '栈只在栈顶进行插入和删除，遵循后进先出（LIFO）原则。',
  },
  {
    type: 'single',
    stem: '队列的特点是（　）。',
    options: ['后进先出', '先进先出', '只能从中间取元素', '元素自动排序'],
    answer: 'B',
    analysis: '队列从队尾入队、队头出队，遵循先进先出（FIFO）原则。',
  },
  {
    type: 'single',
    stem: '二叉树第 i 层（i ≥ 1）最多有（　）个结点。',
    options: ['2i', '2^i', '2^(i-1)', 'i^2'],
    answer: 'C',
    analysis: '二叉树第 i 层最多 2^(i-1) 个结点；深度为 k 的二叉树最多 2^k - 1 个结点。',
  },
  {
    type: 'single',
    stem: '对有序表进行二分（折半）查找，其平均时间复杂度为（　）。',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'B',
    analysis: '二分查找每次将查找范围减半，平均时间复杂度 O(log n)。',
  },
  {
    type: 'single',
    stem: '下列排序算法中，（　）是稳定的排序算法。',
    options: ['快速排序', '堆排序', '直接插入排序', '简单选择排序'],
    answer: 'C',
    analysis: '直接插入排序、冒泡排序、归并排序是稳定排序；快速、堆、简单选择排序不稳定。',
  },
  {
    type: 'single',
    stem: '进程的三态模型中，进程因等待某事件（如 I/O 完成）而处于的状态是（　）。',
    options: ['就绪态', '运行态', '阻塞态（等待态）', '创建态'],
    answer: 'C',
    analysis: '进程等待事件发生时处于阻塞态，事件完成后转为就绪态，由调度程序调度进入运行态。',
  },
  {
    type: 'single',
    stem: '下列不属于死锁四个必要条件的是（　）。',
    options: ['互斥条件', '请求和保持条件', '不可剥夺条件', '优先级翻转条件'],
    answer: 'D',
    analysis: '死锁的四个必要条件：互斥、请求和保持、不可剥夺、循环等待。',
  },
  {
    type: 'single',
    stem: '关于 TCP 协议，下列说法正确的是（　）。',
    options: ['无连接、不可靠', '面向连接、提供可靠字节流传输', '面向数据报、尽最大努力交付', '只用于局域网'],
    answer: 'B',
    analysis: 'TCP 面向连接，通过确认重传、流量控制、拥塞控制提供可靠的字节流服务；UDP 才是无连接的数据报协议。',
  },
  {
    type: 'single',
    stem: 'IP 地址 192.168.1.0/24 网段中，可分配给主机的地址数量为（　）。',
    options: ['256', '255', '254', '253'],
    answer: 'C',
    analysis: '/24 网段共 256 个地址，除去网络地址和广播地址，可用主机地址为 254 个。',
  },
  {
    type: 'single',
    stem: '关系数据库中，第三范式（3NF）在第二范式的基础上消除了（　）。',
    options: ['部分函数依赖', '传递函数依赖', '多值依赖', '连接依赖'],
    answer: 'B',
    analysis: '1NF 消除重复组，2NF 消除非主属性对码的部分函数依赖，3NF 进一步消除传递函数依赖。',
  },
];

// ---------- 科目二：应用技术（1 题） ----------
const case2 = {
  type: 'text',
  stem:
    '【应用技术题】\n' +
    '给定一个只包含三种括号字符（圆括号、方括号、花括号）的字符串，请设计算法判断该字符串中的括号是否全部正确匹配（即每个左括号都有对应类型且顺序正确的右括号与之匹配）。\n\n' +
    '要求：\n' +
    '1. 说明所选数据结构及选择理由；\n' +
    '2. 用自然语言或伪代码描述算法步骤；\n' +
    '3. 分析算法的时间复杂度与空间复杂度。\n\n' +
    '示例：输入 "([{}])" 输出 匹配；输入 "(]" 输出 不匹配。',
  answerText:
    '【参考答案】\n' +
    '1. 数据结构：选用栈。理由：括号匹配满足"最近未匹配的左括号最先被匹配"的后进先出特性，与栈的操作特征完全吻合。\n\n' +
    '2. 算法步骤：\n' +
    '   ① 初始化一个空栈 S；\n' +
    '   ② 从左到右扫描字符串的每个字符 c：\n' +
    '      - 若 c 是左括号（(、[、{），将其压入栈 S；\n' +
    '      - 若 c 是右括号：若栈为空，返回"不匹配"；否则弹出栈顶元素 t，检查 t 与 c 是否为同类型配对（如 t="(" 且 c=")"）；不配对则返回"不匹配"；\n' +
    '   ③ 扫描结束后，若栈为空返回"匹配"，否则说明还有未闭合的左括号，返回"不匹配"。\n\n' +
    '3. 复杂度分析：设字符串长度为 n。每个字符最多入栈、出栈各一次，时间复杂度 O(n)；最坏情况下所有字符为左括号全部入栈，空间复杂度 O(n)。',
  analysis: '采分点：数据结构选型与理由、正确完整的算法描述、复杂度分析。',
};

// ---------- 组卷 ----------
function createPaper(subjectId, title, durationMinutes, passScore, items) {
  const r = db
    .prepare("INSERT INTO papers (subject_id, title, duration_minutes, pass_score, status, created_by) VALUES (?,?,?,?,'published',?)")
    .run(subjectId, title, durationMinutes, passScore, adminId);
  const paperId = Number(r.lastInsertRowid);
  const ins = db.prepare('INSERT INTO paper_questions (paper_id, question_id, section, sort, score) VALUES (?,?,?,?,?)');
  let sort = 0;
  for (const [section, list, score] of items) {
    for (const questionId of list) {
      ins.run(paperId, questionId, section, sort++, score);
    }
  }
  return paperId;
}

// 科目一
const q1Ids = singles1.map((q) => ({ id: insertQuestion(gaojiId, q), q }));
const m1Ids = multiples1.map((q) => ({ id: insertQuestion(gaojiId, q), q }));
const case1Id = { id: insertQuestion(gaojiId, case1), q: case1 };
const essay1Id = { id: insertQuestion(gaojiId, essay1), q: essay1 };

createPaper(gaojiId, '信息系统项目管理师 模拟练习卷（一）', 150, 45, [
  ['综合知识', q1Ids.map((x) => x.id), 1],
  ['综合知识', m1Ids.map((x) => x.id), 1],
  ['案例分析', [case1Id.id], 25],
  ['论文', [essay1Id.id], 25],
]);

// 科目二
const q2Ids = singles2.map((q) => ({ id: insertQuestion(zhongjiId, q), q }));
const case2Id = { id: insertQuestion(zhongjiId, case2), q: case2 };

createPaper(zhongjiId, '软件设计师 模拟练习卷（一）', 150, 21, [
  ['基础知识', q2Ids.map((x) => x.id), 1],
  ['应用技术', [case2Id.id], 25],
]);

console.log('种子数据写入完成：');
console.log('  管理员账号 admin / admin123');
console.log('  学生账号   student / 123456');
console.log('  科目与试卷：信息系统项目管理师、软件设计师 各一张已发布示例卷');
