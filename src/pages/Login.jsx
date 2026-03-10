import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import RainbowParticleBg from '../components/RainbowParticleBg'; // 【新增BG导入】
import { useToast } from '../context/ToastContext';
import { BASE_URL } from '../apiConfig';

export default function Login() {
  const [isFlipped,setIsFlipped] = useState(false);
  const navigate = useNavigate();

  // 表单状态
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regNickname, setRegNickname] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showMsg } = useToast();

  //登录
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_id: loginId, password: loginPassword })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || '登录失败');

      // 登录成功：保存 Token 和登录状态
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/'); // 跳回主页
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  //注册
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: regNickname, password: regPassword })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || '注册失败');

      // 注册成功：保存 Token 并极其醒目地告诉用户他的专属系统 ID
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAuthenticated', 'true');
      
      showMsg(`🎉 注册成功！\n请务必牢记你的系统专属 ID：【 ${data.systemId} 】\n它是你以后登录的唯一凭证！`, 'success');
      navigate('/');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 翻转卡片时清空错误信息
  const toggleFlip = (state) => {
    setIsFlipped(state);
    setErrorMsg('');
  };

  // 第三方登录占位提示
  const handleThirdPartyLogin = (method) => {
    showMsg(`【${method}登录】企业级 API 接口正在接入中，敬请期待！`, 'info');
  };

  return(
    <div className="relative min-h-[calc(100vh)] flex items-center justify-center overflow-hidden transition-colors duration-500">
      
      {/* --- 动态多彩圆球背景 (Siri 流体风) --- */}
      <div className="absolute w-full h-full max-w-3xl flex justify-center items-center pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-60 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-400 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>
      </div>

      {/* --- 3D 翻转容器 --- */}
      <div className="perspective-1000 relative w-80 h-[32rem] md:top-1 z-10">
        <div className={`w-full h-full duration-700 preserve-3d relative ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* =========================================
              正面：登录卡片
          ========================================= */}
          <div className="absolute inset-0 backface-hidden apple-glass rounded-3xl p-8 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-6 text-center text-apple-lightText dark:text-apple-darkText">登录系统</h2>
            
            {/* 错误提示框 */}
            {errorMsg && !isFlipped && <div className="mb-4 p-2 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800 text-center animate-pulse">{errorMsg}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="text" placeholder="系统 ID (如 ID-9527)" required
                value={loginId} onChange={e => setLoginId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-transparent focus:border-apple-blue focus:ring-1 focus:ring-apple-blue outline-none transition-all placeholder-gray-500 text-apple-lightText dark:text-apple-darkText"
              />
              <input 
                type="password" placeholder="密码" required
                value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-transparent focus:border-apple-blue focus:ring-1 focus:ring-apple-blue outline-none transition-all placeholder-gray-500 text-apple-lightText dark:text-apple-darkText"
              />
              <button disabled={isLoading} className="w-full py-3 mt-4 rounded-xl bg-apple-blue text-white font-semibold shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
                {isLoading ? '验证中...' : '进入脑力宇宙'}
              </button>
            </form>

            {/* 第三方登录区域 */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-center text-gray-500 mb-4">或使用以下方式快捷登录</p>
              <div className="flex justify-center gap-4">
                {/* 微信图标 */}
                <button onClick={() => handleThirdPartyLogin('微信')} className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.5 13.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm7 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm-3.5 4.5c4.7 0 8.5-3.1 8.5-7s-3.8-7-8.5-7-8.5 3.1-8.5 7c0 2.1 1.1 4.1 2.9 5.4-.2 1.1-.7 2.4-.7 2.4s1.7-.1 3.2-1.1c1 .3 2 .4 3.1 .4z"/></svg>
                </button>
                {/* 手机号图标 */}
                <button onClick={() => handleThirdPartyLogin('手机验证码')} className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </button>
                {/* 邮箱图标 */}
                <button onClick={() => handleThirdPartyLogin('邮箱')} className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </button>
              </div>
            </div>

            <div className="mt-6 text-center text-sm opacity-80">
              新挑战者？ 
              <button onClick={() => toggleFlip(true)} className="text-apple-blue font-semibold ml-1 hover:underline">
                建立档案
              </button>
            </div>
          </div>

          {/* =========================================
              背面：注册卡片
          ========================================= */}
          <div className="absolute inset-0 backface-hidden apple-glass rounded-3xl p-8 flex flex-col justify-center rotate-y-180">
            <h2 className="text-2xl font-bold mb-6 text-center text-apple-lightText dark:text-apple-darkText">建立大脑档案</h2>
            
            {errorMsg && isFlipped && <div className="mb-4 p-2 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800 text-center animate-pulse">{errorMsg}</div>}

            <form onSubmit={handleRegister} className="space-y-4">
              <input 
                type="text" placeholder="取个响亮的代号" required
                value={regNickname} onChange={e => setRegNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-transparent focus:border-apple-blue outline-none transition-all placeholder-gray-500 text-apple-lightText dark:text-apple-darkText"
              />
              <input 
                type="password" placeholder="设置密匙" required
                value={regPassword} onChange={e => setRegPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-transparent focus:border-apple-blue outline-none transition-all placeholder-gray-500 text-apple-lightText dark:text-apple-darkText"
              />
              <button disabled={isLoading} className="w-full py-3 mt-4 rounded-xl bg-black dark:bg-white dark:text-black text-white font-semibold shadow-lg hover:opacity-80 transition-opacity disabled:opacity-50">
                {isLoading ? '生成系统 ID...' : '注册并获取 ID'}
              </button>
            </form>
            <div className="mt-8 text-center text-sm opacity-80">
              已有系统 ID？ 
              <button onClick={() => toggleFlip(false)} className="text-apple-blue font-semibold ml-1 hover:underline">
                返回登录
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}