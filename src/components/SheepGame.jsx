import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {useNavigate } from 'react-router-dom';

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
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();

  const FORMATIONS = {
    'T': [[0,0], [1,0], [2,0], [1,1], [1,2]],
    'O': [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]],
    'H': [[0,0], [0,1], [0,2], [1,1], [2,0], [2,1], [2,2]],
    'CROSS': [[1,0], [0,1], [1,1], [2,1], [1,2]]
  };

  // --- 核心：初始化发牌算法 ---
  const initGame = useCallback((diffLevel = difficulty, isNewSession = false) => {
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
    iconPool.forEach((icon, index) => {
        const layer = Math.floor(index / (iconPool.length / config.layers));
        // 随机选择一个阵型
        const formKey = config.forms[Math.floor(Math.random() * config.forms.length)];
        const formPos = FORMATIONS[formKey][index % FORMATIONS[formKey].length];
        
        // 增加随机偏移量 (Offset) 制造不规则层叠感
        const randomOffset = (Math.random() - 0.5) * 25;

        newCards.push({
          id: `c-${index}`,
          icon,
          x: 80 + formPos[0] * 55 + randomOffset,
          y: 40 + formPos[1] * 60 + (layer * 4) + randomOffset, // layer * 4 产生视觉高度差
          layer: layer,
          status: 0 // 0: 场上, 1: 槽位, 2: 消除
        });
    });

    setCards(newCards);
    setSlot([]);
    setTempSlot([]);
    setHistory([]);
    setScore(0);
    setGameState('playing');
    if (isNewSession) {
      setScore(0);
      setSeconds(0);
    }
  }, [difficulty]);

  // 首次进入页面自动开始
  useEffect(() => { initGame(); }, []);

  // 计时逻辑
  useEffect(() => {
    let interval = (gameState === 'playing') ? setInterval(() => setSeconds(s => s + 1), 1000) : null;
    if (gameState === 'playing' && !isPaused) {
        interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
        clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [gameState, isPaused]);

  // 结算并传给后端
  const submitGameResult = async () => {
    const payload = { gameId: 'sheep-game', timeSpent: seconds, difficulty, result: gameState, score };
    try {
      const res = await fetch('http://localhost:3000/api/sheep-game/deal', {
        method: 'POST', // 确保这里是 POST
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      console.log(res);
      navigate('/GameStore');
    } catch (e) { console.error("结算失败", e); }

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
      Math.abs(other.x - card.x) < 40 && 
      Math.abs(other.y - card.y) < 40
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
        setSlot(prev => prev.filter(c => c.icon !== match));
        setCards(prev => {
          const updated = prev.map(c => (c.icon === match && c.status === 1) ? { ...c, status: 2 } : c);
          
          // --- 胜利判定：全场消除后加分 ---
          if (updated.every(c => c.status === 2)) {
            const winScore = { '简单': 5, '中等': 10, '困难': 20 }[difficulty];
            setScore(prevScore => prevScore + winScore); // 累加积分
            setGameState('won');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }
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
      <div className="w-full max-w-[420px] flex justify-between items-center mb-6 px-4 bg-white/30 p-4 rounded-3xl">
        <div className="flex flex-col">
            <span className="text-xs font-black text-[#4a6b22] opacity-60">DIFFICULTY</span>
            <div className="flex gap-1 mt-1">
                {['简单', '中等', '困难'].map(d => (
                    <button key={d} onClick={() => {setDifficulty(d); initGame(d, true);}} 
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${difficulty === d ? 'bg-[#4a6b22] text-white' : 'bg-white/50 text-[#4a6b22]'}`}>{d}</button>
                ))}
            </div>
        </div>

        <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-gray-500">Timer</span>
            <span className="font-mono font-bold text-[#4a6b22]">{Math.floor(seconds/60)}:{(seconds%60).toString().padStart(2,'0')}</span>
          </div>
          <div className="w-[1px] h-6 bg-gray-400/20" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-gray-500">Score</span>
            <span className="font-mono font-bold text-[#4a6b22]">{score}</span>
          </div>
        </div>

        <button 
          onClick={() => setShowRules(true)}
          className="w-10 h-10 bg-white/80 rounded-full shadow-inner flex items-center justify-center hover:scale-110 transition"
        >
          ❓
        </button>
      </div>

      {/* 游戏主容器 */}
      <div className="relative w-full max-w-[400px] h-[480px] bg-green-200/30 rounded-3xl inner-shadow overflow-hidden">
        {cards.filter(c => c.status === 0).map(card => (
          <div key={card.id} onClick={() => handleCardClick(card)}
            className={`absolute w-12 h-14 bg-white rounded-xl flex items-center justify-center text-2xl border-b-[5px] border-gray-300 transition-all 
            ${isCovered(card) ? 'brightness-50 grayscale shadow-none' : 'cursor-pointer hover:-translate-y-1 shadow-lg'}`}
            style={{ left: card.x, top: card.y, zIndex: card.layer }}>
            {card.icon}
          </div>
        ))}

        {/* 结算弹窗 */}
        {gameState !== 'playing' && (
          <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl scale-in-center">
              <h3 className="text-4xl mb-2">{gameState === 'won' ? '🎉 挑战成功' : '😵 挑战失败'}</h3>
              <p className="text-gray-500 mb-6">本次获得积分:<span className="text-red-600 font-bold">{score}</span></p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { initGame(); }} // 保持积分，重新发牌
                  className="w-full py-4 bg-[#4a6b22] text-white rounded-2xl font-bold hover:brightness-110"
                >
                 再来一局 (积分保留)
                </button>
                <button onClick={submitGameResult} className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">结算并离开</button>
                

              </div>
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

      {showRules && (
        <div className="absolute inset-0 z-[200] bg-white/80 backdrop-blur-xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in">
          <div className="max-w-xs text-center">
            <h3 className="text-2xl font-black mb-4">游戏规则</h3>
            <ul className="text-left space-y-3 text-gray-700 font-medium">
              <li>🎯 选中 3 个相同图标即可消除</li>
              <li>📥 槽位满 7 个则挑战失败</li>
              <li>⏱️ 10分钟内完成每组得 20 分</li>
              <li>🏳️ 投降将导致当前积分清零并失败</li>
            </ul>
            <button 
              onClick={() => setShowRules(false)}
              className="mt-8 px-12 py-3 bg-[#4a6b22] text-white rounded-full font-bold shadow-lg shadow-green-900/20"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
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