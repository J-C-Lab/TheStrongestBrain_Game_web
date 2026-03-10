import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import {useNavigate } from 'react-router-dom';
import { BASE_URL } from '../apiConfig';

export default function PreciseWordGame() {
  const [gameState, setGameState] = useState('setup'); // setup, playing, result
  const [isLoading, setIsLoading] = useState(false);
  const [resultData, setResultData] = useState({ isCorrect: false, score: 0, message: '' });
  const [lastEndIndex, setLastEndIndex] = useState(null); // 上一回合的末尾格子索引
  const [coolingRadicals, setCoolingRadicals] = useState([]); // 正在冷却的部首（下一轮恢复）
  const [justUsedRadicals, setJustUsedRadicals] = useState([]); // 刚刚用掉的（下轮将禁用）
  const { showMsg } = useToast();
  const navigate = useNavigate();

  // 游戏核心数据
  const [grid, setGrid] = useState([]); // 36 个字根
  const [radicalPool, setRadicalPool] = useState([]); // 6 个初始部首
  const [validCombinations, setValidCombinations] = useState({}); // 拼字字典
  const [currentPuzzleId, setCurrentPuzzleId] = useState(null);

  // 玩家操作状态
  const [selectedRadicals, setSelectedRadicals] = useState([]); // 当前选中的部首 (最多4个)
  const [disabledRadicals, setDisabledRadicals] = useState([]); // 当前回合被禁用的部首
  const [pathCells, setPathCells] = useState([]); // 当前选中的 4 个格子索引
  const [litCells, setLitCells] = useState([]); // 已经成功点亮的格子
  
  // 计时器
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef(null);

  // ==========================================
  // 1. 游戏生命周期与计时
  // ==========================================
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
            }
    return () => clearInterval(timerRef.current);
  }, [gameState, startTime]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startGame = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${BASE_URL}/api/precise-word/generate`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("获取题目失败");
      
      const data = await response.json();
      setGrid(data.gridComponents);
      setRadicalPool(data.radicalPool);
      setValidCombinations(data.validCombinations);
      setCurrentPuzzleId(data.puzzleId);
      
      // 重置所有状态
      setLitCells([]);
      setPathCells([]);
      setSelectedRadicals([]);
      setDisabledRadicals([]);
      setTimeElapsed(0);
      setStartTime(Date.now());
      setGameState('playing');
    } catch (error) {
      showMsg(error.message, 'error');
      setGameState('setup');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置盘面 (不重置时间)
  const handleResetBoard = () => {
    if (window.confirm('确定要熄灭所有已点亮文字重新开始吗？计时将继续！')) {
      setLitCells([]);
      setPathCells([]);
      setSelectedRadicals([]);
      setDisabledRadicals([]);
      setLastEndIndex(null); // 重置上一回合末尾格子索引

    }
  };

  // ==========================================
  // 2. 核心操作交互逻辑
  // ==========================================

  // 点击部首池
  const handleRadicalClick = (radical) => {
    if (disabledRadicals.includes(radical)) return; // 被禁用，不能点
    if (selectedRadicals.length >= 4) return; // 最多选 4 个
    setSelectedRadicals([...selectedRadicals, radical]);
  };

  // 点击已选部首将其移除
  const handleRemoveRadical = (index) => {
    const newSelected = [...selectedRadicals];
    newSelected.splice(index, 1);
    setSelectedRadicals(newSelected);
  };

  // 点击盘面格子 (路径规划算法)
  const handleGridClick = (index) => {
    if (litCells.includes(index)) return; // 已经点亮的不能再选

    // 情况 A：选择本回合的第一个格子
    if (pathCells.length === 0) {
      if (lastEndIndex === null) {
        // 游戏第一次启动，允许自由选择起始点
        setPathCells([index]);
      } else {
        // 必须从上一回合末尾格子的四周选择
        const r_last = Math.floor(lastEndIndex / 6), c_last = lastEndIndex % 6;
        const r_curr = Math.floor(index / 6), c_curr = index % 6;
        const dist = Math.abs(r_last - r_curr) + Math.abs(c_last - c_curr);

        if (dist === 1) {
          setPathCells([index]);
        } else {
          showMsg("非首轮起始格子必须选择在上一轮末尾格子的上下左右！", 'warning');
        }
      }
      return;
    }

    // 情况 B：选择回合内的第 2, 3, 4 个格子（路径连线）
    if (pathCells.length < 4) {
      if (pathCells.includes(index)) return; // 不能重复选

      const lastIdx = pathCells[pathCells.length - 1];
      const r1 = Math.floor(lastIdx / 6), c1 = lastIdx % 6;
      const r2 = Math.floor(index / 6), c2 = index % 6;
      
      // 严格相邻判定（上下左右，不含斜向）
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
        setPathCells([...pathCells, index]);
      } else {
        showMsg("请选择相邻的格子（不可斜选）！", 'warning');
      }
    }
  };

  // ==========================================
  // 3. 判卷引擎与结算
  // ==========================================

  const handleVerifyCombo = () => {
      if (selectedRadicals.length !== 4 || pathCells.length !== 4) {
      showMsg("请选满4个部首和4个相邻文字！", 'warning');
      return;
    }

    // 一一对应校验
    let allValid = true;
    for (let i = 0; i < 4; i++) {
      const comboKey = `${selectedRadicals[i]}+${grid[pathCells[i]]}`;
      if (!validCombinations[comboKey]) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      const newLitCells = [...litCells, ...pathCells];
      setLitCells(newLitCells);
      
      // 记录本轮结束位置，作为下轮起点
      setLastEndIndex(pathCells[3]);

      // 部首冷却逻辑流转：
      // 1. 本轮使用的部首进入冷却名单
      // 2. 上一轮冷却的部首在本轮结束后恢复（清空旧冷却，设置新冷却）
      setDisabledRadicals([...new Set(selectedRadicals)]); // 下一轮禁用
      setCoolingRadicals([]); // 之前的冷却清空（如果需要更细致的恢复逻辑可以调整）

      setPathCells([]);
      setSelectedRadicals([]);
      
      if (newLitCells.length === 36) submitGameResult(false);
    } else {
      showMsg("重构失败，汉字不存在！", 'error');
    }
  };

  // 提交给后端统分
  const submitGameResult = async (isSurrender = false) => {
    clearInterval(timerRef.current);
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${BASE_URL}/api/precise-word/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          puzzleId: currentPuzzleId, 
          timeSpent: finalTime,
          isSurrender: isSurrender 
        })
      });
      const data = await res.json();
      
      setResultData({
        isCorrect: data.isCorrect,
        score: data.scoreEarned,
        message: data.message
      });

      if (data.isCorrect && !isSurrender) {
        import('canvas-confetti').then((confetti) => confetti.default({ particleCount: 150, spread: 70 }));
      }
      setGameState('result');
    } catch (error) {
      showMsg("网络错误，提交失败！", 'error');
    }
  };

  // ==========================================
  // 4. UI 渲染区
  // ==========================================
  
  // 准备界面
  if (gameState === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-stone-600 to-stone-400 dark:from-stone-300 dark:to-stone-500 tracking-widest drop-shadow-sm">
          精准造字
        </h1>
        <p className="text-gray-500 mb-12 text-center max-w-lg leading-relaxed">
          6x6 文字矩阵，提取右侧部首，重构汉字形体。<br/>
          注：同回合内被使用的部首，将在下一回合进入冷却状态。
        </p>
        <button 
          onClick={startGame} 
          disabled={isLoading}
          className="px-10 py-4 text-xl font-bold rounded-2xl bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
        >
          {isLoading ? '加载题库...' : '开启挑战'}
        </button>
      </div>
    );
  }

  // 结算界面
  if (gameState === 'result') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className={`text-6xl mb-6 ${resultData.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
          {resultData.isCorrect ? '🏆' : '💔'}
        </div>
        <h2 className="text-3xl font-bold mb-4">{resultData.message}</h2>
        {resultData.isCorrect && <p className="text-xl text-apple-blue font-bold mb-8">获得积分: +{resultData.score}</p>}
        <button onClick={() => navigate('/GameStore')} className="px-8 py-3 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 transition-colors">
          返回选关
        </button>
      </div>
    );
  }

// 游玩界面
  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 animate-fade-in flex flex-col items-center">
      
      {/* 1. 顶部状态栏：跟着右侧一起缩小，宽度从 880px 减小到 820px */}
      <div className="w-full max-w-[820px] flex justify-between items-center bg-white dark:bg-[#1C1C1E] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 mb-6">
        <div className="flex gap-4">
          <button onClick={handleResetBoard} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-200 transition">↺ 重置盘面</button>
          <button onClick={() => submitGameResult(true)} className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-bold hover:bg-rose-200 transition">🏳️ 投降</button>
        </div>
        <div className="text-2xl font-mono font-bold tracking-widest text-stone-700 dark:text-stone-300">
          ⏳ {formatTime(timeElapsed)}
        </div>
        <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
          进度: {litCells.length} / 36
        </div>
      </div>

      {/* 2. 游戏主体：总宽度限制也从 880px 改为 820px */}
      <div className="w-full max-w-[820px] flex flex-col md:flex-row justify-between items-start gap-6 md:gap-8">
        
        {/* 左侧：6x6 汉字石板 (保持完美，完全不动！) */}
        <div className="w-full max-w-[460px] shrink-0 bg-stone-800 dark:bg-stone-900 p-4 md:p-6 rounded-3xl shadow-2xl border-[8px] md:border-[12px] border-stone-600 dark:border-stone-800 relative">
          <div className="grid grid-cols-6 gap-1.5 md:gap-2">
            {grid.map((cell, index) => {
              const isLit = litCells.includes(index);
              const isPath = pathCells.includes(index);
              const pathOrder = pathCells.indexOf(index);
              
              let bgClass = "bg-stone-700/50 hover:bg-stone-600";
              let textClass = "text-stone-300";
              
              if (isLit) {
                bgClass = "bg-emerald-900/40 border-emerald-500/50";
                textClass = "text-emerald-400 opacity-50";
              } else if (isPath) {
                bgClass = "bg-apple-blue shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-105 z-10";
                textClass = "text-white font-black";
              }

              return (
                <div 
                  key={index} 
                  onClick={() => handleGridClick(index)}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xl md:text-2xl cursor-pointer transition-all duration-300 border border-transparent select-none relative ${bgClass} ${textClass}`}
                >
                  {cell}
                  {isPath && (
                    <span className="absolute top-1 right-1 text-[10px] bg-white text-apple-blue w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                      {pathOrder + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ==============================================
            右侧：部首操作台 (核心瘦身区) 
            ============================================== */}
        {/* 【修改】总宽度从 380px 缩小到 320px，间距稍微收紧 */}
        <div className="w-full max-w-[320px] shrink-0 flex flex-col gap-4">
          
          {/* 选定槽位 */}
          {/* 【修改】内边距 p-6 改为 p-5 */}
          <div className="bg-stone-100 dark:bg-[#1C1C1E] p-5 rounded-3xl border border-stone-200 dark:border-white/5">
            <h3 className="text-stone-500 text-sm font-bold mb-3 uppercase tracking-widest text-center">本轮选择部首</h3>
            {/* 【修改】槽位尺寸 w-14/h-14 缩小到 w-12/h-12，字号 3xl 降到 2xl */}
            <div className="flex justify-center gap-2 h-14">
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i}
                  onClick={() => selectedRadicals[i] && handleRemoveRadical(i)}
                  className={`w-12 h-12 flex items-center justify-center text-2xl font-bold rounded-xl border-2 transition-all ${
                    selectedRadicals[i] 
                      ? 'bg-white dark:bg-stone-800 border-apple-blue text-apple-blue cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 group' 
                      : 'border-dashed border-stone-300 dark:border-stone-700 bg-transparent'
                  }`}
                >
                  {selectedRadicals[i] && (
                     <span className="relative">
                        {selectedRadicals[i]}
                        <span className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 text-lg backdrop-blur-sm rounded bg-white/50 dark:bg-black/50 transition-opacity">✕</span>
                     </span>
                  )}
                </div>
              ))}
            </div>
            {/* 【修改】按钮高度 py-4 降到 py-3，字号降低一点 */}
            <button 
              onClick={handleVerifyCombo}
              className="w-full mt-5 py-3 rounded-xl bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 font-bold text-base hover:bg-stone-900 transition-colors shadow-lg active:scale-95"
            >
              融合重构
            </button>
          </div>

          {/* 部首池 */}
          {/* 【修改】内边距和网格间距缩小 */}
          <div className="bg-stone-100 dark:bg-[#1C1C1E] p-5 rounded-3xl border border-stone-200 dark:border-white/5 flex-1">
            <h3 className="text-stone-500 text-sm font-bold mb-3 uppercase tracking-widest text-center">基础部首池</h3>
            <div className="grid grid-cols-3 gap-3">
              {radicalPool.map((radical, index) => {
                const isDisabled = disabledRadicals.includes(radical);
                return (
                  <div 
                    key={index}
                    onClick={() => handleRadicalClick(radical)}
                    // 【修改】字号从 text-4xl 缩小到 text-3xl，圆角稍微改小一点
                    className={`aspect-square flex flex-col items-center justify-center text-3xl rounded-xl border-2 transition-all duration-200 select-none ${
                      isDisabled 
                        ? 'bg-stone-200 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-400 cursor-not-allowed grayscale' 
                        : 'bg-white dark:bg-stone-800 border-transparent shadow-sm hover:shadow-md hover:-translate-y-1 cursor-pointer text-stone-700 dark:text-stone-200 hover:border-apple-blue'
                    }`}
                  >
                    {radical}
                    {isDisabled && <span className="text-[10px] mt-1 font-bold text-rose-500">冷却中</span>}
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}