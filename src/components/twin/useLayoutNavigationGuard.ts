import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useAppSelector } from '../../store/hooks';
import { notify } from '../ui/notify';
import { confirmDialog } from '../ui/confirmDialog';

export function useLayoutNavigationGuard() {
  const dirty = useAppSelector((state) => state.twinLayout.dirty || state.twinLayout.metadataDirty);
  const saving = useAppSelector((state) => state.twinLayout.saving);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && currentLocation.pathname !== nextLocation.pathname);
  const asking = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return;
    if (saving) {
      notify.info('Sơ đồ đang được lưu', 'Vui lòng chờ hoàn tất trước khi rời trang.');
      blocker.reset();
      return;
    }
    asking.current = true;
    void confirmDialog({ title: 'Rời trang khi chưa lưu sơ đồ?', description: 'Các thay đổi sơ đồ chưa lưu sẽ bị bỏ.', confirmText: 'Rời trang', cancelText: 'Ở lại', variant: 'warning' })
      .then((leave) => { asking.current = false; if (leave) blocker.proceed?.(); else blocker.reset?.(); });
  }, [blocker, saving]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);
}
