import {useNavigate } from 'react-router-dom';

export default function GameStore() {
  const navigate = useNavigate();

  // 模拟《最强大脑》的游戏仓库数据
  const gameStore = [
    {
      id: 'life-game',
      title: '生命游戏 (Life Game)',
      description: '基于 B3/S23 细胞自动机规则，在大脑中推演动态盘面，找出最终的稳定形态。',
      difficulty: '⭐⭐⭐⭐⭐',
      color: 'bg-yellow-500',
      tags: ['空间推演', '规则计算']
    },
    {
      id: 'spatial-fold',
      title: '空间折叠 (Spatial Fold)',
      description: '在大脑中将展开的 2D 复杂多边形折叠成 3D 几何体，并判断其投影。',
      difficulty: '⭐⭐⭐⭐⭐',
      color: 'bg-purple-500',
      tags: ['空间推理', 'AI 生成']
    },
    {
      id: 'logic-maze',
      title: '盲眼迷宫 (Blind Maze)',
      description: '只看一眼迷宫全貌，随后在全黑状态下通过方向键指令走出迷宫。',
      difficulty: '⭐⭐⭐',
      color: 'bg-emerald-500',
      tags: ['路径规划', '工作记忆']
    },
    {
      id: 'logic-maz',
      title: '盲眼迷宫 (Blind Maze)',
      description: '只看一眼迷宫全貌，随后在全黑状态下通过方向键指令走出迷宫。',
      difficulty: '⭐⭐⭐',
      color: 'bg-emerald-500',
      tags: ['路径规划', '工作记忆']
    },
    {
      id: 'logic-m',
      title: '盲眼迷宫 (Blind Maze)',
      description: '只看一眼迷宫全貌，随后在全黑状态下通过方向键指令走出迷宫。',
      difficulty: '⭐⭐⭐',
      color: 'bg-emerald-500',
      tags: ['路径规划', '工作记忆']
    },
    {
      id: 'logi',
      title: '盲眼迷宫 (Blind Maze)',
      description: '只看一眼迷宫全貌，随后在全黑状态下通过方向键指令走出迷宫。',
      difficulty: '⭐⭐⭐',
      color: 'bg-emerald-500',
      tags: ['路径规划', '工作记忆']
    },
    {
      id: 'lo',
      title: '盲眼迷宫 (Blind Maze)',
      description: '只看一眼迷宫全貌，随后在全黑状态下通过方向键指令走出迷宫。',
      difficulty: '⭐⭐⭐',
      color: 'bg-emerald-500',
      tags: ['路径规划', '工作记忆']
    }
  ];

  // 点击开玩，跳转到游戏页并带上游戏 ID
  const handlePlay = (gameId) => {
    // 后续我们可以在 Game 页面通过路由参数读取这个 ID，来加载不同的游戏组件
    navigate(`/game?id=${gameId}`);
  };

  return (
    <div className="max-h-screen bg-apple-lightBg dark:bg-apple-darkBg transition-colors duration-500 p-6 md:px-2 md:pb-4 font-sans">

      {/* --- 游戏仓库 (App Store 风格网格) --- */}
      <main className="max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold mb-6 border-b border-gray-200 dark:border-gray-800 pb-2">
          精选脑力挑战
        </h2>
        
        {/* 使用 CSS Grid 布局，手机端单列，平板双列，电脑三列 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {gameStore.map((game) => (
            <div 
              key={game.id}
              className="group relative bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 dark:border-white/5 transition-all duration-300 hover:-translate-y-1 flex flex-col"
            >
              {/* 游戏顶部图标/颜色块 */}
              <div className={`w-16 h-16 rounded-2xl ${game.color} mb-6 shadow-inner flex items-center justify-center text-white text-2xl`}>
                🧠
              </div>

              {/* 游戏信息 */}
              <h3 className="text-xl font-bold mb-2">{game.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-grow leading-relaxed">
                {game.description}
              </p>

              {/* 标签与难度 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  {game.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs tracking-widest text-yellow-500">
                  {game.difficulty}
                </div>
              </div>

              {/* 动作按钮 (App Store 风格的 GET/PLAY 按钮) */}
              <button 
                onClick={() => handlePlay(game.id)}
                className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-apple-blue font-bold group-hover:bg-apple-blue group-hover:text-white transition-colors duration-300"
              >
                开始挑战
              </button>
            </div>
          ))}

        </div>
      </main>

    </div>
  );
}