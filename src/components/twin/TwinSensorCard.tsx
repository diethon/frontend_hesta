import { useAppSelector } from '../../store/hooks';
import { selectTwinSensor } from '../../store/twinSelectors';
import { TwinHealthBadge } from './TwinHealthBadge';
import { TwinTime } from './TwinTime';
import { useTwinUpdateMotion } from './useTwinMotion';

export function TwinSensorCard({ sensorId }: { sensorId: string }) {
  const sensor = useAppSelector((state) => selectTwinSensor(state, sensorId));
  const motionRef = useTwinUpdateMotion<HTMLParagraphElement>(JSON.stringify([sensor?.latestValue, sensor?.observedAt]));
  if (!sensor) return null;
  return (
    <article aria-label={`Cảm biến ${sensor.metricType}`} className="min-w-0 rounded-2xl border border-line bg-info-soft p-4">
      <h4 className="break-words text-sm font-semibold">{sensor.metricType}</h4>
      <p ref={motionRef} aria-live="polite" aria-atomic="true" className="my-4 break-words text-3xl font-semibold tracking-tight text-text">
        {sensor.latestValue ?? '—'}{sensor.unit ? <span className="ml-2 text-base font-medium text-muted">{sensor.unit}</span> : null}
      </p>
      <TwinHealthBadge healthStatus={sensor.healthStatus} />
      <p className="mt-3 break-words text-xs text-muted">Cập nhật: <TwinTime value={sensor.observedAt} /></p>
    </article>
  );
}
