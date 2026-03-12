import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { useToast } from '../context/ToastContext';
import { BASE_URL } from '../apiConfig';

// 建立连接时带上 Token 进行初步身份校验
const socket = io(BASE_URL.replace('/api', ''), {
  auth: { token: localStorage.getItem('token') }
});

export default function DoodleGame() {
  const { showMsg } = useToast();
  
  // 核心状态控制
  const [view, setView] = useState('join'); // 'join' | 'select-role' | 'playing' | 'result'
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState(null); // 'painter' | 'guesser'
  const [word, setWord] = useState('');
  const [guess, setGuess] = useState('');
  
  
  // 统计数据
  const [stats, setStats] = useState({ winRounds: 0, totalRounds: 0, startTime: null });
  const [timer, setTimer] = useState(0);
  const [lastDrawData, setLastDrawData] = useState(null); // 用于结算界面展示画作

  // 画板引用
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#4A2B11'); // 默认深木色笔触
  const [isEraser, setIsEraser] = useState(false);

  // 1. Socket 监听逻辑
  
  useEffect(() => {
    socket.on('waiting-partner', (data) => {
        setView('waiting');
        showMsg(data.msg, "info");
    });
    // winRounds: rooms[roomId].winRounds,
    //         totalRounds: rooms[roomId].totalRounds,
    //         score:rooms[roomId].score,
    //         startTime: rooms[roomId].startTime,
    //         word: rooms[roomId].word // 前端会根据身份自行遮蔽
    socket.on('init-game', (data) => {
      setStats({ winRounds: data.winRounds, totalRounds: data.totalRounds, score: data.score, startTime: data.roundStartTime });
      setWord(data.word);
      setView('playing');
    });

    socket.on('draw-line', (data) => {
      drawOnCanvas(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });

    socket.on('next-round', (data) => {
      fireConfetti();
      setWord(data.word);
      setRole(data.role);
      setStats(prev => ({ ...prev, winRounds: data.winRounds, totalRounds: data.totalRounds, startTime: data.roundStartTime }));
      clearLocalCanvas();
    });

    socket.on('round-skip', (data) => {
      showMsg("已跳过！两人均不扣分", "info");
      setWord(data.word);
      setStats(prev => ({ ...prev, totalRounds: data.totalRounds, startTime: data.roundStartTime }));
      clearLocalCanvas();
    });

    return () => socket.off();
  }, []);

  // 2. 实时计时器
  useEffect(() => {
    if (view !== 'playing') return;
    const interval = setInterval(() => {
      if (stats.startTime) setTimer(Math.floor((Date.now() - stats.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [stats.startTime, view]);

  // --- 交互逻辑 ---
  const handleJoin = () => {
    if (!roomId) return showMsg("请输入房间号", "error");
    setView('select-role');
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
    // 发送身份给后端
    socket.emit('join-room', { 
        roomId, 
        userId: localStorage.getItem('userId'), 
        role: selectedRole 
    });
    // 先进入等待视图
    setView('waiting');
  };

  const drawOnCanvas = (x0, y0, x1, y1, color, size, emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (emit) socket.emit('draw-line', { roomId, x0, y0, x1, y1, color, size });
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const fireConfetti = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  };

  const handleGameOver = () => {
    setLastDrawData(canvasRef.current.toDataURL()); // 截取画作
    setView('result');
  };

  // --- 视图渲染 ---

  // A. 输入房间号页面
  if (view === 'join') return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/5 w-full max-w-sm text-center">
        <div className="text-5xl mb-6">🎨</div>
        <h2 className="text-2xl font-bold mb-6">输入房间号开启迷域</h2>
        <input 
          type="text" placeholder="例如: 888" 
          value={roomId} onChange={e => setRoomId(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 p-4 rounded-xl mb-4 text-center font-bold text-xl outline-none focus:ring-2 ring-blue-500"
        />
        <button onClick={handleJoin} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-600/30">进入大厅</button>
      </div>
    </div>
  );

  // B. 身份选择弹窗
  if (view === 'select-role') return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md text-center">
        <h3 className="text-xl font-bold mb-8">请选择你在本局的身份</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => selectRole('painter')} className="group flex flex-col items-center p-6 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all">
            <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">🖌️</span>
            <span className="font-bold">灵魂画师</span>
          </button>
          <button onClick={() => selectRole('guesser')} className="group flex flex-col items-center p-6 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border-2 border-transparent hover:border-amber-500 transition-all">
            <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔎</span>
            <span className="font-bold">天才神探</span>
          </button>
        </div>
      </div>
    </div>
  );

  // C. 结算页面
  if (view === 'result') return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-apple-in">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl w-full max-w-md text-center border-t-8 border-blue-500">
        <h2 className="text-3xl font-black mb-2">分数结算</h2>
        <p className="text-slate-500 mb-6">Room: {roomId}</p>
        
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex justify-around mb-4">
            <div className="flex flex-col">
              <span className="text-xs opacity-50">合作赢取</span>
              <span className="text-2xl font-bold text-green-500">{stats.winRounds} 轮</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs opacity-50">加分详情</span>
              <span className="text-2xl font-bold text-blue-500">+{stats.winRounds} 积分</span>
            </div>
          </div>
          {lastDrawData && <img src={lastDrawData} className="w-full h-32 object-contain bg-white rounded-lg border" alt="画作" />}
        </div>

        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold">再来一局</button>
          <button onClick={() => window.history.back()} className="flex-1 bg-slate-200 dark:bg-slate-700 py-4 rounded-2xl font-bold">结束游戏</button>
        </div>
      </div>
    </div>
  );

  //D.等待队友视图
  if (view === 'waiting') return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-pulse">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-center border-2 border-dashed border-blue-500/30">
              <div className="text-6xl mb-6">⏳</div>
              <h2 className="text-2xl font-bold mb-2">正在等待队友...</h2>
              <p className="text-slate-500 mb-6">房间号：<span className="font-mono text-blue-500">{roomId}</span></p>
              <div className="flex justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <button 
                  onClick={() => setView('select-role')} 
                  className="mt-8 text-sm text-blue-500 underline"
              >
                  返回修改身份
              </button>
          </div>
      </div>
  );

  // D. 游戏主界面
  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 select-none">
      {/* 顶部工具栏 */}
      <div className="w-full max-w-2xl flex justify-between items-end mb-6">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur px-6 py-2 rounded-2xl shadow-sm border border-black/5">
          <div className="text-[10px] uppercase opacity-40 font-bold">Progress</div>
          <div className="font-mono font-bold text-blue-600">Round {stats.totalRounds} | Score {stats.winRounds}</div>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur px-6 py-2 rounded-2xl shadow-sm border border-black/5 text-center">
          <div className="text-[10px] uppercase opacity-40 font-bold">Round Timer</div>
          <div className="font-mono font-bold text-rose-500">{Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}</div>
        </div>
        <button onClick={handleGameOver} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold">结算退出</button>
      </div>

      {/* 画板显示：木质画架效果 */}
      <div className="relative p-6 bg-[#D2B48C] rounded-lg shadow-2xl border-[12px] border-[#8B4513]">
        {/* 画纸部分 */}
        <div className="bg-white shadow-inner relative">
          <canvas
            ref={canvasRef}
            width={window.innerWidth > 600 ? 600 : window.innerWidth - 80}
            height={400}
            className={`touch-none ${role === 'painter' ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={(e) => { if(role==='painter') { setIsDrawing(true); canvasRef.current.lastPos=getPos(e); }}}
            onMouseMove={(e) => {
                if(!isDrawing || role!=='painter') return;
                const pos = getPos(e);
                drawOnCanvas(canvasRef.current.lastPos.x, canvasRef.current.lastPos.y, pos.x, pos.y, isEraser ? '#FFFFFF' : brushColor, isEraser ? 20 : 4);
                canvasRef.current.lastPos = pos;
            }}
            onMouseUp={() => setIsDrawing(false)}
            // 触屏逻辑同上
          />
          
          {/* 画师提示 */}
          {role === 'painter' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-pulse">
              请画：{word}
            </div>
          )}
        </div>

        {/* 调色盘 & 工具 */}
        {role === 'painter' && (
          <div className="flex justify-center gap-4 mt-6">
            {['#4A2B11', '#E63946', '#457B9D', '#2A9D8F', '#F4A261'].map(c => (
              <button 
                key={c} onClick={() => {setBrushColor(c); setIsEraser(false);}}
                className={`w-10 h-10 rounded-full border-4 ${brushColor === c && !isEraser ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <button onClick={() => setIsEraser(!isEraser)} className={`w-10 h-10 rounded-full text-xl flex items-center justify-center bg-white border-4 ${isEraser ? 'border-blue-500' : 'border-transparent'}`}>🧽</button>
            <button onClick={handleSkip} className="px-6 py-2 bg-[#8B4513] text-white rounded-full font-bold text-sm">⏭ 跳过此题</button>
          </div>
        )}
      </div>

      {/* 猜题输入框 */}
      {role === 'guesser' && (
        <div className="mt-10 w-full max-w-lg flex gap-3">
          <input 
            value={guess} onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && socket.emit('submit-guess', { roomId, guess })}
            className="flex-1 bg-white dark:bg-slate-800 border-4 border-[#8B4513]/20 rounded-2xl px-6 py-4 outline-none focus:border-[#8B4513] transition-all font-bold"
            placeholder="那是... 苹果吗？"
          />
          <button 
            onClick={() => { socket.emit('submit-guess', { roomId, guess }); setGuess(''); }}
            className="bg-[#8B4513] text-white px-10 rounded-2xl font-bold shadow-lg"
          >
            提交猜想
          </button>
        </div>
      )}
    </div>
  );

  // 辅助函数：坐标获取
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
}