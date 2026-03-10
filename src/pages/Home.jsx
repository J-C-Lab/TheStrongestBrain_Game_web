import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import BadgePavilion from '../components/BadgePavilion';
import { useToast } from '../context/ToastContext';
import { BASE_URL } from '../apiConfig';

export default function Home() {
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const navigate = useNavigate(); 
  const { showMsg } = useToast();
  
  // 编辑表单的数据状态
  const [editForm, setEditForm] = useState({
    nickname: '',
    gender: '',
    birthday: '',
    bio: '',
    newPassword: '' // 密码留空代表不修改
  });

  // 组件加载时，向后端请求用户个人数据接口
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await fetch(`${BASE_URL}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // 如果 Token 过期或无效 (401/403)
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('isAuthenticated');
          navigate('/login');
          return;
        }

        const data = await response.json();
        setUserInfo(data);
      } catch (error) {
        console.error("获取用户信息失败", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // 点击“编辑资料”按钮时，打开弹窗并回填数据
  const handleOpenEdit = () => {
    setEditForm({
      nickname: userInfo.nickname || '',
      gender: userInfo.gender || '保密',
      birthday: userInfo.birthday || '',
      bio: userInfo.bio || '',
      newPassword: ''
    });
    setIsEditModalOpen(true);
  };

  // 提交修改
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${BASE_URL}/api/user/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        
        body: JSON.stringify({ ...editForm, avatar: userInfo.avatar }) 
      });

      if (!response.ok) throw new Error('更新失败');

      // 更新成功后，关闭弹窗，并直接强制刷新页面以获取最新数据（或者你也可以重新 fetchProfile）
      setIsEditModalOpen(false);
      window.location.reload(); 
    } catch (error) {
      showMsg(error.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // 判断当前是否为暗黑模式，用于动态调整图表文字颜色
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#E5E7EB' : '#374151';

  if (isLoading || !userInfo) {
    return <div className={`min-h-screen flex justify-center pt-32 text-${textColor}`}>正在加载大脑档案...</div>;
  }

  // ==========================================
  // ECharts 配置：个人能力雷达图
  // ==========================================
  const radarKeys = Object.keys(userInfo.radar_stats || { '空间': 50, '逻辑': 50, '记忆': 50, '计算': 50 });
  const radarValues = Object.values(userInfo.radar_stats || { '空间': 50, '逻辑': 50, '记忆': 50, '计算': 50 });

  const radarOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    radar: {
      indicator: radarKeys.map(key => ({ name: key, max: 100 })),
      shape: 'polygon',
      axisName: { color: textColor, fontWeight: 'bold' },
      splitArea: { show: false }, // 去掉背景网格区块颜色，更清爽
      axisLine: { lineStyle: { color: isDark ? '#374151' : '#E5E7EB' } },
      splitLine: { lineStyle: { color: isDark ? '#374151' : '#E5E7EB' } },
    },
    series: [{
      name: '能力维度',
      type: 'radar',
      data: [{
        value: radarValues,
        name: '我的战力',
        itemStyle: { color: '#3B82F6' },
        areaStyle: { color: 'rgba(59, 130, 246, 0.4)' } // 苹果蓝半透明填充
      }]
    }]
  };

  // ==========================================
  // ECharts 配置：准确率环形图
  // ==========================================
  const winRate = parseFloat(userInfo.stats.win_rate);
  const winNumOfTime = parseInt(userInfo.win_num_of_game);
  const sumNumOfTime = parseInt(userInfo.stats.total_games);
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      name: '推演准确率',
      type: 'pie',
      radius: ['65%', '85%'], // 空心环形
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'center',
        formatter: `${winRate}%\n胜率`,
        fontSize: 20,
        fontWeight: 'bold',
        color: textColor
      },
      labelLine: { show: false },
      data: [
        { value: winNumOfTime, name: '正确', itemStyle: { color: '#10B981' } }, // 绿色
        { value: sumNumOfTime-winNumOfTime, name: '失败', itemStyle: { color: isDark ? '#374151' : '#E5E7EB' } }
      ]
    }]
  };

  return (
    // 最外层容器，限制宽度并居中
    <div className="max-w-8xl h-full max-h-screen mx-auto my-0 font-sans animate-fade-in">
      
      {/* 整个个人主页的卡片容器 */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden">
        
        {/* =========================================
            上半部分：大横幅 + 头像 + 基本信息
        ========================================= */}
        <div className="relative">
          {/* 渐变横幅 */}
          <div className="h-10 lg:h-32 bg-gradient-to-r from-blue-200 via-indigo-100 to-purple-200 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40"></div>
          
          {/* 头像压线 */}
          <div className="absolute top-9 md:top-23 left-8 md:left-12 flex items-end gap-6">
            <div className="relative group w-30 h-30 md:w-20 md:h-20 rounded-full border-4 border-white dark:border-[#1C1C1E] bg-gray-200 shadow-lg overflow-hidden cursor-pointer z-10">
              <img src={userInfo.avatar} alt="Avatar" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-bold">更换头像</span>
              </div>
            </div>
          </div>

          {/* 右侧徽章 */}
          <div onClick={() => setIsBadgeModalOpen(true)} className="absolute top-0 md:top-14 right-8 flex gap-3" title="点击进入荣誉展馆">
            {userInfo.badges.map((badge, index) => (
              <div key={index} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 flex items-center justify-center text-xl hover:scale-110 transition-transform cursor-help">
                {badge}
              </div>
            ))}
          </div>
        </div>

        {/* 信息与积分 (移到了分割线上方) */}
        <div className="pt-0 md:pt-4 px-7 md:px-12 pb-5 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-extrabold text-apple-lightText dark:text-apple-darkText">
                {userInfo.nickname}
              </h1>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-mono rounded border border-gray-200 dark:border-gray-700 select-none">
                {userInfo.system_id}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed max-w-2xl">
              {userInfo.bio}
            </p>
          </div>

          <div className="md:text-right mt-4 md:mt-0 flex flex-col justify-end">
            <div className="text-sm text-gray-400 font-semibold tracking-widest mb-1">CUMULATIVE SCORE</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-500 to-purple-600 drop-shadow-sm">
              {userInfo.score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 漂亮的内部分割线 */}
        <hr className="border-t border-gray-100 dark:border-gray-800 mx-8 md:mx-12" />

        {/* =========================================
            下半部分：三列布局的数据看板 (Dashboard)
        ========================================= */}
        <div className="px-8 py-0 md:p-9 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          
          {/* 左列：游戏数据统计 */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-bold text-apple-lightText dark:text-apple-darkText flex items-center gap-2">
              🧭 脑力雷达解析
            </h3>
            <div className="bg-gray-50 dark:bg-[#242426] rounded-3xl p-4 h-64 border border-gray-100 dark:border-transparent">
              <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="p-5 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">系统总评</div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                你是一位<strong className="text-apple-blue mx-1">空间推演大师</strong>。在《生命游戏》中展现了极其罕见的直觉预判能力，但手速反应仍有提升空间。
              </p>
            </div>
          </div>

          {/* 中列：活跃度热力图 & 准确率 */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-bold text-apple-lightText dark:text-apple-darkText flex items-center gap-2">
              🔥 训练足迹
            </h3>
            
            {/* 准确率环形图 */}
            <div className="bg-gray-50 dark:bg-[#242426] rounded-3xl p-4 h-40 border border-gray-100 dark:border-transparent flex items-center justify-between px-8">
              <div className="w-1/2">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">本周累计耗时</p>
                <p className="text-2xl font-bold">{userInfo.stats.week_time_minutes}<span className="text-[10px] font-normal text-gray-500">分钟</span></p>
                {/* 动态计算上升或下降的箭头和颜色 */}
                <p className={`text-[10px] font-medium mt-0.5 ${userInfo.stats.week_trend === 0 ? 'text-gray-500' : (userInfo.stats.week_trend >= 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                  {userInfo.stats.week_trend === 0 ? '--' : (userInfo.stats.week_trend >= 0 ? '↑' : '↓')} 比上周 {Math.abs(userInfo.stats.week_trend)}%
                </p>
              </div>
              <div className="w-1/2 h-full">
                <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            {/* GitHub 风格热力图 */}
            <div className="bg-gray-50 dark:bg-[#242426] rounded-3xl p-6 border border-gray-100 dark:border-transparent">
              <div className="flex justify-between items-end mb-3">
                <p className="text-xs text-gray-500 font-medium">过去 140 天的活跃频率</p>
                <p className="text-xs font-bold text-apple-blue">累计 {userInfo.stats.total_time_hours} 小时</p>
              </div>
              {/* 利用 CSS Grid 实现横向矩阵 */}
              <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {userInfo.stats.heatmap.map((level, index) => {
                  // 根据等级分配颜色深浅
                  let colorClass = 'bg-gray-200 dark:bg-gray-700'; // 0级：灰色
                  if (level === 1) colorClass = 'bg-blue-200 dark:bg-blue-900/40';
                  if (level === 2) colorClass = 'bg-blue-400 dark:bg-blue-700/60';
                  if (level === 3) colorClass = 'bg-blue-500 dark:bg-blue-600';
                  if (level === 4) colorClass = 'bg-blue-600 dark:bg-blue-500';

                  return (
                    <div 
                      key={index} 
                      className={`w-3 h-3 rounded-sm ${colorClass} hover:ring-1 hover:ring-apple-blue transition-all cursor-crosshair`}
                      title={`活跃等级: ${level}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-end items-center gap-2 mt-2 text-xs text-gray-400">
                <span>少</span>
                <div className="w-2 h-2 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <div className="w-2 h-2 rounded-sm bg-blue-300 dark:bg-blue-800" />
                <div className="w-2 h-2 rounded-sm bg-blue-600 dark:bg-blue-500" />
                <span>多</span>
              </div>
            </div>
          </div>

          {/* 右列：账号基础设置 */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-bold text-apple-lightText dark:text-apple-darkText flex items-center gap-2">
              ⚙️ 账号与安全
            </h3>
            <div className="space-y-3">
              <button onClick={handleOpenEdit} className="w-full p-4 rounded-3xl bg-gray-50 dark:bg-[#242426] flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-100 dark:border-transparent group">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">编辑资料</div>
                  <div className="text-xs text-gray-500">修改性别、生日与所在地</div>
                </div>
                <span className="text-gray-300 group-hover:text-apple-blue transition-colors text-xl">→</span>
              </button>

              <button className="w-full p-4 rounded-3xl bg-gray-50 dark:bg-[#242426] flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-100 dark:border-transparent group">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">密码安全</div>
                  <div className="text-xs text-gray-500">修改或重置登录密码</div>
                </div>
                <span className="text-gray-300 group-hover:text-purple-500 transition-colors text-xl">→</span>
              </button>

              <button className="w-full p-4 rounded-3xl bg-gray-50 dark:bg-[#242426] flex items-center gap-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border border-gray-100 dark:border-transparent group mt-8">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-red-500">退出登录</div>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 高斯模糊编辑弹窗 (Modal) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800">
            
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-apple-lightText dark:text-apple-darkText">编辑大脑档案</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-light">&times;</button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">系统代号 (不可改)</label>
                <input type="text" disabled value={userInfo.system_id} className="w-full px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">昵称</label>
                <input type="text" required value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-apple-blue outline-none transition-colors text-apple-lightText dark:text-apple-darkText" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">性别</label>
                  <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-apple-blue outline-none transition-colors text-apple-lightText dark:text-apple-darkText">
                    <option value="保密">保密</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">生日</label>
                  <input type="date" value={editForm.birthday} onChange={e => setEditForm({...editForm, birthday: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-apple-blue outline-none transition-colors text-apple-lightText dark:text-apple-darkText" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">个人简介</label>
                <textarea rows="2" value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-apple-blue outline-none transition-colors text-apple-lightText dark:text-apple-darkText resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">重置密码 (留空则不修改)</label>
                <input type="password" placeholder="输入新密码" value={editForm.newPassword} onChange={e => setEditForm({...editForm, newPassword: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-apple-blue outline-none transition-colors text-apple-lightText dark:text-apple-darkText" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  取消
                </button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-3 rounded-xl bg-apple-blue text-white font-semibold shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
                  {isUpdating ? '保存中...' : '保存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 极简引入徽章展馆组件 */}
      <BadgePavilion 
        isOpen={isBadgeModalOpen} 
        onClose={() => setIsBadgeModalOpen(false)} 
        onSaveSuccess={() => window.location.reload()} // 保存成功直接刷新 Home
      />

    </div>
  );
}