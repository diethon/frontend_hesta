import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import type { SceneResponse } from '../../types/scene';
import { executeScene } from '../../services/sceneApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface HomeQuickScenesProps {
  homeId?: string;
  scenes?: SceneResponse[];
  onOpenSceneManagement?: () => void;
  onTurnOffAllLights?: () => Promise<void> | void;
}

function resolveSceneIcon(name: string, iconStr?: string | null): IconName {
  const text = (iconStr || name || '').toLowerCase();
  if (text.includes('sáng') || text.includes('morning') || text.includes('sun')) return 'sun';
  if (text.includes('ngủ') || text.includes('night') || text.includes('sleep') || text.includes('moon')) return 'moon';
  if (text.includes('làm việc') || text.includes('work') || text.includes('briefcase')) return 'briefcase';
  if (text.includes('thư giãn') || text.includes('relax') || text.includes('sofa')) return 'sofa';
  if (text.includes('phim') || text.includes('movie') || text.includes('cinema') || text.includes('film')) return 'film';
  if (text.includes('ra ngoài') || text.includes('away') || text.includes('leave')) return 'plane';
  if (text.includes('về nhà') || text.includes('home')) return 'home';
  if (text.includes('tiệc') || text.includes('party')) return 'party';
  if (text.includes('an ninh') || text.includes('security') || text.includes('bảo vệ')) return 'shield';
  if (text.includes('đèn') || text.includes('light')) return 'lamp';
  return 'sparkles';
}

export const HomeQuickScenes: React.FC<HomeQuickScenesProps> = ({
  homeId,
  scenes = [],
  onOpenSceneManagement,
  onTurnOffAllLights,
}) => {
  const navigate = useNavigate();
  const [executingSceneId, setExecutingSceneId] = useState<string | null>(null);
  const [turningOffLights, setTurningOffLights] = useState(false);

  const handleExecuteScene = async (scene: SceneResponse) => {
    if (!homeId) {
      notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
      return;
    }

    setExecutingSceneId(scene.id);
    try {
      await executeScene(homeId, scene.id);
      notify.success(`Đã kích hoạt kịch bản "${scene.name}"`);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, `Lỗi khi kích hoạt "${scene.name}"`));
    } finally {
      setTimeout(() => {
        setExecutingSceneId((prev) => (prev === scene.id ? null : prev));
      }, 1000);
    }
  };

  const handleTurnOffLights = async () => {
    if (!onTurnOffAllLights) {
      notify.info('Chức năng tắt đèn không khả dụng.');
      return;
    }
    setTurningOffLights(true);
    try {
      await onTurnOffAllLights();
    } catch (err: unknown) {
      notify.error(getErrorMessage(err, 'Lỗi khi tắt đèn.'));
    } finally {
      setTurningOffLights(false);
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
        {/* Real Backend Scenes */}
        {scenes.map((scene) => {
          const isExecuting = executingSceneId === scene.id;
          const icon = resolveSceneIcon(scene.name, scene.icon);

          return (
            <button
              key={scene.id}
              type="button"
              className={`scene-button glass-g1 shrink-0 min-w-[195px] sm:min-w-0 ${isExecuting ? 'applied' : ''}`}
              onClick={() => handleExecuteScene(scene)}
              title={scene.description || `Kích hoạt kịch bản ${scene.name}`}
            >
              <span>
                <Icon name={isExecuting ? 'shield' : icon} />
              </span>

              <div className="flex flex-col text-left overflow-hidden min-w-0">
                <strong className="truncate">{scene.name}</strong>
                <small className="text-[10px] text-[var(--secondary)] truncate">
                  {isExecuting
                    ? 'Đang áp dụng…'
                    : scene.description || `${scene.actions?.length || 0} hành động`}
                </small>
              </div>
            </button>
          );
        })}

        {/* Utility Card: Tắt hết đèn */}
        {onTurnOffAllLights && (
          <button
            type="button"
            className={`scene-button glass-g1 shrink-0 min-w-[195px] sm:min-w-0 ${turningOffLights ? 'applied' : ''}`}
            onClick={handleTurnOffLights}
            title="Tắt toàn bộ đèn đang bật trong không gian"
          >
            <span className={turningOffLights ? '' : 'text-amber-500 bg-amber-500/10'}>
              <Icon name="power" size={18} />
            </span>

            <div className="flex flex-col text-left overflow-hidden min-w-0">
              <strong className="truncate">Tắt hết đèn</strong>
              <small className="text-[10px] text-[var(--secondary)] truncate">
                {turningOffLights ? 'Đang gửi lệnh…' : 'Tiết kiệm điện'}
              </small>
            </div>
          </button>
        )}

        {/* Quick Card: + Tạo kịch bản */}
        <button
          type="button"
          className="scene-button glass-g1 shrink-0 min-w-[195px] sm:min-w-0 border-dashed hover:border-primary/50"
          onClick={() => {
            if (homeId) {
              navigate(`/homes/${encodeURIComponent(homeId)}/scenes`);
            } else {
              notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
            }
          }}
          title="Tạo kịch bản tự động hóa mới"
        >
          <span className="text-primary bg-primary/10">
            <Icon name="plus" size={18} />
          </span>

          <div className="flex flex-col text-left overflow-hidden min-w-0">
            <strong className="text-primary truncate">+ Tạo kịch bản</strong>
            <small className="text-[10px] text-[var(--secondary)] truncate">Tự động hóa</small>
          </div>
        </button>
      </div>
    </section>
  );
};
