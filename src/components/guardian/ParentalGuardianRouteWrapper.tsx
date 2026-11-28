import { useParams, useNavigate } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { ParentalGuardianPage } from './ParentalGuardianPage';

export function ParentalGuardianRouteWrapper() {
  const { homeId = '' } = useParams();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);

  return (
    <div className="app-shell scenes-page studio st-theme st-pro">
      <div className="mesh mesh-one" />
      <div className="mesh mesh-two" />
      <div className="mesh mesh-three" />

      {/* Desktop/Tablet NavRail */}
      <DashboardNavRail
        homeId={homeId}
        activeItem="automations"
        user={authUser ?? undefined}
        onSelectOverview={() => navigate('/home')}
      />

      <main>
        <ParentalGuardianPage homeId={homeId} />
      </main>

      <DashboardBottomNav activeItem="more" homeId={homeId} />
    </div>
  );
}
