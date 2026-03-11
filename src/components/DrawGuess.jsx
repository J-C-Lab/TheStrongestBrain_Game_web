import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {useNavigate } from 'react-router-dom';
import { BASE_URL } from '../apiConfig';
import { io } from 'socket.io-client';
const socket = io('http://223.2.46.245:3000'); // 使用你的局域网IP
const userId = localStorage.getItem('userId') || '游客' + Math.floor(Math.random()*1000);

const DrawGuess = () => {
  const [stats, setStats] = useState({ winRounds: 0, totalRounds: 0, timeSpent: 0 });
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [word, setWord] = useState('');
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);

  useEffect(() => {
    socket.emit('join-game', userId);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 适配移动端：设置画布物理尺寸
    canvas.width = window.innerWidth * 0.9;
    canvas.height = 400;

    // --- WebSocket 监听 ---
    socket.on('draw-line', ({ x0, y0, x1, y1, color }) => {
      drawLine(x0, y0, x1, y1, color, false);
    });

    socket.on('clear-canvas', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on('init-game', (data) => setWord(data.word));

    socket.on('next-round', (data) => {
        setWord(data.word);
        // 自动清空画板，准备下一轮
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 清空自己的输入框
        setGuess('');
    });

    socket.on('correct-answer', (data) => {
        // 更新本地保存的分数状态
        if (data.newScores[socket.id]) {
            setScore(data.newScores[socket.id]);
        }
    });

    socket.on('round-success', (data) => {
      setStats(prev => ({
        ...prev,
        winRounds: data.winRounds,
        totalRounds: data.totalRounds,
        timeSpent: data.timeSpent
      }));
      setWord(data.nextWord);
      clearCanvas(); // 自己写的清空画布函数
      toast.success(data.msg); // 使用你的 ToastContext
    });

    socket.on('round-skip', (data) => {
      setStats(prev => ({ ...prev, totalRounds: data.totalRounds }));
      setWord(data.nextWord);
      clearCanvas();
    });



    return () => socket.off();
  }, []);

  const drawLine = (x0, y0, x1, y1, color, emit = true) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    if (emit) {
      socket.emit('draw-line', { x0, y0, x1, y1, color });
    }
  };

  // --- 处理触摸/鼠标事件 (核心适配) ---
  const handleStart = (e) => {
    setIsDrawing(true);
    canvasRef.current.lastPos = getPos(e);
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    const currentPos = getPos(e);
    const lastPos = canvasRef.current.lastPos;
    drawLine(lastPos.x, lastPos.y, currentPos.x, currentPos.y, '#000');
    canvasRef.current.lastPos = currentPos;
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <div className="flex justify-between w-full max-w-md px-4">
        <span className="font-bold text-apple-lightText">题目：{word}</span>
        <span className="text-blue-500">得分：{score}</span>
      </div>
      {/* 协作信息栏 */}
      <div className="bg-white/10 p-3 rounded-2xl flex justify-around mb-4 text-sm">
        <div>合作赢数: <span className="text-green-400 font-bold">{stats.winRounds}</span></div>
        <div>总轮数: {stats.totalRounds}</div>
        <div>总耗时: {stats.timeSpent}s</div>
      </div>

      <canvas 
        ref={canvasRef}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={() => setIsDrawing(false)}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={() => setIsDrawing(false)}
        className="bg-white border-2 border-gray-200 rounded-2xl shadow-inner touch-none"
      />

      <div className="flex gap-2 w-full max-w-md">
        <input 
          className="flex-1 border rounded-xl px-4 py-2"
          placeholder="猜猜画的是什么？"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
        />
        <button 
          onClick={() => { socket.emit('submit-guess', guess); setGuess(''); }}
          className="bg-apple-lightText text-white px-6 py-2 rounded-xl active:scale-95 transition-transform"
        >
          提交
        </button>
      </div>
      
      <button onClick={() => {
        canvasRef.current.getContext('2d').clearRect(0, 0, 1000, 1000);
        socket.emit('clear-canvas');
      }} className="text-sm text-gray-400">清空画板</button>
    </div>
  );
};

export default DrawGuess;
