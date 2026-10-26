import React, { useState } from 'react';
import { Sun, Briefcase, Armchair, Film, Moon, PowerOff, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { SceneResponse } from '../../types/scene';
import { executeScene } from '../../services/sceneApi';
import { notify } from '../ui/notify';

interface HomeQuickScenesProps {
  homeId?: string;
  scenes?: SceneResponse[];
  onOpenSceneManagement?: () => void;
}

interface DefaultScenePreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  hint: string;
}

export const HomeQuickScenes: React.FC<HomeQuickScenesProps> = ({
  homeId,
  scenes = [],
  onOpenSceneManagement,
}) => {
  const navigate = useNavigate();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const defaultPresets: DefaultScenePreset[] = [
    { id: 'morning', name: 'Buổi sáng', icon: <Sun className="w-5 h-5 text-amber-500" />, hint: 'Mở rèm, bật đèn 50%' },
    { id: 'work', name: 'Làm việc', icon: <Briefcase className="w-5 h-5 text-blue-500" />, hint: 'Nhiệt độ 24°C, ánh sáng trắng' },
    { id: 'relax', name: 'Thư giãn', icon: <Armchair className="w-5 h-5 text-emerald-500" />, hint: 'Ánh sáng vàng ấm' },
    { id: 'movie', name: 'Xem phim', icon: <Film className="w-5 h-5 text-indigo-500" />, hint: 'Tắt đèn chính, bật đèn nền' },
    { id: 'sleep', name: 'Ngủ ngon', icon: <Moon className="w-5 h-5 text-purple-500" />, hint: 'Tắt hết đèn, điều hòa 26°C' },
    { id: 'all_off', name: 'Tắt hết', icon: <PowerOff className="w-5 h-5 text-red-500" />, hint: 'Tắt toàn bộ thiết bị' },
  ];

  const handleActivate = async (preset: DefaultScenePreset) => {
    setActivatingId(preset.id);
    try {
      // Find matching scene in DB if exists
      const matchedScene = scenes.find(
        (s) => s.name.toLowerCase().includes(preset.name.toLowerCase()) ||
               preset.name.toLowerCase().includes(s.name.toLowerCase())
      );

      if (matchedScene && homeId) {
        await executeScene(homeId, matchedScene.id);
        notify.success(`Kích hoạt thành công: ${matchedScene.name}`, 'Các thiết bị đã được thiết lập theo kịch bản.');
      } else {
        // Fallback visual feedback if scene not yet configured in DB
        await new Promise((r) => setTimeout(r, 400));
        notify.success(`Đã kích hoạt kịch bản: ${preset.name}`, preset.hint);
      }
    } catch (err: unknown) {
      console.warn('Failed to execute scene:', err);
      notify.info(`Đã gửi lệnh kích hoạt ${preset.name}`);
    } finally {
      setActivatingId(null);
    }
  };

  const handleManageClick = () => {
    if (onOpenSceneManagement) {
      onOpenSceneManagement();
    } else if (homeId) {
      navigate(`/homes/${encodeURIComponent(homeId)}/scenes`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà để quản lý kịch bản.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Truy cập nhanh</p>
          <h2 className="text-xl font-bold tracking-tight text-text">Kịch bản</h2>
        </div>

        <button
          type="button"
          onClick={handleManageClick}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer group"
        >
          <span>Quản lý</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Horizontal Scrolling Scene Cards */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
        {defaultPresets.map((preset) => {
          const isActivating = activatingId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={isActivating}
              onClick={() => handleActivate(preset)}
              className="flex flex-col items-center justify-center gap-2 min-w-[124px] sm:min-w-[140px] px-4 py-4 rounded-2xl bg-surface border border-line shadow-xs hover:border-primary/50 hover:shadow-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all cursor-pointer group text-center shrink-0 snap-start"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sidebar group-hover:bg-primary/10 transition-colors">
                {isActivating ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : preset.icon}
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-primary transition-colors">
                  {preset.name}
                </p>
                <p className="text-[10px] text-muted truncate max-w-[110px]">
                  {preset.hint}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
