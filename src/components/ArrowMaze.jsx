import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import confetti from 'canvas-confetti';
import {useNavigate } from 'react-router-dom';

// 方向坐标偏移量
const DIR_MAP = {
  'N':  { dy: -1, dx: 0,  angle: 270 }, 'S':  { dy: 1,  dx: 0,  angle: 90 },
  'E':  { dy: 0,  dx: 1,  angle: 0 },   'W':  { dy: 0,  dx: -1, angle: 180 },
  'NE': { dy: -1, dx: 1,  angle: 315 }, 'NW': { dy: -1, dx: -1, angle: 225 },
  'SE': { dy: 1,  dx: 1,  angle: 45 },  'SW': { dy: 1,  dx: -1, angle: 135 }
};

export default function ArrowMaze() {
  const { showMsg } = useToast();
  const [grid, setGrid] = useState([]);
  const [activatedIds, setActivatedIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [currentPuzzleId, setCurrentPuzzleId] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const navigate = useNavigate();
  
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'result'
  const [resultData, setResultData] = useState({ isCorrect: false, score: 0, message: '' });

  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const CELL_SIZE = 50;
  const GAP = 6;
  const OFFSET = CELL_SIZE / 2;

  useEffect(() => {
        const fetchPuzzle = async () => {
        try {
        const response = await fetch('http://localhost:3000/api/arrow-maze/puzzle', {
            method: 'GET', // 显式指定
            headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('请求失败');
        
        const data = await response.json();
        
        // 这里的处理要非常小心
        let parsedGrid = [];
        if (typeof data.nodes_data === 'string') {
            parsedGrid = JSON.parse(data.nodes_data);
    
        } else {
            parsedGrid = data.nodes_data;
        }
        
        // 先按 y (行) 排序，y 相同时按 x (列) 排序
        const sortedGrid = [...parsedGrid].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        setGrid(sortedGrid);
        setCurrentPuzzleId(data.puzzleId);
        
        startTimer();
        } catch (error) {
            console.error("获取盘面失败:", error);
        showMsg("获取盘面失败: " + error.message, "error");
        }
    };

    fetchPuzzle();
    return () => stopTimer();
    }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  // 1. 核心动画：能量束飞行
  const animateSingleLaser = (fromNode, toNode, dir) => {
    return new Promise((resolve) => {
      const ctx = canvasRef.current.getContext('2d');
      const move = DIR_MAP[dir];
      const startX = fromNode.x * (CELL_SIZE + GAP) + OFFSET; 
      const startY = fromNode.y * (CELL_SIZE + GAP) + OFFSET;
      
      let endX = toNode ? toNode.x * (CELL_SIZE + GAP) + OFFSET : startX + move.dx * 500;
      let endY = toNode ? toNode.y * (CELL_SIZE + GAP) + OFFSET : startY + move.dy * 500;

      let progress = 0;
      const speed = 0.15; 

      function draw() {
        // 注意：多束光同时飞时不能在这里 clearRect，否则会互相擦除
        progress += speed;
        if (progress > 1) progress = 1;

        const currX = startX + (endX - startX) * progress;
        const currY = startY + (endY - startY) * progress;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(currX, currY);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (progress < 1) requestAnimationFrame(draw);
        else resolve(toNode);
      }
      draw();
    });
  };

  // 2. 链式触发逻辑与结算
  const handleStart = async (startNode) => {
    if (isProcessing || isGameOver) return;
    setIsProcessing(true);
    
    let currentActivated = new Set([startNode.id]);
    setActivatedIds(new Set([startNode.id]));

    // 使用递归函数实现并行发射
    const triggerNode = async (node) => {
      // 这里的关键：并行处理当前节点的所有方向
      const promises = node.dirs.map(async (dir) => {
        let target = null;
        let step = 1;
        while(true) {
          const tx = node.x + DIR_MAP[dir].dx * step;
          const ty = node.y + DIR_MAP[dir].dy * step;
          if (tx < 0 || tx >= 8 || ty < 0 || ty >= 8) break;
          const found = grid.find(n => n.x === tx && n.y === ty);
          if (found && !currentActivated.has(found.id)) {
            target = found;
            break;
          }
          step++;
        }

        await animateSingleLaser(node, target, dir);
        
        if (target) {
          currentActivated.add(target.id);
          // 实时更新消失状态
          setActivatedIds(new Set(currentActivated));
          await triggerNode(target);// 递归触发下一个
        }
      });
      
      await Promise.all(promises);
    };

    await triggerNode(startNode);
    
    // 动画结束后清理画布并结算
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 600, 600);
    finalizeGame(currentActivated.size === grid.length, currentActivated.size);
  };

  const finalizeGame = async (isWin, count) => {
    stopTimer();
    setIsGameOver(true);
    setIsProcessing(false);
    try {
      const res = await fetch('http://localhost:3000/api/arrow-maze/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isAllCleared: isWin, timeSpent: timer })
      });
      const data = await res.json();
      
      // 更新结算数据
      setResultData({
        isCorrect: isWin,
        score: data.score || 0,
        message: isWin ? '挑战成功！全盘清空' : `挑战失败，剩余 ${grid.length - count} 个`
      });

      // 如果成功，放彩带
      if (isWin) fireConfetti();

      // 切换到结算界面
      setGameState('result');

    } catch (e) {
      showMsg("结算同步失败", "error");
    }
  };

  // 投降逻辑
  const handleSurrender = () => {
    if (isGameOver) window.location.reload();
    else finalizeGame(false, activatedIds.size);
  };
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // 触发彩带的函数
  const fireConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#60a5fa', '#3b82f6', '#ffffff']
    });
  };

  if (gameState === 'result') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-white min-h-screen">
        <div className={`text-6xl mb-6 ${resultData.isCorrect ? 'animate-bounce' : ''}`}>
          {resultData.isCorrect ? '🏆' : '💔'}
        </div>
        <h2 className="text-3xl font-bold mb-4 text-blue-600">{resultData.message}</h2>
        {resultData.isCorrect && (
          <div className="text-center">
            <p className="text-2xl text-blue-400 font-bold mb-2">获得积分: +{resultData.score}</p>
            <p className="text-slate-500 text-sm mb-8">用时: {Math.floor(timer/60)}分{timer%60}秒</p>
          </div>
        )}
        <button 
          onClick={() => navigate('/GameStore')} // 或者 setGameState('playing') 并重置数据
          className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          返回选关
        </button>
      </div>
    );
  }

  return (
    // 1. 确保最外层容器能够正确承载高度
    <div className="flex flex-col items-center justify-start min-h-screen w-full text-white p-2 overflow-y-auto">
    
    {/* 2. 状态栏保持不变 */}
    <div className="w-full max-w-lg flex justify-between items-center mb-4 mt-4">
        <div className="flex gap-3 items-center">
          <div className="bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/30">
            <span className="text-blue-400 font-mono text-lg">⏱ {Math.floor(timer/60).toString().padStart(2,'0')}:{(timer%60).toString().padStart(2,'0')}</span>
          </div>
          <button 
            onClick={handleSurrender}
            className="px-4 py-1.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/30 hover:bg-rose-500/20 text-sm font-bold transition-all"
          >
            {isGameOver ? '↺ 重赛' : '🏳️ 投降'}
          </button>
        </div>
        <div className="text-xs text-slate-500 italic">预期最高分: {timer < 300 ? '20' : timer < 600 ? '10' : '5'}</div>
      </div>

        {/* 核心盘面容器 */}
        <div className="relative p-10 select-none flex justify-center items-center" style={{ width: '560px', height: '560px' }}>
        {/* 顶部 A-H 列标 */}
        <div className="absolute top-4 left-[52px] right-[52px] flex justify-between text-blue-400 font-bold text-sm">
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(l => (
            <span key={l} className="w-[50px] text-center">{l}</span>
            ))}
        </div>
        
        {/* 左侧 1-8 行标 */}
        <div className="absolute left-4 top-[52px] bottom-[52px] flex flex-col justify-between text-blue-400 font-bold text-sm">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <span key={n} className="h-[50px] flex items-center">{n}</span>
            ))}
        </div>

        <div className="relative p-3 rounded-xl bg-slate-900/60 border border-white/10 shadow-2xl overflow-hidden">
            {/* 动画画布 */}
            <canvas 
            ref={canvasRef} 
            width={450} height={450} 
            className="absolute inset-3 z-10 pointer-events-none" 
            />

            {/* 旋钮网格 */}
            <div className="grid grid-cols-8 gap-[6px] relative z-20">
            {grid && grid.length > 0 ? grid.map((node, idx) => {
                // --- 核心防御性检查 ---
                if (!node || !node.dirs) return <div key={idx} className="w-[50px] h-[50px]" />;

                const isActivated = activatedIds.has(node.id);
                
                return (
                <div 
                    key={node.id} 
                    onClick={() => handleStart(node)}
                    className={`w-[50px] h-[50px] rounded-lg flex items-center justify-center transition-all duration-300
                    ${isActivated 
                        ? 'opacity-0 scale-0 rotate-45 pointer-events-none' 
                        : 'bg-slate-800 border border-blue-500/20 hover:border-blue-400 cursor-pointer shadow-sm active:scale-95'
                    }`}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                    {node.dirs.map((d, i) => (
                        <div 
                        key={i} 
                        className="absolute text-blue-400/70 text-base pointer-events-none" 
                        style={{ transform: `rotate(${DIR_MAP[d]?.angle || 0}deg) translateX(10px)` }}
                        >
                        ➤
                        </div>
                    ))}
                    </div>
                </div>
                );
            }) : (
                // 加载状态占位
                Array(64).fill(0).map((_, i) => (
                    <div key={i} className="w-[50px] h-[50px] bg-slate-800/40 rounded-lg animate-pulse" />
                ))
            )}
            </div>
        </div>
        </div>

      {/* 规则介绍 */}
      {showRules && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 p-7 rounded-[28px] max-w-sm animate-apple-in">
            <h3 className="text-xl font-bold mb-4 text-blue-400 text-center">箭阵迷域</h3>
            <div className="space-y-3 text-slate-400 text-xs leading-relaxed mb-6">
              <p>1. 选择任意旋钮启动，它会沿指向发射能量束。</p>
              <p>2. 能量束击中路径上第一个未激活旋钮并将其触发。</p>
              <p>3. 目标：一次性触发全盘所有旋钮。</p>
              <p>4. 计分：5/10/20分钟内完成分别加 20/10/5 分。</p>
            </div>
            <button 
              onClick={() => setShowRules(false)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20"
            >
              进入迷域
            </button>
          </div>
        </div>
      )}
    </div>
  );
}