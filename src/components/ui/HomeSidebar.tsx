import { useNavigate } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { notify } from './notify';
import { AdminIcon, AppSidebar, AutomationIcon, DeviceIcon, EnergyIcon, HomeIcon, PeopleIcon, SceneIcon, TwinIcon } from './AppSidebar';

interface HomeSidebarProps {
  activeItem: 'overview' | 'devices' | 'twin' | 'energy' | 'scenes' | 'automations';
  homeId?: string;
  showSystemSummary?: boolean;
}

export function HomeSidebar({ activeItem, homeId, showSystemSummary }: HomeSidebarProps) {
  const navigate = useNavigate();
  const isAdmin = useAppSelector((state) => state.auth.user?.platformRole === 'ADMIN');
  const overview = homeId ? `/home?homeId=${encodeURIComponent(homeId)}` : '/home';
  const openPage = (page: string, routePrefix = 'home') => {
    if (homeId) navigate(`/${routePrefix}/${encodeURIComponent(homeId)}/${page}`);
    else notify.info('Hãy tạo hoặc tham gia một ngôi nhà trước.');
  };
  const openOverview = (section?: string) => {
    if (activeItem === 'overview' && !section) window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (activeItem === 'overview' && section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
    else navigate(`${overview}${section ? `#${section}` : ''}`);
  };

  return <AppSidebar activeItem={activeItem} contextLabel="Không gian sống" showSystemSummary={showSystemSummary} items={[
    { id: 'overview', label: 'Tổng quan', icon: <HomeIcon />, onClick: () => openOverview() },
    { id: 'devices', label: 'Thiết bị', icon: <DeviceIcon />, onClick: () => openPage('devices') },
    { id: 'twin', label: 'Digital Twin', icon: <TwinIcon />, onClick: () => openPage('digital-twin') },
    { id: 'energy', label: 'Tiêu thụ điện', icon: <EnergyIcon />, onClick: () => openPage('energy') },
    { id: 'scenes', label: 'Kịch bản', icon: <SceneIcon />, onClick: () => openPage('scenes', 'homes') },
    { id: 'automations', label: 'Tự động hóa', icon: <AutomationIcon />, onClick: () => openPage('automation-rules', 'homes') },
    { id: 'members', label: 'Thành viên', icon: <PeopleIcon />, onClick: () => openOverview('members-section') },
    ...(isAdmin ? [{ id: 'admin', label: 'Quản trị hệ thống', icon: <AdminIcon />, onClick: () => navigate('/admin') }] : []),
  ]} />;
}
