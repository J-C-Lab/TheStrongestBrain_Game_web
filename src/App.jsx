import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import GameStore from './pages/GameStore';
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 当浏览器访问 /login 时，显示 Login 组件 */}
        <Route path="/login" element={<Login />} />
        
        {/* 当访问根目录 / 时，显示 Home 组件 */}
        <Route path="/" element={<Home />} />
        
        {/* 当访问 /game 时，显示 Game 组件 */}
        <Route path="/gamestore" element={<GameStore />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App