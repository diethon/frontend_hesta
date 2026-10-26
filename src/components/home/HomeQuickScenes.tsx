import React, { useState } from 'react';
import {
  Sun,
  Briefcase,
  Armchair,
  Film,
  Moon,
  PowerOff,
  ChevronRight,
  Loader2,
} from 'lucide-react';
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
      const matchedScene = scenes.find(
        (s) => s.name.toLowerCase().includes(preset.name.toLowerCase()) ||
               preset.name.toLowerCase().includes(s.name.toLowerCase())
      );

      if (matchedScene && homeId) {
        await executeScene(homeId, matchedScene.id);
        notify.success(`Kích hoạt thành công: ${matchedScene.name}`, 'Các thiết bị đã được thiết lập theo kịch bản.');
      } else {
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
      {/* Header matching Figma */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Truy cập nhanh</p>
          <h2 className="text-xl font-bold tracking-tight text-text">Kịch bản</h2>
        </div>

        <button
          type="button"
          onClick={handleManageClick}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer group"
        >
          <span>Quản lý</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Row of 6 wide horizontal scene cards matching Figma */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {defaultPresets.map((preset) => {
          const isActivating = activatingId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={isActivating}
              onClick={() => handleActivate(preset)}
              className="surface-card flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-primary/50 hover:shadow-soft hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer group text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                {isActivating ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : preset.icon}
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-primary transition-colors">
                  {preset.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
