import React from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './HomeIcons';
import { notify } from '../ui/notify';
import type { UserResponse } from '../../types/auth';

interface DashboardNavRailProps {
  homeId?: string;
  activeItem?: 'overview' | 'devices' | 'twin' | 'energy' | 'scenes' | 'automations' | 'members';
  user?: UserResponse;
  onOpenSettings?: () => void;
  onSelectMembers?: () => void;
  onSelectOverview?: () => void;
  onOpenProfile?: () => void;
}

interface NavItemDef {
  id: 'overview' | 'devices' | 'twin' | 'energy' | 'scenes' | 'automations' | 'members';
  icon: IconName;
  label: string;
}

const navItems: NavItemDef[] = [
  { id: 'overview', icon: 'home', label: 'Tổng quan' },
  { id: 'devices', icon: 'grid', label: 'Thiết bị' },
  { id: 'twin', icon: 'cube', label: 'Mô hình 3D' },
  { id: 'energy', icon: 'energy', label: 'Tiêu thụ điện' },
  { id: 'scenes', icon: 'sparkles', label: 'Kịch bản' },
  { id: 'automations', icon: 'automation', label: 'Tự động hóa' },
  { id: 'members', icon: 'users', label: 'Thành viên' },
];

export const DashboardNavRail: React.FC<DashboardNavRailProps> = ({
  homeId,
  activeItem = 'overview',
  user,
  onOpenSettings,
  onSelectMembers,
  onSelectOverview,
  onOpenProfile,
}) => {
  const navigate = useNavigate();

  const handleNavClick = (item: NavItemDef) => {
    switch (item.id) {
      case 'overview':
        if (onSelectOverview) {
          onSelectOverview();
        } else {
          navigate('/home');
        }
        break;
      case 'devices':
        if (homeId) {
          navigate(`/home/${encodeURIComponent(homeId)}/devices`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'twin':
        if (homeId) {
          navigate(`/home/${encodeURIComponent(homeId)}/digital-twin`);
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
      case 'scenes':
        if (homeId) {
          navigate(`/homes/${encodeURIComponent(homeId)}/scenes`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'automations':
        if (homeId) {
          navigate(`/homes/${encodeURIComponent(homeId)}/automation-rules`);
        } else {
          notify.info('Hãy chọn hoặc tạo một ngôi nhà trước.');
        }
        break;
      case 'members':
        if (onSelectMembers) {
          onSelectMembers();
        } else {
          navigate('/home#members-section');
        }
        break;
    }
  };

  const userInitial = user?.fullName
    ? user.fullName.trim().split(' ').slice(-1)[0]?.charAt(0).toUpperCase() || 'M'
    : 'M';

  return (
    <aside className="nav-rail glass-g2">
      <div className="brand" title="HESTA Smart Home">
        H
      </div>

      <nav aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
              onClick={() => handleNavClick(item)}
            >
              <Icon name={item.icon} />
            </button>
          );
        })}
      </nav>

      <div className="nav-bottom">
        <button
          type="button"
          className="nav-item"
          aria-label="Cài đặt"
          title="Cài đặt"
          onClick={onOpenSettings}
        >
          <Icon name="settings" />
        </button>

        <button
          type="button"
          className="avatar small"
          aria-label="Hồ sơ tài khoản"
          title={user?.fullName || 'Tài khoản của bạn'}
          onClick={onOpenProfile}
        >
          {userInitial}
        </button>
      </div>
    </aside>
  );
};
