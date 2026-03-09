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
  const [playCount, setPlayCount] = useState(1); // 初始为第一轮
  const [winCount, setWinCount] = useState(0);

  const FORMATIONS = {
    'T': [
      [0,0], [1,0], [2,0], [3,0],
      [1.5, 1], [1.5, 2], [1.5, 3]
    ],
    'O': [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]],
    'H': [[0,0], [0,1], [0,2], [1,1], [2,0], [2,1], [2,2]],
    'CROSS': [[1,0], [0,1], [1,1], [2,1], [1,2]],
    'HOLLOW_SQUARE': [
      [0,0], [1,0], [2,0], [3,0], [4,0],
      [0,1], [4,1],
      [0,2], [4,2],
      [0,3], [4,3],
      [0,4], [1,4], [2,4], [3,4], [4,4]
    ],
    'WINGS': { left: [-1.5, 2], right: [5.5, 2] }
  };

  const rebalanceHiddenIcons = (allCards, currentSlot = [], currentTempSlot = []) => {
    const activeCards = allCards.filter(c => c.status === 0);
    if (activeCards.length === 0) return allCards;

    // 1. 内部判定：哪些牌被压住了（status 为 0 且被其他 status 为 0 的牌盖住）
    const checkIsCovered = (card, all) => {
      return all.some(other => 
        other.status === 0 && 
        other.layer > card.layer && 
        Math.abs(other.x - card.x) < 40 && 
        Math.abs(other.y - card.y) < 40
      );
    };

    // 2. 统计当前所有“已暴露”的图标总数（可见卡片 + 槽位 + 暂存区）
    const visibleCards = activeCards.filter(c => !checkIsCovered(c, allCards));
    const hiddenCards = activeCards.filter(c => checkIsCovered(c, allCards));

    const counts = {};
    [...visibleCards, ...currentSlot, ...currentTempSlot].forEach(c => {
      counts[c.icon] = (counts[c.icon] || 0) + 1;
    });

    // 3. 计算为了凑成 3n，总共还需要补齐哪些图标
    let neededIcons = [];
    Object.keys(counts).forEach(icon => {
      const remainder = counts[icon] % 3;
      if (remainder !== 0) {
        for (let i = 0; i < (3 - remainder); i++) {
          neededIcons.push(icon);
        }
      }
    });

    // 4. 核心逻辑：确定哪些卡片的图标是可以“悄悄”修改的
    // 优先改隐藏的 (hiddenCards)，如果隐藏的不够（游戏后期），再动可见的 (visibleCards)
    let cardsToModify = [...hiddenCards];
    if (neededIcons.length > hiddenCards.length) {
      // 只有当底层牌真的不够补齐落单图标时，才动可见牌（按层级从低到高排，尽量减小视觉冲击）
      const additionalNeeded = visibleCards.sort((a, b) => a.layer - b.layer);
      cardsToModify = [...hiddenCards, ...additionalNeeded];
    }

    // 5. 构造平衡后的图标池
    let finalPool = [...neededIcons];
    while (finalPool.length < cardsToModify.length) {
      const randomIcon = ICONS[Math.floor(Math.random() * ICONS.length)];
      for (let i = 0; i < 3; i++) {
        if (finalPool.length < cardsToModify.length) finalPool.push(randomIcon);
      }
    }
    finalPool = finalPool.slice(0, cardsToModify.length).sort(() => Math.random() - 0.5);

    // 6. 映射回原数组：只针对被选中的 cardsToModify 进行修改
    const modifyIds = new Set(cardsToModify.map(c => c.id));
    let mIdx = 0;

    return allCards.map(c => {
      if (modifyIds.has(c.id)) {
        return { ...c, icon: finalPool[mIdx++] };
      }
      return c;
    });
  };

  // --- 核心：初始化发牌算法 ---
  const initGame = useCallback((diffLevel = difficulty, isNewSession = false) => {
    const config = {
        '简单': { iconCount: 3, sets: 2, layers: 3, forms: ['O'], wingCount: 0 },
        '中等': { iconCount: 7, sets: 3, layers: 6, forms: ['T', 'O', 'HOLLOW_SQUARE'], wingCount: 6 },
        '困难': { iconCount: 11, sets: 3, layers: 10, forms: ['T', 'O', 'H', 'CROSS', 'HOLLOW_SQUARE'], wingCount: 12}
    }[diffLevel || difficulty];

  // 1. 预先确定所有位置（Position Seeds）
    const posSeeds = [];
    
    // 中心区位置
    const totalMainCards = (config.iconCount * config.sets * 3) - (config.wingCount * 2);
    for (let i = 0; i < totalMainCards; i++) {
      const layer = Math.floor(i / (totalMainCards / config.layers));
      const formKey = config.forms[Math.floor(Math.random() * config.forms.length)];
      const formPos = FORMATIONS[formKey][i % FORMATIONS[formKey].length];
      posSeeds.push({
        x: 155 + formPos[0] * 60 + (Math.random() * 8), 
        y: 60 + formPos[1] * 65 + (layer * 3) + (Math.random() * 8),
        layer: layer,
        type: 'main'
      });
    }

    // 侧边区位置
    for (let i = 0; i < config.wingCount * 2; i++) {
      const isLeft = i < config.wingCount;
      const stackIndex = isLeft ? i : i - config.wingCount;
      posSeeds.push({
        x: isLeft ? 20 : 580,
        y: 250 + (stackIndex * 2),
        layer: 1000 + stackIndex,
        type: 'wing'
      });
    }

    // 2. 【核心】按层级从高到低排序，进行逆向填充
    const sortedSeeds = posSeeds.sort((a, b) => b.layer - a.layer);
    const finalCards = [];
    
    // 准备图标池（确保每种 3 个）
    let iconPool = [];
    for (let i = 0; i < config.iconCount; i++) {
      for (let j = 0; j < config.sets * 3; j++) {
        iconPool.push(ICONS[i % ICONS.length]);
      }
    }
    // 随机打乱图标池，但保持 3 个一组的逻辑
    // (实际上这里直接打乱单个 icon 也可以，因为我们只要保证总数对即可)
    iconPool = iconPool.sort(() => Math.random() - 0.5);

    // 3. 将图标分配给位置
    sortedSeeds.forEach((seed, index) => {
      finalCards.push({
        id: `c-${index}`,
        icon: iconPool[index],
        ...seed,
        status: 0
      });
    });

    setCards(finalCards);
    setSlot([]);
    setTempSlot([]);
    setHistory([]);
    setGameState('playing');
    if (isNewSession) {
      setSeconds(0);
    }else{
      setPlayCount(prev => prev + 1)
    }
  }, [difficulty]);

  // 首次进入页面自动开始
  useEffect(() => { 
    setWinCount(0);
    setPlayCount(0);
    initGame(difficulty,true); 
  }, []);

  // 计时逻辑
  useEffect(() => {
    let interval = null;
    // 确保只有一个计时器在运行，且仅在 playing 状态下
    if (gameState === 'playing' && !isPaused) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, isPaused]);

  // 结算并传给后端
  const submitGameResult = async () => {
    const payload = { gameId: 'sheep-game', timeSpent: seconds, difficulty, result: gameState, score , playCount: playCount , winCount: winCount };
    setScore(0);
    try {
      await fetch('http://localhost:3000/api/sheep-game/deal', {
        method: 'POST', // 确保这里是 POST
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
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

  const checkMatch = (currentSlot) => {
    const counts = {};
    currentSlot.forEach(c => counts[c.icon] = (counts[c.icon] || 0) + 1);
    const matchIcon = Object.keys(counts).find(icon => counts[icon] === 3);

    if (matchIcon) {
      setTimeout(() => {
        const newSlot = currentSlot.filter(c => c.icon !== matchIcon);
        setSlot(newSlot);
        setCards(prev => {
          const updated = prev.map(c => (c.icon === matchIcon && c.status === 1) ? { ...c, status: 2 } : c);

          // --- 核心修正点：必须将 rebalance 的结果赋值并返回 ---
          const activeCards = updated.filter(c => c.status === 0);
          let finalCards = updated; 
          
          if (activeCards.length > 0) {
            // 这里必须把 balanced 结果存下来
            finalCards = rebalanceHiddenIcons(updated, newSlot, tempSlot); 
          }

         // 2. 判定胜利（使用 finalCards 进行判定）
        const remaining = finalCards.filter(c => c.status !== 2).length;
        if (remaining === 0 && gameState === 'playing') {
          setGameState('won');
          setWinCount(prev => prev + 1);
          const winScore = { '简单': 5, '中等': 10, '困难': 20 }[difficulty];
          setScore(s => s + winScore); 
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }

          return finalCards;
        });
      }, 200);
    } else if (currentSlot.length === 7) {
      setGameState('lost');
    }
  };

  // --- 核心交互：点击卡片 ---
  const handleCardClick = (card) => {
    if (gameState !== 'playing' || isCovered(card) || slot.length >= 7) return;
    // 记录历史（仅存5步）
    setHistory(prev => [...prev, { cards: [...cards], slot: [...slot] }].slice(-5));
    const newSlot = [...slot, card].sort((a, b) => a.icon.localeCompare(b.icon));
    setSlot(newSlot);
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: 1 } : c));
    checkMatch(newSlot, cards);
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
    setCards(prev => {
      const activeCards = prev.filter(c => c.status === 0);
      const shuffledPositions = activeCards.map(c => ({ x: c.x, y: c.y, layer: c.layer })).sort(() => Math.random() - 0.5);
      let i = 0;
      const positioned = prev.map(c => c.status === 0 ? { ...c, ...shuffledPositions[i++] } : c);
      return rebalanceHiddenIcons(positioned, slot, tempSlot);
    });
  };

  // 从暂存区移回槽位 (修复无法消除的 Bug)
  const moveBackToSlot = (card) => {
    if (slot.length >= 7) return;
    const newSlot = [...slot, card].sort((a, b) => a.icon.localeCompare(b.icon));
    setSlot(newSlot);
    setTempSlot(prev => prev.filter(c => c.id !== card.id));
    checkMatch(newSlot, cards); // 移回后立即触发检查
  };



return (
    <div className="flex max-h-[80vh] rounded-lg bg-[#cbed91] p-6 gap-6 items-center justify-center font-sans overflow-hidden">
      
      {/* 左侧：游戏核心区 */}
      <div className="flex flex-col items-center gap-4 max-h-[79vh]">
        {/* 顶部状态 */}
        <div className="w-[500px] flex justify-between bg-white/40 p-4 rounded-3xl backdrop-blur-md">
          <div className="flex gap-2">
            {['简单', '中等', '困难'].map(d => (
              <button key={d} onClick={() => {setDifficulty(d); initGame(d, true);}} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${difficulty === d ? 'bg-[#4a6b22] text-white shadow-lg' : 'bg-white/50 text-[#4a6b22]'}`}>{d}</button>
            ))}
          </div>
          <div className="flex gap-4 font-mono font-bold text-[#4a6b22]">
            <span>TIME: {Math.floor(seconds/60)}:{(seconds%60).toString().padStart(2,'0')}</span>
            <span className="text-red-600">SCORE: {score}</span>
          </div>
        </div>

        {/* 游戏卡片容器 */}
        <div className="relative w-[500px] h-[500px] bg-green-900/10 rounded-[3rem] border-8 border-white/20 overflow-hidden">
          {cards.filter(c => c.status === 0).map(card => (
            <div key={card.id} onClick={() => handleCardClick(card)}
              className={`absolute w-14 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl border-b-[6px] border-gray-300 transition-all duration-300 ${isCovered(card) ? 'brightness-50 grayscale shadow-none' : 'cursor-pointer hover:-translate-y-1 shadow-xl active:scale-95'}`}
              style={{ left: card.x, top: card.y, zIndex: card.layer }}>
              {card.icon}
            </div>
          ))}

          {/* 结算覆盖层 */}
          {gameState !== 'playing' && (
            <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
              <div className="bg-white rounded-[3rem] p-10 shadow-2xl text-center max-w-sm">
                <h3 className="text-4xl font-black text-gray-800 mb-2">{gameState === 'won' ? '🎉 羊群领袖!' : '😵 咩 ~ 挑战失败'}</h3>
                <p className="text-gray-500 mb-8">累计积分: <span className="text-red-600 font-bold">{score}</span></p>
                <div className="flex flex-col gap-4">
                  <button onClick={() => initGame()} className="py-4 bg-[#4a6b22] text-white rounded-2xl font-bold text-lg hover:brightness-110 active:scale-95 transition">再战一局</button>
                  <button onClick={() => { 
                    submitGameResult(gameState); // 上报并跳转
                    window.location.href = '/GameStore'; 
                  }} 
                  className="py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-lg hover:bg-gray-200">结算并离开</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部槽位 */}
        <div className="relative w-[450px] h-24 bg-[#8b5a2b] border-[8px] border-[#5d3a1d] rounded-3xl items-center px-3 gap-2 shadow-2xl overflow-hidden">

          <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none ">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-12 h-14 border-2 border-dashed border-white/20 rounded-xl" />
            ))}
          </div>
          <div className = "flex items-center justify-center gap-2 z-10">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-12 h-14 flex items-center justify-center">
                {slot[i] ? (
                  <div className="mt-2 w-12 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-md animate-bounce-short">
                    {slot[i].icon}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      

      {/* 右侧：道具与暂存区 */}
      <div className="flex flex-col gap-4 items-center bg-white/30 p-6 max-h-[79vh] rounded-[3rem] backdrop-blur-lg border border-white/40 shadow-xl">
        <h4 className="text-[#4a6b22] font-black tracking-widest text-sm">PROPS & TEMP</h4>
        
        {/* 暂存区盒子 */}
        <div className="w-16 h-72 bg-green-900/10 rounded-2xl border-2 border-dashed border-[#4a6b22]/30 flex flex-col items-center justify-start py-3 gap-3">
          {tempSlot.map((c, i) => (
            <div key={i} onClick={() => moveBackToSlot(c)} className="w-10 h-12 bg-white/90 rounded-xl flex items-center justify-center text-xl cursor-pointer hover:scale-110 hover:rotate-3 transition shadow-md">
              {c.icon}
            </div>
          ))}
        </div>

        {/* 操作按钮组 */}
        <div className="flex flex-col gap-3 ">
          <ToolBtn icon="📤"  label="移出" onClick={toolMoveOut} disabled={tempSlot.length > 0 || slot.length < 3} />
          <ToolBtn icon="🔙"  label="撤销" onClick={toolUndo} disabled={history.length === 0} />
          <ToolBtn icon="🔄"  label="洗牌" onClick={toolShuffle} />
          <button onClick={() => setShowRules(true)} className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-xl shadow-lg hover:scale-110">❓</button>
        </div>
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

function ToolBtn({ icon, label, onClick, disabled }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-30' : 'opacity-100'}`}>
      <button onClick={onClick} disabled={disabled} className="w-11 h-11 bg-blue-500 rounded-3xl shadow-[0_6px_0_#2563eb] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center text-white text-3xl">
        {icon}
      </button>
      <span className="text-[10px] font-black text-[#4a6b22] uppercase mt-1">{label}</span>
    </div>
  );
}
