const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // 密码加密
const jwt = require('jsonwebtoken'); // 身份令牌
const moment = require('moment'); // 日期处理

const app = express();
const PORT = 3000;
const JWT_SECRET = 'strongest_brain_secret_key_2026'; // 真实的生产环境应放在环境变量里

// 开启 CORS，允许咱们运行在 5173 端口的 React 前端来访问
app.use(cors());
app.use(express.json());

// ==========================================
// 1. 初始化 SQLite 数据库
// ==========================================

// 这会在 server 目录下自动生成一个 database.sqlite 文件
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('数据库连接失败:', err.message);
  else console.log('已连接到 SQLite 数据库。');
});

db.serialize(() => {
    // 创建《生命游戏》库表 (如果不存在的话)
    db.run(`CREATE TABLE IF NOT EXISTS puzzles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        difficulty INTEGER,
        rows INTEGER,
        cols INTEGER,
        initial_grid TEXT,
        solution_grid TEXT
    )`);

    // 创建用户表(10项)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_id TEXT UNIQUE,     -- 系统唯一ID (不可改)
        nickname TEXT,             -- 昵称
        password TEXT,             -- 加密后的密码
        avatar TEXT,               -- 头像URL
        bio TEXT,                  -- 简介
        score INTEGER DEFAULT 0,   -- 积分
        badges TEXT,               -- 徽章 (存JSON数组)
        gender TEXT DEFAULT '保密', -- 性别
        birthday TEXT DEFAULT '',  -- 生日
        radar_stats TEXT,           -- 雷达图数据 (存JSON)
        unlocked_badges TEXT DEFAULT '["🌱", "🔥", "🧊", "👑"]' -- 已解锁的徽章 (存JSON数组)
    )`,);

    // 游戏流水表 (没用)
    db.run(`CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        game_id TEXT,              -- 比如 'life-game'
        difficulty INTEGER,
        is_win BOOLEAN,
        time_spent INTEGER,        -- 耗时(秒)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    //核心全局统计表
    db.run(`CREATE TABLE IF NOT EXISTS user_stats(
        user_id INTEGER PRIMARY KEY,            -- 绑定 users 表的 id
        sum_time_spent INTEGER DEFAULT 0,       -- 总游戏耗时 (秒)
        month_time_spent TEXT DEFAULT '{}',     -- 周/月耗时字典 (存 JSON，例如: {"2026-W10": 1500})
        day_time_spent TEXT DEFAULT '{}',       -- 日耗时字典 (存 JSON，用于生成140天热力图: {"2026-03-05": 120})
        single_time_spent INTEGER DEFAULT 0,    -- 今日单日耗时 (秒)
        last_play_date TEXT DEFAULT '',         -- 记录上次游玩日期 (YYYY-MM-DD)，用于跨天重置
        sum_num_of_game INTEGER DEFAULT 0,      -- 总游戏次数
        win_num_of_game INTEGER DEFAULT 0,      -- 胜利游戏次数
        win_rate REAL DEFAULT 0.0               -- 胜率 (胜利次数/总次数)
        )`)

});

// ==========================================
// 2. 编写 API 接口：用户认证系统 (注册与登录)
// ==========================================

// 注册接口
app.post('/api/auth/register', async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: '昵称和密码不能为空' });

  // 生成随机 system_id (如 ID-8492)
  const systemId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  // 默认初始数据
  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${systemId}`;
  const defaultRadar = JSON.stringify([50, 50, 50, 50, 50]);
  const defaultBadges = JSON.stringify(['🌱']); // 新手徽章

  const stmt = db.prepare(`INSERT INTO users (system_id, nickname, password, avatar, bio, badges, radar_stats) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(systemId, nickname, hashedPassword, defaultAvatar, '萌新挑战者，正在开发大脑潜能！', defaultBadges, defaultRadar, function(err) {
    if (err) return res.status(500).json({ error: '注册失败，可能昵称已存在' });

    const newUserId=this.lastID;
    db.run(`INSERT INTO user_stats (user_id) VALUES (?)`,
        [newUserId],
        function(err2){
            if(err2){
                console.error('初始化统计数据失败:', err2.message);
                return res.status(500).json({ error: '初始化大脑档案失败' });
            }
            const token=jwt.sign({ userId: newUserId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ message: '注册成功', token, systemId });
        }
    );
  });
  stmt.finalize();
});

// 登录接口
app.post('/api/auth/login', (req, res) => {
  const { system_id, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE system_id = ?`, [system_id], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: '该系统ID不存在' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: '密码错误' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token });
  });
});

// 解析 Token 的中间件 (用于保护需要登录的接口)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授权，请先登录' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token已失效' });
    req.user = user; // 将解析出的 userId 挂载到 req 上
    next();
  });
};

// ==========================================
// 🌟 全局中央结算引擎 (供所有游戏模块调用)
// ==========================================
const recordGameResult = (userId, gameId, difficulty, isWin, timeSpent) => {
  // 1. 统一计算得分规则 (简单5，中等10，困难20)
  const scoreEarned = isWin ? (difficulty === 1 ? 5 : difficulty === 2 ? 10 : 20) : 0;

  // 2. 统一插入流水账
  db.run(`INSERT INTO game_records (user_id, game_id, difficulty, is_win, time_spent) VALUES (?, ?, ?, ?, ?)`,
    [userId, gameId, difficulty, isWin, timeSpent || 0]);

  // 3. 统一给 users 表加分
  if (isWin) {
    db.run(`UPDATE users SET score = score + ? WHERE id = ?`, [scoreEarned, userId]);
  }

  // 4. 统一更新 user_stats 统计表 (胜率、热力图、耗时)
  db.get('SELECT * FROM user_stats WHERE user_id = ?', [userId], (err, stats) => {
    if (err || !stats) return;

    const todayDate = moment().format('YYYY-MM-DD'); 
    const currentWeek = moment().format('YYYY-[W]ww'); 

    let dayTimeDict = JSON.parse(stats.day_time_spent || '{}');
    let monthTimeDict = JSON.parse(stats.month_time_spent || '{}');

    let currentSingleTime = stats.single_time_spent;
    if (stats.last_play_date !== todayDate) currentSingleTime = 0; 

    const newSumTime = stats.sum_time_spent + timeSpent;
    const newSingleTime = currentSingleTime + timeSpent;
    const newSumNum = stats.sum_num_of_game + 1;
    const newWinNum = isWin ? stats.win_num_of_game + 1 : stats.win_num_of_game;
    const newWinRate = newSumNum > 0 ? (newWinNum / newSumNum) : 0; 

    dayTimeDict[todayDate] = (dayTimeDict[todayDate] || 0) + timeSpent;
    monthTimeDict[currentWeek] = (monthTimeDict[currentWeek] || 0) + timeSpent;

    db.run(`UPDATE user_stats SET 
        sum_time_spent = ?, month_time_spent = ?, day_time_spent = ?, 
        single_time_spent = ?, last_play_date = ?, sum_num_of_game = ?, 
        win_num_of_game = ?, win_rate = ? 
        WHERE user_id = ?`, 
        [
            newSumTime, JSON.stringify(monthTimeDict), JSON.stringify(dayTimeDict),
            newSingleTime, todayDate, newSumNum, 
            newWinNum, newWinRate, userId
        ]
    );
  });

  // 把算出来的得分返回出去，方便具体的游戏接口把得分发给前端展示特效
  return scoreEarned; 
};

// ==========================================
// 3. 编写 API 接口：获取个人主页信息
// ==========================================

// 获取当前登录用户的所有数据 (包括动态计算的胜率和热力图)
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // 使用 LEFT JOIN 一次性查出基础信息和统计信息
  const query = `
    SELECT u.*, 
           s.sum_time_spent, s.month_time_spent, s.day_time_spent, 
           s.single_time_spent, s.sum_num_of_game, s.win_num_of_game, s.win_rate
    FROM users u
    LEFT JOIN user_stats s ON u.id = s.user_id
    WHERE u.id = ?
  `;

  db.get(query, [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });

    // 解析 JSON 字典 (防止为空时报错)
    const dayTimeDict = JSON.parse(user.day_time_spent || '{}');
    const monthTimeDict = JSON.parse(user.month_time_spent || '{}');

    // 计算周环比趋势
    const currentWeek = moment().format('YYYY-[W]ww'); // 例: 2026-W10
    const lastWeek = moment().subtract(1, 'weeks').format('YYYY-[W]ww'); // 例: 2026-W09

    const currentWeekTime = monthTimeDict[currentWeek] || 0;
    const lastWeekTime = monthTimeDict[lastWeek] || 0;

    let weekTrend = 0;
    if (lastWeekTime === 0 && currentWeekTime > 0) {
      weekTrend = 100; // 上周没玩，本周玩了，算飙升 100%
    } else if(lastWeekTime === 0 && currentWeekTime === 0){
      weekTrend = 0; // 上周没玩，本周也没玩，算持平 0%
    }else if (lastWeekTime > 0) {
      weekTrend = (((currentWeekTime - lastWeekTime) / lastWeekTime) * 100).toFixed(1);
    }

    // 生成过去 140 天的热力图数组
    const heatmapData = [];
    for(let i = 139; i >= 0; i--) {
      const dateStr = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const dailyTime = dayTimeDict[dateStr] || 0; // 当天玩了多少秒
      
      // 根据每天游玩的时间(秒)来评定色块等级 0-4
      let level = 0;
      if (dailyTime > 0) level = 1;     // 玩过
      if (dailyTime > 300) level = 2;   // 超过 5 分钟
      if (dailyTime > 900) level = 3;   // 超过 15 分钟
      if (dailyTime > 1800) level = 4;  // 超过 30 分钟 (极度活跃)
      
      heatmapData.push(level);
    }

    // 格式化输出给前端
    res.json({
      ...user,
      badges: JSON.parse(user.badges || '[]'),
      radar_stats: JSON.parse(user.radar_stats || '{}'),
      stats: {
        total_games: user.sum_num_of_game || 0,
        win_rate: user.sum_num_of_game > 0 ? ((user.win_rate) * 100).toFixed(1) : 0,
        total_time_hours: ((user.sum_time_spent || 0) / 3600).toFixed(1), // 转为小时
        today_time_minutes: Math.floor((user.single_time_spent || 0) / 60), // 转为分钟
        week_time_minutes: Math.floor(currentWeekTime / 60), // 转为分钟
        week_trend: weekTrend,
        heatmap: heatmapData
      }
    });
  });
});

// 修改个人资料接口 (昵称, 密码, 头像, 简介, 性别, 生日)
app.put('/api/user/update', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { nickname, avatar, bio, gender, birthday, newPassword } = req.body;

  let query = `UPDATE users SET nickname = ?, avatar = ?, bio = ?, gender = ?, birthday = ?`;
  let params = [nickname, avatar, bio, gender, birthday];

  if (newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    query += `, password = ?`;
    params.push(hashedPassword);
  }

  query += ` WHERE id = ?`;
  params.push(userId);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ message: '个人资料更新成功！' });
  });
});

// ==========================================
// 徽章展馆专属 API
// ==========================================

// 系统的全量徽章大字典
const SYSTEM_BADGES = [
  { id: 'b1', icon: '🌱', name: '脑力萌新', desc: '初入脑力宇宙的证明' },
  { id: 'b2', icon: '🔥', name: '连胜狂魔', desc: '在推演中连续获得胜利' },
  { id: 'b3', icon: '🧊', name: '绝对冷静', desc: '成功破解困难难度的盘面' },
  { id: 'b4', icon: '👑', name: '推演之王', desc: '累计脑力积分突破 1000 分' },
  { id: 'b5', icon: '⚡', name: '闪电突击', desc: '在30秒内完成中等难度推演' },
  { id: 'b6', icon: '👁️', name: '空间之眼', desc: '一次性点对所有细胞，无一错漏' },
  { id: 'b7', icon: '🌌', name: '宇宙主宰', desc: '解锁所有基础徽章' },
  { id: 'b8', icon: '🕰️', name: '时间领主', desc: '累计在线训练时长突破 100 小时' }
];

// 获取徽章展馆数据
app.get('/api/badges/pavilion', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.get(`SELECT badges, unlocked_badges FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '找不到用户' });

    res.json({
      all_badges: SYSTEM_BADGES,
      equipped: JSON.parse(row.badges || '["🌱"]'), // 身上佩戴的 (1~3个)
      unlocked: JSON.parse(row.unlocked_badges || '["🌱"]') // 已经解锁的
    });
  });
});

// 保存佩戴的徽章
app.post('/api/badges/equip', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { equippedBadges } = req.body;

  if (!Array.isArray(equippedBadges) || equippedBadges.length < 1 || equippedBadges.length > 3) {
    return res.status(400).json({ error: '必须选择 1 到 3 个徽章进行展示' });
  }

  db.run(`UPDATE users SET badges = ? WHERE id = ?`, [JSON.stringify(equippedBadges), userId], function(err) {
    if (err) return res.status(500).json({ error: '保存徽章失败' });
    res.json({ message: '徽章佩戴成功！' });
  });
});

// ==========================================
// 4. 《生命游戏》核心引擎
// ==========================================
const getNextGeneration = (grid, rows, cols) => {
  const nextGrid = grid.map(arr => [...arr]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let neighbors = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const nr = r + i, nc = c + j;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) neighbors += grid[nr][nc];
        }
      }
      if (grid[r][c] === 1 && (neighbors < 2 || neighbors > 3)) nextGrid[r][c] = 0;
      else if (grid[r][c] === 0 && neighbors === 3) nextGrid[r][c] = 1;
    }
  }
  return nextGrid;
};

// ==========================================
// 7. 《生命游戏》游戏生成与结算接口 (带 Token 验证)
// ==========================================
app.post('/api/generate-puzzle', authenticateToken, (req, res) => {
  const { difficulty } = req.body;// 前端传过来的难度: 1, 2, 3
  const rows = 15;
  const cols = difficulty * 10;

  // 1. 生成初始随机盘面 (后期你可以在这里加入更复杂的生成算法)
  const initialGrid = Array(rows).fill().map(() => Array(cols).fill().map(() => (Math.random() > 0.8 ? 1 : 0)));
  // 2. 后端直接算出绝对正确的标准答案
  let current = initialGrid;
  let next = getNextGeneration(current, rows, cols);
  let iterations = 0;
  while (JSON.stringify(current) !== JSON.stringify(next) && iterations < 70) {
    current = next;
    next = getNextGeneration(current, rows, cols);
    iterations++;
  }
  const solutionGrid = current;
  // 3. 将题目和答案存入 SQLite 数据库
  const stmt = db.prepare(`INSERT INTO puzzles (difficulty, rows, cols, initial_grid, solution_grid) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(difficulty, rows, cols, JSON.stringify(initialGrid), JSON.stringify(solutionGrid), function(err) {
    res.json({ puzzleId: this.lastID, initialGrid, rows, cols, message: '题目生成成功！' });
  });
  stmt.finalize();
});

// 验证并写入流水、加分
app.post('/api/verify-puzzle', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { puzzleId, playerGrid, difficulty, gameId, timeSpent } = req.body; // 前端需要传消耗的时间过来
  // 从数据库里拿出这道题的标准答案
  db.get(`SELECT solution_grid FROM puzzles WHERE id = ?`, [puzzleId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '找不到题目' });

    const solutionGrid = JSON.parse(row.solution_grid);
    const isCorrect = JSON.stringify(solutionGrid) === JSON.stringify(playerGrid);

    const scoreEarned = recordGameResult(userId, gameId || 'life-game', difficulty, isCorrect, timeSpent);
    
    res.json({
      isCorrect,
      scoreEarned,
      message: isCorrect ? '🎉 挑战成功！' : '❌ 挑战失败！',
      actualSolution: solutionGrid// 验证完毕后，可以把正确答案发给前端做展示
    });
  });
});

app.listen(PORT, () => console.log(`🚀 高级后端服务器已启动：http://localhost:${PORT}`));
