import React, { useRef, useEffect } from 'react';
import { Sliders, Zap, Activity, Clock, Settings } from 'lucide-react';
import type { FigmaDeviceType } from './detailTypes';

export type DetailTabType = 'control' | 'energy' | 'history' | 'settings';

export interface DetailTabsProps {
  deviceId?: string;
  activeTab: DetailTabType;
  onChangeTab: (tab: DetailTabType) => void;
  resolvedType: FigmaDeviceType;
}

export const DetailTabs: React.FC<DetailTabsProps> = ({
  deviceId,
  activeTab,
  onChangeTab,
  resolvedType,
}) => {
  const isNoEnergyDevice = resolvedType === 'Cảm biến' || resolvedType === 'Cổng';

  const tabs: { id: DetailTabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'control', label: 'Điều khiển', icon: Sliders },
    {
      id: 'energy',
      label: isNoEnergyDevice ? 'Tình trạng' : 'Năng lượng',
      icon: isNoEnergyDevice ? Activity : Zap,
    },
    { id: 'history', label: 'Lịch sử', icon: Clock },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  // Reset tab to 'control' whenever deviceId changes
  useEffect(() => {
    onChangeTab('control');
  }, [deviceId, onChangeTab]);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== -1) {
      e.preventDefault();
      const targetTab = tabs[targetIndex];
      if (targetTab) {
        onChangeTab(targetTab.id);
        tabRefs.current[targetIndex]?.focus();
      }
    }
  };

  return (
    <nav className="detail-tabs-container" aria-label="Tùy chọn thiết bị">
      <div className="detail-tab-list" role="tablist">
        {tabs.map((tab, idx) => {
          const IconComponent = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`device-tab-${tab.id}`}
              aria-controls={`device-panel-${tab.id}`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChangeTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`detail-tab-btn ${isSelected ? 'active' : ''}`}
            >
              <IconComponent className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
