import React, { useState, useEffect, useCallback } from 'react';

// 图标池
const ICONS = ['🧶','🥎','🪅','🧸', '🌽', '🥕', '🪵', '🔥', '🔔', '🥛', '✂️'];

export default function SheepGame() {
  // --- 状态管理 ---
  const [cards, setCards] = useState([]);
  const [slot, setSlot] = useState([]);
  const [tempSlot, setTempSlot] = useState([]); // 移出道具区
  const [history, setHistory] = useState([]);   // 撤销区
  const [difficulty, setDifficulty] = useState('简单');
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('playing'); // playing, won, lost
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const FORMATIONS = {
    'T': [[0,0], [1,0], [2,0], [1,1], [1,2]],
    'O': [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]],
    'H': [[0,0], [0,1], [0,2], [1,1], [2,0], [2,1], [2,2]],
    'CROSS': [[1,0], [0,1], [1,1], [2,1], [1,2]]
    };

  // --- 核心：初始化发牌算法 ---
  const initGame = useCallback((diffLevel) => {
    const config = {
        '简单': { iconCount: 4, sets: 2, layers: 3, forms: ['O'] },
        '中等': { iconCount: 6, sets: 4, layers: 6, forms: ['T', 'O'] },
        '困难': { iconCount: 8, sets: 10, layers: 12, forms: ['T', 'O', 'H', 'CROSS'] }
    }[diffLevel || difficulty];

    const newCards = [];
    let iconPool = [];
    
    // 确保每种图标都是 3 的倍数
    for (let i = 0; i < config.iconCount; i++) {
      for (let j = 0; j < config.sets * 3; j++) {
        iconPool.push(ICONS[i]);
      }
    }
    iconPool = iconPool.sort(() => Math.random() - 0.5);

    // 生成坐标：层级越高，越中心化
    pool.forEach((icon, index) => {
        const layer = Math.floor(Math.random() * config.layers);
        // 随机选择一个阵型
        const formKey = config.forms[Math.floor(Math.random() * config.forms.length)];
        const formPos = FORMATIONS[formKey][index % FORMATIONS[formKey].length];
        
        // 基础坐标 + 阵型偏移 + 随机扰动
        const x = 100 + formPos[0] * 50 + (Math.random() * 10);
        const y = 50 + formPos[1] * 55 + (layer * 2); 

        newCards.push({ id: `c-${index}`, icon, x, y, layer, status: 0 });
    });

    setCards(newCards);
    setSlot([]);
    setTempSlot([]);
    setHistory([]);
    setScore(0);
    setGameState('playing');
  }, [difficulty]);

  useEffect(() => {
    let interval = null;
    if (gameState === 'playing' && !isPaused) {
        interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
        clearInterval(interval);
    }
    return () => clearInterval(interval);
    }, [gameState, isPaused]);

    // 结算并传给后端
    const submitGameResult = async (finalState) => {
    const payload = {
        gameId: 'sheep-game',
        timeSpent: seconds,
        difficulty: difficulty,
        result: finalState, // 'won' 或 'lost'
        score: score
    };
    
    try {
        await fetch('http://localhost:3000/api/sheep-game/deal', {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
            },
        body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("结算失败", e);
    }
    };

    // 投降按钮
    const handleSurrender = () => {
    if (window.confirm("确定要投降吗？当前积分将清零")) {
        setGameState('lost');
        submitGameResult('surrender');
    }
    };

  // --- 辅助逻辑：遮挡判定 ---
  const isCovered = (card) => {
    return cards.some(other => 
      other.status === 0 && 
      other.layer > card.layer && 
      Math.abs(other.x - card.x) < 45 && 
      Math.abs(other.y - card.y) < 45
    );
  };

  // --- 核心交互：点击卡片 ---
  const handleCardClick = (card) => {
    if (gameState !== 'playing' || isCovered(card) || slot.length >= 7) return;

    // 记录历史（仅存5步）
    setHistory(prev => [...prev, { cards: [...cards], slot: [...slot] }].slice(-5));

    // 移动到槽位并自动排序
    const newSlot = [...slot, card].sort((a, b) => a.icon.localeCompare(b.icon));
    setSlot(newSlot);
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 1 } : c));

    // 检查消除
    const counts = {};
    newSlot.forEach(c => counts[c.icon] = (counts[c.icon] || 0) + 1);
    const match = Object.keys(counts).find(icon => counts[icon] === 3);

    if (match) {
      setTimeout(() => {
        const scoreGain = { '简单': 10, '中等': 30, '困难': 100 }[difficulty];
        setScore(s => s + scoreGain);
        setSlot(prev => prev.filter(c => c.icon !== match));
        setCards(prev => {
          const updated = prev.map(c => (c.icon === match && c.status === 1) ? { ...c, status: 2 } : c);
          // 检查胜利
          if (updated.every(c => c.status === 2)) setGameState('won');
          return updated;
        });
      }, 200);
    } else if (newSlot.length === 7) {
      setGameState('lost');
    }
  };

  // --- 三大工具逻辑 ---
  const toolMoveOut = () => {
    if (slot.length < 3 || tempSlot.length > 0) return;
    setTempSlot(slot.slice(0, 3));
    setSlot(prev => prev.slice(3));
  };

  const toolUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setCards(last.cards);
    setSlot(last.slot);
    setHistory(h => h.slice(0, -1));
  };

  const toolShuffle = () => {
    const active = cards.filter(c => c.status === 0);
    const pos = active.map(c => ({ x: c.x, y: c.y, layer: c.layer })).sort(() => Math.random() - 0.5);
    setCards(prev => {
      let i = 0;
      return prev.map(c => c.status === 0 ? { ...c, ...pos[i++] } : c);
    });
  };

  return (
    <div className="flex flex-col items-center bg-[#cbed91] md:max-h-[79vh] rounded-[3rem] p-6 shadow-2xl relative overflow-hidden select-none">
      
      {/* 顶部状态栏 */}
      <div className="w-full flex justify-between items-center mb-6 px-4">
        <div className="flex gap-2">
          {['简单', '中等', '困难'].map(d => (
            <button key={d} onClick={() => {setDifficulty(d); initGame(d);}}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${difficulty === d ? 'bg-[#4a6b22] text-white' : 'bg-white/50 text-[#4a6b22]'}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="text-[#4a6b22] font-black text-xl">SCORE: {score}</div>
      </div>

      {/* 游戏主容器 */}
      <div className="relative w-full max-w-[400px] h-[480px] bg-green-200/30 rounded-3xl inner-shadow overflow-hidden">
        {cards.filter(c => c.status === 0).map(card => {
          const covered = isCovered(card);
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={`absolute w-12 h-14 bg-white rounded-xl flex items-center justify-center text-3xl border-b-[6px] border-gray-300 transition-all duration-300
                ${covered ? 'brightness-50 grayscale-[0.3]' : 'cursor-pointer hover:-translate-y-1 shadow-xl active:scale-90'}`}
              style={{ left: card.x, top: card.y, zIndex: card.layer }}
            >
              {card.icon}
            </div>
          );
        })}

        {/* 结算弹窗 */}
        {gameState !== 'playing' && (
          <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl animate-bounce-short">
              <h3 className="text-4xl mb-2">{gameState === 'won' ? '🎉 羊群领袖!' : '😵 咩~ 输了'}</h3>
              <p className="text-gray-500 mb-6">{gameState === 'won' ? '你通过了不可能的挑战！' : '格子塞满了，换个思路再来一次？'}</p>
              <button onClick={() => initGame()} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition">
                再战一局
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 移出暂存区 */}
      <div className="h-16 flex gap-2 mt-4">
        {tempSlot.map((c, i) => (
          <div key={i} onClick={() => { if(slot.length < 7) { setSlot(prev => [...prev, c].sort((a,b)=>a.icon.localeCompare(b.icon))); setTempSlot(t => t.filter(x => x.id !== c.id)); }}}
            className="w-10 h-12 bg-white/80 rounded shadow flex items-center justify-center text-xl cursor-pointer hover:scale-110 transition">
            {c.icon}
          </div>
        ))}
      </div>

      {/* 底部 7 槽位 */}
      <div className="w-[340px] h-20 bg-[#8b5a2b] border-[6px] border-[#5d3a1d] rounded-2xl flex items-center px-2 gap-1.5 shadow-2xl mt-2">
        {slot.map((s, i) => (
          <div key={i} className="w-10 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-md animate-pop-in">
            {s.icon}
          </div>
        ))}
      </div>

      {/* 道具按钮 */}
      <div className="flex gap-8 mt-8">
        <ToolBtn icon="📤" label="移出" onClick={toolMoveOut} disabled={tempSlot.length > 0 || slot.length < 3} />
        <ToolBtn icon="🔙" label="撤销" onClick={toolUndo} disabled={history.length === 0} />
        <ToolBtn icon="🔄" label="洗牌" onClick={toolShuffle} />
      </div>
    </div>
  );
}

// 道具按钮子组件
function ToolBtn({ icon, label, onClick, disabled }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-30' : 'opacity-100'}`}>
      <button onClick={onClick} disabled={disabled}
        className="w-14 h-14 bg-blue-500 rounded-full shadow-[0_5px_0_#2563eb] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center text-white text-2xl">
        {icon}
      </button>
      <span className="text-[10px] font-bold text-[#4a6b22] uppercase tracking-tighter">{label}</span>
    </div>
  );
}