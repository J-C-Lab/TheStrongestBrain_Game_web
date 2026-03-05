# 🧠 最强大脑训练营 (The Strongest Brain - Game Web)

欢迎来到“最强大脑训练营”！本项目是一个集成了空间推演、瞬时记忆与逻辑计算的硬核全栈脑力训练平台。灵感来源于顶级脑力竞技节目《最强大脑》。

## ✨ 核心特性

- **🍏 极致“苹果风” UI**：使用 Tailwind CSS 打造的全套毛玻璃 (Glassmorphism)、大圆角、高对比度界面，原生支持完美的日间/暗黑模式 (Dark Mode) 平滑切换。
- **🎮 3D 视觉与粒子特效**：登录页内置 Siri 风格的 Canvas 多彩流体粒子背景与纯 CSS 驱动的 3D 翻转认证卡片；游戏通关自带全屏礼炮特效 (`canvas-confetti`)。
- **📊 专业级数据看板**：个人主页引入 `ECharts` 驱动的多维能力雷达图、准确率环形图，并使用 Tailwind 纯手工复刻了 GitHub 风格的年度活跃打卡热力图。
- **🗄️ 轻量级本地数据库**：接入 SQLite，持久化存储玩家数据（昵称、积分、徽章）与题库，随项目开箱即用，无需复杂配置。

## 🛠️ 技术栈

**前端 (Frontend)**
- React 18 + Vite (构建工具)
- Tailwind CSS (原子化样式引擎)
- React Router DOM v6 (页面路由守卫与跳转)
- ECharts for React (数据可视化)
- Canvas Confetti (通关撒花特效)

**后端 (Backend)**
- Node.js + Express (服务器框架)
- SQLite3 (轻量级关系型数据库)
- CORS (跨域资源共享)

## 📂 目录结构

```text
TheStrongestBrain_Game_web/
├── server/                    # 🚀 Node.js 后端目录
│   ├── index.js               # 后端入口 (API 接口、推演算法、DB配置)
│   ├── database.sqlite        # SQLite 本地数据库文件 (自动生成)
│   └── package.json           # 后端依赖
├── src/                       # 🎨 React 前端目录
│   ├── components/            # 复用组件
│   │   ├── Navbar.jsx         # 全局顶部导航栏
│   │   ├── LifeGame.jsx       # 生命游戏核心交互组件
│   │   └── RainbowParticleBg.jsx # Canvas 彩虹粒子背景
│   ├── pages/                 # 页面路由
│   │   ├── Login.jsx          # 3D 登录/注册页
│   │   ├── Home.jsx           # 个人主页 (数据看板)
│   │   ├── GameStore.jsx      # 脑力游戏商店
│   │   └── Game.jsx           # 游戏运行容器
│   ├── App.jsx                # 顶级路由与布局守卫
│   ├── index.css              # 全局 Tailwind 样式注入
│   └── main.jsx               # React 挂载入口
├── index.html                 # 静态模板
├── tailwind.config.js         # Tailwind 主题与暗黑模式配置
└── package.json               # 前端依赖