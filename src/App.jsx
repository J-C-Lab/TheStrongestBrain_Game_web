import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Game from './pages/Game';
import Login from './pages/Login';
import Home from './pages/Home';
import GameStore from './pages/GameStore';
import Navbar from './components/Navbar';
import './index.css'

// 路由守卫组件
// 它的逻辑是：如果 localStorage 里有 isAuthenticated，就放行渲染 children (也就是你的页面)；如果没有，就强行打回 /login
const ProtectedRoute = () => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      {/* 最外层容器负责全局背景色和文字颜色 */}
      <div className="min-h-screen bg-apple-lightBg dark:bg-apple-darkBg text-apple-lightText dark:text-apple-darkText transition-colors duration-500">
        
        {/* Navbar 现在是真·全局组件 */}
        <Navbar />

        {/*  统一为导航栏留出空间，防止内容被压住 */}
        <div className="pt-14 mt-0">
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
  )
}

export default App