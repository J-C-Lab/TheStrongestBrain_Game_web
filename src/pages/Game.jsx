import { useSearchParams, useNavigate } from 'react-router-dom';
import LifeGame from '../components/LifeGame'; // 引入生命游戏组件
import PreciseWord from '../components/PreciseWord'; // 引入精准造字游戏组件
import ArrowMaze from '../components/ArrowMaze'; // 引入箭阵迷域游戏组件
import SheepGame from '../components/SheepGame'//引入羊了个羊组件
import DrawGuess from '../components/DrawGuess'
import RealFencing from '../components/RealFencing';

export default function Game() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 从网址中抓取游戏 id (比如点击后网址变成 /game?id=life-game，这里就是 'life-game')
  const gameId = searchParams.get('id');
  console.log("Routing to game:", gameId);

  // 根据游戏 ID 动态渲染不同的组件
  const gameComponents = {
    'life-game': <LifeGame />,
    'precise-word': <PreciseWord />,
    'arrow-maze': <ArrowMaze />,
    'sheep-game': <SheepGame />,
    'draw-guess': <DrawGuess/>,
    'real-fencing': <RealFencing />,
  };
  const currentGame = gameComponents[gameId];
  const isRealFencing = gameId === 'real-fencing';

  return (
    <div className={`${isRealFencing ? 'w-full max-w-none px-4 md:px-6' : 'max-w-7xl px-6'} mx-auto font-sans`}>
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
            {/* <h2 className="flex-1 text-center text-2xl font-bold">{gameStore.find(game => game.id === gameId)?.title || '游戏标题'}</h2> */}
        </div>
      {/* 渲染具体游戏画面 */}
      <div className={isRealFencing ? 'mt-4 w-full min-h-[75vh]' : 'mt-4'}>
          {currentGame ? (
            currentGame
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-red-500 font-bold">找不到 ID 为 "{gameId}" 的游戏模块</p>
              <button onClick={() => navigate('/')} className="mt-4 text-blue-500 underline">
                返回首页重试
              </button>
            </div>
          )}
        </div>
    </div>
  );
}