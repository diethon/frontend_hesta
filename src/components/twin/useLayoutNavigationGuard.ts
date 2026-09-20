import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { useAppSelector } from '../../store/hooks';

export function useLayoutNavigationGuard() {
  const dirty = useAppSelector((state) => state.twinLayout.dirty);
  const saving = useAppSelector((state) => state.twinLayout.saving);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (saving) {
      window.alert('Sơ đồ đang được lưu. Vui lòng chờ kết quả trước khi rời trang.');
      blocker.reset();
    } else if (window.confirm('Bỏ các thay đổi sơ đồ chưa lưu và rời trang?')) blocker.proceed();
    else blocker.reset();
  }, [blocker, saving]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);
}
