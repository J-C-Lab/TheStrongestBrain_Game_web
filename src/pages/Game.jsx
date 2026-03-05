import { useSearchParams, useNavigate } from 'react-router-dom';
import LifeGame from '../components/LifeGame'; // 引入你的生命游戏组件

export default function Game() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 从网址中抓取游戏 id (比如点击后网址变成 /game?id=life-game，这里就是 'life-game')
  const gameId = searchParams.get('id');

  // 根据游戏 ID 动态渲染不同的组件
  const renderGame = () => {
    switch (gameId) {
      case 'life-game':
        return <LifeGame />;
      case 'spatial-fold':
        return <div className="text-center py-20 text-gray-500">空间折叠开发中...</div>;
      case 'logic-maze':
        return <div className="text-center py-20 text-gray-500">盲眼迷宫开发中...</div>;
      default:
        return <div className="text-center py-20 text-red-500">找不到该游戏模块！</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 font-sans">
      {/* 顶部信息 */}
        <div className="flex items-center pt-4 mb-2">
            {/* 返回按钮 - 去掉原有的 mb-6，保留 pt-4 到外层 flex 容器 */}
            <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
            <span>←</span> 返回仓库
            </button>
            
            {/* 游戏标题 - 和按钮同行 */}
            <h2 className="flex-1 text-center text-2xl font-bold">生命游戏 (Game of Life)</h2>
        </div>
      {/* 渲染具体游戏画面 */}
      {renderGame()}
    </div>
  );
}