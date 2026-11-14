import React from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import { notify } from '../ui/notify';

interface DashboardBottomNavProps {
  homeId?: string;
  activeItem?: 'overview' | 'devices' | 'scenes' | 'energy' | 'more';
  onSelectOverview?: () => void;
  onOpenMore?: () => void;
}

interface BottomNavItem {
  id: 'overview' | 'devices' | 'scenes' | 'energy' | 'more';
  icon: IconName;
  label: string;
}

const items: BottomNavItem[] = [
  { id: 'overview', icon: 'home', label: 'Tổng quan' },
  { id: 'devices', icon: 'grid', label: 'Thiết bị' },
  { id: 'scenes', icon: 'sparkles', label: 'Kịch bản' },
  { id: 'energy', icon: 'energy', label: 'Điện năng' },
  { id: 'more', icon: 'more', label: 'Thêm' },
];

export const DashboardBottomNav: React.FC<DashboardBottomNavProps> = ({
  homeId,
  activeItem = 'overview',
  onSelectOverview,
  onOpenMore,
}) => {
  const navigate = useNavigate();

  const handleClick = (item: BottomNavItem) => {
    switch (item.id) {
      case 'overview':
        if (onSelectOverview) {
          onSelectOverview();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;
      case 'devices':
        if (homeId) {
          navigate(`/home/${encodeURIComponent(homeId)}/devices`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'scenes':
        if (homeId) {
          navigate(`/homes/${encodeURIComponent(homeId)}/scenes`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'energy':
        if (homeId) {
          navigate(`/home/${encodeURIComponent(homeId)}/energy`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'more':
        if (onOpenMore) {
          onOpenMore();
        }
        break;
    }
  };

  return (
    <nav className="bottom-nav glass-g2" aria-label="Điều hướng di động">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeItem === item.id ? 'active' : ''}
          onClick={() => handleClick(item)}
        >
          <span>
            <Icon name={item.icon} size={20} />
          </span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
};
