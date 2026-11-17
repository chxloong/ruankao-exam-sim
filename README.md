# 软考机考模拟练习系统

仿照软考官方「机考模拟练习」功能自建的多用户在线模拟练习平台。**全部代码与示例题均为原创，不含官方系统代码与真题内容。**

## 功能

- **考生端**
  - 注册 / 登录
  - 试卷列表：开始考试、断点续考（"继续考试"）、查看最近成绩
  - 考场须知页（"我已阅读"后开始计时）
  - 仿机考作答界面：倒计时（到时自动交卷）、按节分组答题卡（已答/已标记/未答三态）、单选/多选/主观题（字数统计）、标记复查、弹窗计算器、自动保存
  - 交卷后客观题自动评分（多选：全对满分、少选按比例、错选 0 分）
  - 成绩列表与详情回看：正确答案、解析、主观题参考答案对照 + 自评计分
- **管理端**（admin 角色）
  - 题库管理：科目管理、题目增删改查、JSON 批量导入
  - 试卷管理：分节组卷（综合知识/案例分析/论文…）、每节题分值、时长与及格线、发布/下架
  - 用户管理：角色调整

## 技术栈

- 前端：Vue 3 + Vite + Vue Router + Pinia + Element Plus（端口 5173）
- 后端：Node.js（Express，`node:sqlite` 内置 SQLite）+ JWT（端口 3001）
- 数据库文件：`backend/data/app.db`

## 启动

```bash
# 1. 后端
cd backend
npm install
npm run seed     # 初始化示例数据（幂等）
npm run dev      # http://localhost:3001

# 2. 前端（新开终端）
cd frontend
npm install
npm run dev      # http://localhost:5173
```

> Windows 上若提示找不到 node，请确认已安装 Node.js ≥ 22（需内置 `node:sqlite`）。

## 演示账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 考生 | student | 123456 |

## 题库 JSON 导入格式

```json
{
  "subjectName": "信息系统项目管理师",
  "questions": [
    {
      "type": "single",
      "stem": "题干……",
      "options": ["选项内容", "选项内容", "选项内容", "选项内容"],
      "answer": "A",
      "analysis": "解析（可选）"
    },
    {
      "type": "multiple",
      "stem": "题干……",
      "options": ["…", "…", "…", "…"],
      "answer": "ABD"
    },
    {
      "type": "text",
      "stem": "案例/论文题干……",
      "answerText": "参考答案……"
    }
  ]
}
```

- 选项填纯内容即可（无需带 `A.` 前缀，带前缀会自动剥离）
- `answer` 用选项字母；`text` 题型用 `answerText`
- 已有科目也可以用 `"subjectId": 1` 指定

## 目录结构

```
backend/
  src/
    db.js            # SQLite 建表
    seed.js          # 示例数据（自编示例题）
    grading.js       # 客观题评分
    index.js         # Express 入口
    middleware/auth.js
    routes/          # auth / papers / exams / my / admin
frontend/
  src/
    api/index.js     # fetch 封装
    stores/auth.js
    router/index.js
    views/           # 登录、首页、须知、作答、成绩、admin/*
    components/ExamCalculator.vue
```
