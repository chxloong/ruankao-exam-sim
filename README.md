# 软考机考模拟练习系统

仿照软考官方「机考模拟练习」功能自建的多用户在线模拟练习平台。**全部代码与示例题均为原创，不含官方系统代码与真题内容。**

## 功能

- **考生端**
  - 注册 / 登录（自助注册后账号为**待审核**状态，管理员审核通过后方可登录；管理员可随时停用/启用账号，停用即时生效）
  - **修改密码**（网页首页右上角、小程序首页顶部入口；改密/被重置后旧登录态立即失效，需重新登录）
  - **移动端竖屏适配**：主流手机分辨率（≤768px）下首页/须知/成绩为纵向卡片流，机考作答界面为竖屏布局、答题卡改为抽屉唤出，桌面布局不受影响
  - 试卷列表：开始考试、断点续考（"继续考试"）、查看最近成绩
  - 考场须知页（"我已阅读"后开始计时）
  - 仿机考作答界面：倒计时（到时自动交卷）、按节分组答题卡（已答/已标记/未答三态）、单选/多选/主观题（字数统计）、标记复查、弹窗计算器、自动保存
  - 交卷后客观题自动评分（多选：全对满分、少选按比例、错选 0 分）
  - 成绩列表与详情回看：正确答案、解析、主观题参考答案对照 + 自评计分
- **管理端**（admin 角色）
  - 题库管理：科目管理、题目增删改查、JSON 批量导入
  - **题目录入**：独立连续录入页（保存并录入下一题自动清空、科目/题型保持、本次已录计数、页内新增科目）
  - 试卷管理：分节组卷（综合知识/案例分析/论文…）、每节题分值、时长与及格线、发布/下架
  - 用户管理：**新增用户**（立即生效）、注册**审核**、**停用/启用**、**重置密码**、角色调整

## 技术栈

- 前端：Vue 3 + Vite + Vue Router + Pinia + Element Plus（端口 5173）
- 后端：Python FastAPI + 标准库 `sqlite3` + PyJWT + bcrypt（端口 3001）
- 数据库文件：`backend/data/app.db`

## 启动

```bash
# 1. 后端（首次需创建虚拟环境）
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python seed.py    # 初始化示例数据（幂等）
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 3001 --reload

# 2. 前端（新开终端）
cd frontend
npm install
npm run dev      # http://localhost:5173
```

> Windows 上需先安装 Python 3.12+；Linux/macOS 将 `.venv\Scripts\` 换为 `.venv/bin/`。接口文档自动生成于 http://localhost:3001/api/docs 。

## 安卓版（APK）

基于 **Capacitor**（Ionic 开源项目，业界主流的 Web→安卓方案）打包，界面与功能与 Web/桌面版完全一致，竖屏锁定，适配小米等主流机型（minSdk 24 = Android 7+）。

**架构**：APK 内置前端界面（离线可用），数据来自电脑上运行的 FastAPI 后端（局域网模式）——手机与电脑连同一 WiFi，登录页「服务器地址」预填 `http://192.168.31.146:3001`（可改）。

**使用步骤**：
1. 电脑：启动后端 `python -m uvicorn main:app --host 0.0.0.0 --port 3001`（必须 0.0.0.0 监听局域网；防火墙已放行 3001）
2. 手机：安装 `release/软考机考模拟练习.apk`（MIUI 需允许"安装未知应用"），连同一 WiFi
3. 打开 App → 登录页确认服务器地址 → 用演示账号登录即可

**重新打包**：

```bash
# 环境要求：JDK 21、Android SDK（platform 36 + build-tools 36）、node
cd frontend
npm run build && npx cap sync android
cd android && gradlew.bat assembleDebug
# 产物 android/app/build/outputs/apk/debug/app-debug.apk
```

> 网络提示：Gradle/Maven 下载若遇 Steam++ 中间人证书问题，构建前设置 `JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT` 让 Java 信任 Windows 证书库。`npx cap add` 写中文 App 名可能产生编码问题，重打包前检查 `android/app/src/main/res/values/strings.xml` 是否为正确 UTF-8。
> **关键配置**：Capacitor 8 以 `https://localhost` 加载页面，向 http:// 局域网后端发请求会被混合内容策略拦截——`capacitor.config.json` 中必须保留 `"android": { "allowMixedContent": true }`（已配置），否则登录请求静默失败。

## 微信小程序（原生 WXML）

`miniprogram/` 目录为**原生小程序**工程（WXML/WXSS/JS），覆盖考生端全流程：登录（含服务器地址配置）、试卷列表（开始/继续考试）、考场须知、机考作答（倒计时/分节答题卡抽屉/单选/多选/主观题字数统计/标记/节流自动保存/交卷确认/到时自动交卷）、成绩列表与详情回看（含解析与主观题自评）。管理后台仍请使用网页端。

**使用步骤**：
1. 电脑：后端以 `--host 0.0.0.0` 启动（防火墙已放行 3001），手机与电脑连同一 WiFi
2. 微信开发者工具（[下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)）→ 导入 `miniprogram/` 目录 → AppID 选"测试号"或填自己的（`project.config.json` 默认 `touristappid`）
3. 域名校验已默认关闭（`urlCheck: false`），模拟器即可连 `http://192.168.31.146:3001` 调试；真机预览/体验版需在右上角"…"开启**开发调试**
4. 正式发布需 HTTPS + ICP 备案域名并在公众平台配置 request 合法域名（局域网地址无法过审）

**小程序语法速览**：`.wxml` 页面结构（`{{}}` 绑定、`wx:if`/`wx:for`）、`.wxss` 样式（`rpx` 响应式单位）、`.js` 逻辑（`wx.request`/`Page()` 生命周期）、`.json` 配置。

## Windows 桌面版（exe）

桌面版 = 同一套 FastAPI 后端（进程内启动）+ 构建后的前端 + pywebview 窗口（WebView2 内核），功能与 Web 版完全一致。

**直接运行**：`backend/dist/软考机考模拟练习系统.exe`（单文件约 19MB，双击即用）

- 数据（SQLite）自动生成在 exe 同级的 `data/` 目录，便携可拷贝
- 首次启动数据库为空时自动写入演示数据（admin/admin123、student/123456 与两张示例卷）
- 端口随机分配，与 Web 版开发服务（3001）互不冲突
- 排障日志：`data/desktop.log`

**重新打包**：

```bash
cd frontend && npm run build          # 1. 构建前端
cd ../backend                         # 2. 打包（需已 pip install pywebview pyinstaller）
.venv\Scripts\pyinstaller --noconfirm --onefile --windowed --name RuankaoExam ^
  --add-data "..\frontend\dist;frontend_dist" ^
  --collect-all pythonnet ^
  --hidden-import uvicorn.loops --hidden-import uvicorn.loops.auto --hidden-import uvicorn.loops.asyncio ^
  --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.http.h11_impl ^
  --hidden-import uvicorn.protocols.websockets.auto ^
  --hidden-import uvicorn.lifespan --hidden-import uvicorn.lifespan.on ^
  --hidden-import webview.platforms.edgechromium --hidden-import webview.platforms.winforms ^
  desktop_app.py
# 产物 backend/dist/RuankaoExam.exe（pywebview/pythonnet 自带 PyInstaller 钩子）
```

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

## 接口测试（pytest）

`backend/tests/` 内置 26 个自动化测试（隔离临时数据库，不碰开发数据），覆盖：评分规则（单选/多选部分分/主观题）、认证（注册校验/登录/状态拦截/改密）、用户生命周期（审核/停用/重置/权限边界）、考试全流程（开考/防答案泄漏/断点续考/交卷评分/自评/超时自动交卷）。

```bash
cd backend
.venv\Scripts\pip install -r requirements-dev.txt   # 首次：pytest + httpx
.venv\Scripts\python -m pytest -v
```

## 目录结构

```
backend/
  main.py           # FastAPI 入口（路由注册、统一错误格式）
  database.py       # SQLite 连接与建表
  security.py       # bcrypt + JWT + 认证依赖
  grading.py        # 客观题评分
  seed.py           # 示例数据（自编示例题）
  routers/          # auth / papers / exams / my / admin
frontend/
  src/
    api/index.js     # fetch 封装
    stores/auth.js
    router/index.js
    views/           # 登录、首页、须知、作答、成绩、admin/*
    components/ExamCalculator.vue
```
