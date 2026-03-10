import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { BASE_URL } from '../apiConfig';

export default function BadgePavilion({ isOpen, onClose, onSaveSuccess }) {
  const [badgeData, setBadgeData] = useState({ all: [], unlocked: [], equipped: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showMsg } = useToast();

  // 只有当弹窗打开时，才去后端拉取数据
  useEffect(() => {
    if (!isOpen) return; 

    const fetchBadges = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${BASE_URL}/api/badges/pavilion`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setBadgeData({
          all: data.all_badges,
          unlocked: data.unlocked,
          equipped: data.equipped
        });
      } catch (error) {
        console.error("加载徽章失败", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBadges();
  }, [isOpen]);

  const toggleBadge = (icon) => {
    if (!badgeData.unlocked.includes(icon)) return;

    let newEquipped = [...badgeData.equipped];
    if (newEquipped.includes(icon)) {
      if (newEquipped.length > 1) {
        newEquipped = newEquipped.filter(b => b !== icon);
      } else {
        showMsg("至少需要展示 1 个荣誉徽章哦！", 'info');
      }
    } else {
      if (newEquipped.length < 3) {
        newEquipped.push(icon);
      } else {
        showMsg("主页最多只能展示 3 个徽章，请先卸下一些。","warning");
      }
    }
    setBadgeData({ ...badgeData, equipped: newEquipped });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BASE_URL}/api/badges/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ equippedBadges: badgeData.equipped })
      });
      if (res.ok) {
        onSaveSuccess(); // 告诉父组件（Home）：保存成功了，你可以刷新数据了
        onClose();       // 自己把弹窗关掉
      }
    } catch (error) {
      showMsg("保存失败！", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 如果父组件没让打开，直接返回 null，不渲染任何东西
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/50 backdrop-blur-md animate-fade-in">
      <div className="bg-white/95 dark:bg-[#1C1C1E]/95 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col">
        
        {/* 头部 */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div>
            <h3 className="text-2xl font-black text-apple-lightText dark:text-apple-darkText">荣誉展馆</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isLoading ? '加载档案中...' : `已解锁 ${badgeData.unlocked.length} / ${badgeData.all.length} · 正在展示 ${badgeData.equipped.length}/3`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl font-light transition-colors">&times;</button>
        </div>

        {/* 内容区 */}
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="text-center py-12 text-apple-blue font-bold animate-pulse">展馆陈列中...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {badgeData.all.map((badge) => {
                const isUnlocked = badgeData.unlocked.includes(badge.icon);
                const isEquipped = badgeData.equipped.includes(badge.icon);

                return (
                  <div 
                    key={badge.id}
                    onClick={() => toggleBadge(badge.icon)}
                    className={`relative flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 ${
                      isUnlocked ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : 'cursor-not-allowed opacity-50 grayscale'
                    } ${
                      isEquipped 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-apple-blue shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                        : 'bg-white dark:bg-[#242426] border-gray-100 dark:border-transparent'
                    }`}
                  >
                    {isEquipped && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-apple-blue rounded-full text-white flex items-center justify-center shadow-md animate-pop-in">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                    {!isUnlocked && (
                       <div className="absolute top-3 right-3 text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                       </div>
                    )}
                    <div className="text-5xl mb-3 drop-shadow-sm">{badge.icon}</div>
                    <h3 className={`font-bold text-base mb-1 ${isUnlocked ? 'text-apple-lightText dark:text-apple-darkText' : 'text-gray-400'}`}>{badge.name}</h3>
                    <p className="text-[11px] text-center text-gray-500 leading-relaxed px-1">{badge.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">取消</button>
          <button onClick={handleSave} disabled={isSaving || isLoading} className="px-8 py-2.5 rounded-xl bg-apple-blue text-white font-semibold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isSaving ? '应用中...' : '应用并展示'}
          </button>
        </div>
      </div>
    </div>
  );
}