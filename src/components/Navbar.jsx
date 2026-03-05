import { useState, useEffect } from 'react';
import { useNavigate, Link ,useLocation} from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();// 获取当前所在的路由信息

  const isLoginPage = location.pathname === '/login';//判断现在是否是登陆页面

  // 1. 管理暗黑模式的逻辑
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // 2. 退出登录逻辑（从 Home.jsx 搬过来了）
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  return (
    // fixed 固定在顶部，并使用我们之前写好的 apple-glass 毛玻璃类名
    <nav className="fixed top-0 left-0 w-full z-50 apple-glass shadow-sm border-b border-transparent dark:border-white/5">
      <div className="max-w-8xl mx-0 px-6 h-14 flex items-center justify-between">
        
        {/* 左侧：Logo 和系统名称 (点击可以回游戏主页) */}
        {isLoginPage ? (
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-apple-lightText dark:text-apple-darkText">
            🧠 <span>最强大脑</span>
          </div>
        ) : (
          <Link to="/gamestore" className="flex items-center gap-3 text-xl font-bold tracking-tight text-apple-lightText dark:text-apple-darkText hover:opacity-80 transition-opacity">
            🧠 <span>最强大脑</span>
          </Link>
        )}

        {/* 右侧：操作区 */}
        <div className="flex items-center gap-5 justify-end">
          
          {/* 切换主题按钮 */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="text-xl p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors"
            title="切换主题"
          >
            {isDarkMode ? '🌙' : '☀️'}
          </button>

          {/* 个人主页/头像按钮 (用 CSS 画一个漂亮的渐变圆头像) */}
          {!isLoginPage && (
            <>
              <Link 
                to="/" 
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-apple-blue to-purple-500 flex items-center justify-center text-white font-bold shadow-md hover:scale-105 transition-transform"
                title="个人主页"
              >
                我
              </Link>
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              >
                退出
              </button>
            </>
          )}
          
        </div>
      </div>
    </nav>
  );
}