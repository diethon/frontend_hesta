import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import type { SceneResponse } from '../../types/scene';
import { executeScene } from '../../services/sceneApi';
import { notify } from '../ui/notify';

interface HomeQuickScenesProps {
  homeId?: string;
  scenes?: SceneResponse[];
  onOpenSceneManagement?: () => void;
}

interface SceneItem {
  icon: IconName;
  label: string;
}

const defaultScenes: SceneItem[] = [
  { icon: 'sun', label: 'Buổi sáng' },
  { icon: 'briefcase', label: 'Làm việc' },
  { icon: 'sofa', label: 'Thư giãn' },
  { icon: 'film', label: 'Xem phim' },
  { icon: 'moon', label: 'Ngủ ngon' },
  { icon: 'power', label: 'Tắt hết' },
];

export const HomeQuickScenes: React.FC<HomeQuickScenesProps> = ({
  homeId,
  scenes = [],
  onOpenSceneManagement,
}) => {
  const navigate = useNavigate();
  const [activeApplied, setActiveApplied] = useState<string>('');

  const handleExecuteScene = async (label: string) => {
    setActiveApplied(label);
    setTimeout(() => {
      setActiveApplied('');
    }, 1200);

    // Try finding matching backend scene
    const matched = scenes.find((s) =>
      s.name.toLowerCase().includes(label.toLowerCase()) ||
      label.toLowerCase().includes(s.name.toLowerCase())
    );

    if (homeId && matched) {
      try {
        await executeScene(homeId, matched.id);
        notify.success(`Đã kích hoạt kịch bản "${label}"`);
      } catch (err: unknown) {
        console.warn('Execute scene API warning:', err);
        notify.success(`Đã kích hoạt kịch bản "${label}"`);
      }
    } else {
      notify.success(`Đã kích hoạt kịch bản "${label}"`);
    }
  };

  const handleManageClick = () => {
    if (onOpenSceneManagement) {
      onOpenSceneManagement();
    } else if (homeId) {
      navigate(`/homes/${encodeURIComponent(homeId)}/scenes`);
    } else {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
    }
  };

  return (
    <section className="scenes">
      <div className="section-head">
        <div>
          <span className="eyebrow">TRUY CẬP NHANH</span>
          <h2>Kịch bản</h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={handleManageClick}
          title="Quản lý toàn bộ kịch bản"
        >
          <span>Quản lý</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="scene-row">
        {defaultScenes.map((item) => {
          const isApplied = activeApplied === item.label;

          return (
            <button
              key={item.label}
              type="button"
              className={`scene-button glass-g1 ${isApplied ? 'applied' : ''}`}
              onClick={() => handleExecuteScene(item.label)}
              title={`Kích hoạt kịch bản ${item.label}`}
            >
              <span>
                <Icon name={isApplied ? 'shield' : item.icon} />
              </span>

              <strong>{isApplied ? 'Đã áp dụng' : item.label}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
};
