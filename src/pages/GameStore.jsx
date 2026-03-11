import { useState, useMemo } from 'react';
import {useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
export default function GameStore() {
  const navigate = useNavigate();
  const { showMsg } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  

  const gameStore = [
    {
      id: 'life-game',
      title: '生命游戏 (Life Game)',
      description: '基于 B3/S23 细胞自动机规则，在大脑中推演动态盘面，找出最终的稳定形态。',
      difficulty: '⭐⭐⭐⭐⭐',
      color: 'bg-yellow-500',
      icon: '🌱',
      category: '科学推演',
      tags: ['空间推演', '规则计算']
    },
    {
      id: 'precise-word',
      title: '精准造字 (Precise Word)',
      description: '在 6×6 字根矩阵中规划连线路径，配合冷却流转的部首池，在脑海中完成汉字的解构与重构。',
      difficulty: '⭐⭐⭐⭐⭐',
      icon: '✍️',
      category: '语言逻辑',
      color: 'bg-emerald-500',
      tags: ['汉字储备', '路径规划', '瞬时记忆']
    },
    {
      id: 'arrow-maze',
      title: '箭阵迷域 (Arrow Maze)',
      description: '在 8×8 网格中，每个格子有多个箭头方向，玩家需要选择起始弓箭旋钮，将盘面中所有旋钮都消除。',
      difficulty: '⭐⭐⭐',
      color: 'bg-amber-800',
      icon: '🏹',
      category: '空间感知',
      tags: ['路径规划', '工作记忆']
    },
    {
      id: 'sheep-game',
      title: '羊了个羊 (Sheep Match)',
      description: '经典三消挑战。层层叠叠的陷阱，只有智者才能看到最后的那只羊。',
      difficulty: '⭐⭐⭐',
      color: 'bg-green-500',
      icon: '🐑',
      category: '逻辑消除',
      tags: ['三消', '策略', '层级思维']
    },
    {
      id: 'draw-guess',
      title: '你画我猜 (DoodleGame)',
      description: '我敢画！你敢猜吗？！',
      difficulty: '⭐',
      color: 'bg-yellow-200',
      icon: '🎨',
      category: '好友消遣',
      tags: ['联机', '休闲', '绘制']
    },
  ];

  const categories = ['全部', ...new Set(gameStore.map(game => game.category))];
  const filteredGames = useMemo(() => {
    return gameStore.filter(game => {
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            game.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === '全部' || game.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  // 点击开玩，跳转到游戏页并带上游戏 ID
  const handlePlay = (gameId) => {
    // 后续我们可以在 Game 页面通过路由参数读取这个 ID，来加载不同的游戏组件
    navigate(`/game?id=${gameId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-500 p-6 font-sans text-gray-900 dark:text-gray-100">
      <main className="max-w-6xl mx-auto">
        
        {/* --- 搜索与标题区域 --- */}
        <header className="mb-8 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">探索挑战</h1>
          
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text"
              placeholder="搜索游戏名称或介绍..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border-none ring-1 ring-gray-200 dark:ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
        </header>

        {/* --- 分类导航栏 --- */}
        <nav className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === cat 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-white dark:bg-[#1C1C1E] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* --- 游戏列表网格 --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredGames.length > 0 ? (
            filteredGames.map((game) => (
              /* 这里的 group 容器就是“卡包外壳” */
              <div 
                key={game.id}
                className="group relative h-[360px] flex flex-col justify-end"
              >
                {/* --- 抽出的小卡片 (图标) --- */}
                <div className={`
                  absolute top-8 left-1/2 -translate-x-1/2 
                  w-20 h-24 rounded-2xl ${game.color} 
                  flex items-center justify-center text-4xl shadow-xl
                  z-0 transition-all duration-500 ease-out
                  group-hover:-translate-y-12 group-hover:rotate-3 group-hover:scale-110
                `}>
                  {game.icon}
                  {/* 卡片高光装饰 */}
                  <div className="absolute inset-2 border border-white/20 rounded-xl"></div>
                </div>

                {/* --- 下方的卡包主体 (文字信息) --- */}
                <div className="
                  relative z-10 bg-white dark:bg-[#1C1C1E] 
                  rounded-[2rem] p-5 shadow-sm border border-gray-100 dark:border-white/5 
                  transition-all duration-300 group-hover:shadow-2xl
                ">
                  <div className="pt-6">
                    <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">
                      {game.category}
                    </span>
                    <h3 className="text-lg font-bold mt-1 truncate">{game.title}</h3>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 my-3 line-clamp-2 h-8">
                      {game.description}
                    </p>

                    {/* 标签与难度 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-1">
                        {game.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-gray-50 dark:bg-gray-800 text-gray-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] opacity-60 italic">{game.difficulty}</div>
                    </div>

                    <button 
                      onClick={() => handlePlay(game.id)}
                      className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                    >
                      开始挑战
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-gray-400">
              未找到匹配的游戏，换个关键词试试？
            </div>
          )}
        </div>
      </main>
    </div>
  );
}