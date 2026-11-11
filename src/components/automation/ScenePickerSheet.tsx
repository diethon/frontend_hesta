import React, { useState, useMemo } from 'react';
import type { SceneResponse } from '../../types/scene';
import { Icon, type IconName } from '../home/HomeIcons';
import { getFigmaIconForScene } from '../scene/ScenePage';

interface ScenePickerSheetProps {
  scenes: SceneResponse[];
  selectedSceneId?: string;
  onSelect: (scene: SceneResponse) => void;
  onClose: () => void;
}

export const ScenePickerSheet: React.FC<ScenePickerSheetProps> = ({
  scenes,
  selectedSceneId,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scenes;
    return scenes.filter((s) => s.name.toLowerCase().includes(q));
  }, [scenes, query]);

  return (
    <div className="sub-sheet-layer">
      <header className="sub-sheet-header">
        <strong>Chọn kịch bản</strong>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Đóng"
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="sub-sheet-body space-y-3">
        <input
          autoFocus
          className="picker-search"
          placeholder="Tìm kịch bản..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="space-y-1.5 pt-1">
          {filtered.map((scene) => {
            const isSelected = scene.id === selectedSceneId;
            const iconName: IconName = getFigmaIconForScene(scene.name, scene.icon);
            const isDisabled = !scene.enabled;

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  onSelect(scene);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                    : 'bg-[var(--solid)] hover:bg-[var(--muted)] border-[var(--border)]'
                } ${isDisabled ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--muted)] text-[var(--secondary)]'
                    }`}
                  >
                    <Icon name={iconName} size={18} />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xs text-[var(--text)] block truncate">
                      {scene.name}
                    </strong>
                    <span className="text-[11px] text-[var(--secondary)] block truncate">
                      {scene.actions?.length || 0} hành động
                      {isDisabled && ' · Đang tắt'}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--tertiary)]'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--tertiary)]">
              Chưa có kịch bản nào phù hợp.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

