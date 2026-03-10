import { useState } from 'react';
import confetti from 'canvas-confetti'; // 引入礼炮魔法！
import { useToast } from '../context/ToastContext';
import { BASE_URL } from '../apiConfig';

export default function LifeGame() {
  const [difficulty, setDifficulty] = useState(1);
  const [gameState, setGameState] = useState('setup'); // setup | playing | result
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState(null);//记录时间
  const { showMsg } = useToast();
  
  const cols = difficulty * 10; 

  const [initialGrid, setInitialGrid] = useState([]);
  const [playerGrid, setPlayerGrid] = useState([]);
  const [currentPuzzleId, setCurrentPuzzleId] = useState(null);
  
  // 【新增】用来存储结算画面的数据
  const [resultData, setResultData] = useState({ 
    isCorrect: false, 
    score: 0, 
    actualSolution: null 
  });

  const startGame = async (level) => {
    setDifficulty(level);
    setIsLoading(true);
    setStartTime(Date.now()); // 记录游戏开始的精确毫秒时间戳
    setResultData({ isCorrect: false, score: 0, actualSolution: null }); // 重置结算状态
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${BASE_URL}/api/api/life-game/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`  
        },
        body: JSON.stringify({ difficulty: level })
      });
      const data = await response.json();

      setInitialGrid(data.initialGrid);
      setCurrentPuzzleId(data.puzzleId);
      setPlayerGrid(Array(data.rows).fill().map(() => Array(data.cols).fill(0)));
      setGameState('playing');
    } catch (error) {
      showMsg("连接后端失败，请确保 server 已启动！", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCell = (r, c) => {
    if (gameState !== 'playing') return; // 结算后禁止再点击
    const newGrid = playerGrid.map(row => [...row]);
    newGrid[r][c] = newGrid[r][c] ? 0 : 1;
    setPlayerGrid(newGrid);
  };

  // 提交验证逻辑
  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    // 计算耗时 (当前时间减去开局时间，除以1000变成秒)
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    try {
      const response = await fetch(`${BASE_URL}/api/api/life-game/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`  
        },
        body: JSON.stringify({ 
          puzzleId: currentPuzzleId, 
          playerGrid: playerGrid,
          difficulty: difficulty,
          gameId: 'life-game',
          timeSpent: timeSpent  // 【关键】把真实耗时发给后端！
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})); // 防止后端连 JSON 都没返回
        throw new Error(errData.error || `后端接口异常，状态码: ${response.status}`);
      }
      const data = await response.json();

      // 【防御机制 2】只有成功拿到所有数据，才将数据写入状态
      setResultData({ 
        isCorrect: data.isCorrect, 
        score: data.scoreEarned, 
        actualSolution: data.actualSolution 
      });

      if (data.isCorrect) {        
        // 🎉 触发全屏撒花特效！
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#10B981', '#F59E0B'] // 苹果风配色
        });
      } 
    
      setGameState('result');
    } catch (error) {
      console.error("提交验证失败:", error);
      showMsg(`提交失败: ${error.message}\n请检查后端控制台是否有报错！`, 'error');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto animate-fade-in">
      
      {/* 头部控制区 */}
      <div className="w-full flex justify-end items-center mb-6">
        {gameState === 'setup' && (
          <div className="flex gap-2 items-center">
            {isLoading ? (
              <span className="text-apple-blue font-bold animate-pulse">🧠 正在生成盘面...</span>
            ) : (
              <>
                <button onClick={() => startGame(1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-80 transition">简单 (区域一)</button>
                <button onClick={() => startGame(2)} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:opacity-80 transition">中等 (区域二)</button>
                <button onClick={() => startGame(3)} className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:opacity-80 transition">困难 (区域三)</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 【新增】炫酷的结算横幅 */}
      {gameState === 'result' && (
        <div className={`w-full p-3 m-0 mb-3 rounded-2xl flex items-center justify-between text-white shadow-xl transform transition-all duration-500 scale-100 ${
          resultData.isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-500 to-rose-400'
        }`}>
          <div>
            <h3 className="text-2xl font-black tracking-wide mb-1">
              {resultData.isCorrect ? '🎉 挑战成功！' : '❌ 挑战失败！'}
            </h3>
            <p className="opacity-90">
              {resultData.isCorrect ? '你完美推演了最终形态，拥有真正的最强大脑！' : '很遗憾，你的预测与最终稳定态有出入，请看下方对比。'}
            </p>
          </div>
          {resultData.isCorrect && (
            <div className="text-right">
              <span className="text-sm font-medium opacity-80">本次获得积分</span>
              <div className="text-5xl font-black drop-shadow-md">+{resultData.score}</div>
            </div>
          )}
        </div>
      )}

      {/* 游戏主体区域 */}
      {gameState !== 'setup' && (
        <div className={`flex flex-col gap-8 w-full ${cols === 10 ? 'md:flex-row' : 'xl:flex-row'} items-center justify-center`}>
          
          {/* 左侧：题目展示区 / 结算时的正确答案区 */}
          <div className="flex-1 flex flex-col items-center w-full">
            <h3 className={`mb-4 font-semibold ${gameState === 'result' && !resultData.isCorrect ? 'text-emerald-500 font-bold' : 'text-gray-500'}`}>
              {gameState === 'result' && !resultData.isCorrect ? '✅ 标准答案' : '初始盘面 (考题)'}
            </h3>
            <div 
              className={`grid gap-[1px] bg-gray-300 dark:bg-gray-600 border rounded shadow-lg w-full mx-auto ${
                gameState === 'result' && !resultData.isCorrect ? 'border-emerald-500 border-2' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 32}px` }}
            >
              {/* 如果是失败结算，左边展示正确答案；否则展示初始盘面 */}
              {(gameState === 'result' && !resultData.isCorrect ? resultData.actualSolution : initialGrid).map((row, r) => 
                row.map((cell, c) => (
                  <div 
                    key={`left-${r}-${c}`} 
                    className={`w-full aspect-square transition-colors duration-300 ${
                      cell 
                        ? 'bg-yellow-400 relative z-10 shadow-[0_0_4px_rgba(250,204,21,0.5)]' 
                        : 'bg-[#64748b] dark:bg-[#334155]'
                    }`}
                  />
                ))
              )}
            </div>
          </div>

          {/* 右侧：玩家作答区 */}
          <div className="flex-1 flex flex-col items-center w-full">
            <h3 className={`mb-4 font-bold ${gameState === 'result' && !resultData.isCorrect ? 'text-red-500' : 'text-apple-blue'}`}>
              你的预测 {gameState === 'result' && !resultData.isCorrect && '(红框为错误点)'}
            </h3>
            <div 
              className={`grid gap-[1px] bg-gray-300 dark:bg-gray-600 border rounded shadow-lg w-full mx-auto ${
                gameState === 'playing' ? 'cursor-pointer' : 'cursor-default'
              } ${gameState === 'result' && !resultData.isCorrect ? 'border-red-500 border-2' : 'border-gray-300 dark:border-gray-600'}`}
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 32}px` }}
            >
              {playerGrid.map((row, r) => 
                row.map((cell, c) => {
                  // 【高光时刻】结算失败时，找出玩家填错的格子并标红框
                  const isWrong = gameState === 'result' && !resultData.isCorrect && cell !== resultData.actualSolution[r][c];
                  
                  return (
                    <div 
                      key={`player-${r}-${c}`} 
                      onClick={() => toggleCell(r, c)}
                      className={`w-full aspect-square transition-all duration-150 ${
                        gameState === 'playing' ? 'hover:brightness-110' : ''
                      } ${
                        cell 
                          ? 'bg-yellow-400 relative shadow-[0_0_4px_rgba(250,204,21,0.5)]' 
                          : 'bg-[#64748b] dark:bg-[#334155]'
                      } ${
                        isWrong ? 'border-2 border-red-500 animate-pulse z-20' : 'z-10'
                      }`}
                    />
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* 提交预测按钮：单独拆到页面底部，居右对齐 */}
      {gameState === 'playing' && (
        <div className="w-full flex justify-end border-t border-gray-200 dark:border-gray-800">
            <button onClick={handleSubmit} className="px-6 py-2 bg-apple-blue text-white font-bold rounded-lg shadow-lg hover:scale-105 transition-transform">
            提交预测
            </button>
        </div>
       )}

      {/* 规则说明 (仅在未开始时显示) */}
      {gameState === 'setup' && (
        <div className="mt-12 p-6 apple-glass rounded-2xl max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          <h4 className="font-bold text-lg mb-2 text-apple-lightText dark:text-apple-darkText">规则说明 (B3/S23)</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>细胞的生存规律由它周围 8 个格子的存活细胞数量决定。</li>
            <li><strong className="text-apple-blue">诞生 (B3)</strong>：灰色格子周围有且仅有 3 个黄色细胞时，变为黄色。</li>
            <li><strong className="text-yellow-500">存活 (S23)</strong>：黄色细胞周围有 2 或 3 个黄色细胞时，继续保持黄色。</li>
            <li><strong className="text-red-500">死亡</strong>：周围活细胞不足 2 个（孤单）或多于 3 个（拥挤）时，变为灰色。</li>
            <li>请根据左侧初始盘面，推演其<strong>最终的稳定形态</strong>，并在右侧画出。</li>
          </ul>
        </div>
      )}
    </div>
  );
}