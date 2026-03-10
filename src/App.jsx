import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import Game from './pages/Game';
import Login from './pages/Login';
import Home from './pages/Home';
import GameStore from './pages/GameStore';
import Navbar from './components/Navbar';
import { ToastProvider } from './context/ToastContext';
import './index.css'

// 路由守卫组件
// 它的逻辑是：如果 localStorage 里有 isAuthenticated，就放行渲染 children (也就是你的页面)；如果没有，就强行打回 /login
const ProtectedRoute = () => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const socket = io('http://223.2.46.245:3000');

function App() {
  useEffect(() => {
    // 监听有人上线
    socket.on('someone_joined', (data) => {
      console.log('新队友上线，ID:', data.id);
    });

    // 监听广播消息
    socket.on('new-message', (data) => {
      alert('收到广播：' + data);
    });

    // 3. 组件销毁时记得清理，防止内存泄漏和重复弹窗
    return () => {
      socket.off('someone_joined');
      socket.off('new-message');
    };
  }, []);

  // 提供一个发送函数，给下层组件调用（后续建议用 Context 传这个 socket）
  const testSend = () => {
    socket.emit('chat-message', '从 PC 端发来的问候！');
  };
  return (
    <ToastProvider>
      <BrowserRouter>
        {/* 最外层容器负责全局背景色和文字颜色 */}
        <div className="h-screen w-screen overflow-x-hidden flex flex-col bg-apple-lightBg dark:bg-apple-darkBg text-apple-lightText dark:text-apple-darkText transition-colors duration-500">
          
          {/* Navbar 现在是真·全局组件 */}
          <Navbar />
          <button onClick={testSend} className="fixed bottom-4 right-4 z-50 bg-blue-500 p-2 rounded">发送广播</button>
          {/*  统一为导航栏留出空间，防止内容被压住 */}
          <div className="pt-14 flex-1 overflow-x-hidden w-full">
            <Routes>
              {/* 所有人都能访问的登录页 */}
              <Route path="/login" element={<Login />} />
              
              {/* 登录后才能访问的页面 */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/gamestore" element={<GameStore />} />
                <Route path="/game" element={<Game />} />
              </Route>
            </Routes>
          </div>


        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App