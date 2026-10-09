import React, { useState } from 'react';
import {
  Sunrise,
  Briefcase,
  Sofa,
  Clapperboard,
  Moon,
  PowerOff,
  Check,
} from 'lucide-react';

export const SCENE_PRESETS = [
  { id: 'morning', label: 'Buổi sáng', icon: Sunrise, color: 'text-amber-500' },
  { id: 'work', label: 'Làm việc', icon: Briefcase, color: 'text-blue-500' },
  { id: 'relax', label: 'Thư giãn', icon: Sofa, color: 'text-emerald-500' },
  { id: 'movie', label: 'Xem phim', icon: Clapperboard, color: 'text-purple-500' },
  { id: 'sleep', label: 'Ngủ ngon', icon: Moon, color: 'text-indigo-500' },
  { id: 'off_all', label: 'Tắt hết', icon: PowerOff, color: 'text-rose-500' },
];

interface SceneBarProps {
  onSceneActivate: (sceneId: string) => void;
  isLoading?: boolean;
}

export const SceneBar: React.FC<SceneBarProps> = ({ onSceneActivate, isLoading }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleClick = (sceneId: string) => {
    setActiveId(sceneId);
    onSceneActivate(sceneId);
    setTimeout(() => {
      setActiveId((curr) => (curr === sceneId ? null : curr));
    }, 1800);
  };

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar pb-1.5 pt-0.5 px-0.5">
      {SCENE_PRESETS.map((scene) => {
        const Icon = scene.icon;
        const isSelected = activeId === scene.id;
        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => handleClick(scene.id)}
            disabled={isLoading}
            className={`scene-pill flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 select-none ${
              isSelected
                ? 'bg-primary text-white border-primary shadow-md shadow-primary/25 scale-102'
                : 'text-text hover:text-primary-hover hover:border-primary/40'
            } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
            aria-label={`Kích hoạt kịch bản ${scene.label}`}
          >
            {isSelected ? (
              <Check size={17} className="text-white animate-in zoom-in-50" />
            ) : (
              <Icon size={17} className={scene.color} />
            )}
            <span>{scene.label}</span>
          </button>
        );
      })}
    </div>
  );
};
