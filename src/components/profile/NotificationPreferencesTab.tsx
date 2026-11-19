import React, { useEffect, useState } from 'react';
import type { NotificationPreferences } from '../../types/user';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/userApi';
import { getErrorMessage } from '../../utils/errors';
import { notify } from '../ui/notify';

const OPTIONS: Array<{ key: keyof NotificationPreferences; title: string; description: string }> = [
  { key: 'securityEnabled', title: 'An ninh & bất thường', description: 'Chuyển động, xâm nhập, cảm biến mất kết nối, khói/gas.' },
  { key: 'automationEnabled', title: 'Tự động hóa', description: 'Kịch bản, quy tắc tự động và gợi ý thói quen.' },
  { key: 'systemEnabled', title: 'Hệ thống & thiết bị', description: 'Cập nhật hệ thống và trạng thái thiết bị.' },
];

export const NotificationPreferencesTab: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getNotificationPreferences()
      .then((result) => { if (active) setPreferences(result); })
      .catch((error: unknown) => { if (active) setLoadError(getErrorMessage(error, 'Không tải được cài đặt thông báo.')); });
    return () => { active = false; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferences) return;
    setIsSaving(true);
    try {
      setPreferences(await updateNotificationPreferences(preferences));
      notify.success('Đã lưu cài đặt thông báo');
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, 'Lưu cài đặt thất bại. Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return <p role="alert" className="rounded-xl border border-error bg-error-soft px-4 py-3 text-xs text-text">{loadError}</p>;
  }
  if (!preferences) {
    return <p role="status" className="py-8 text-center text-sm text-muted">Đang tải cài đặt…</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 animate-in slide-in-from-right-4 duration-300">
      {OPTIONS.map((option) => {
        const checked = preferences[option.key];
        return (
          <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-text">{option.title}</span>
              <span className="block text-xs text-muted">{option.description}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label={option.title}
              checked={checked}
              onChange={() => setPreferences({ ...preferences, [option.key]: !checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden={true}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                checked ? 'bg-primary after:translate-x-5' : 'bg-off'
              }`}
            />
          </label>
        );
      })}

      <p className="text-xs text-muted">Cảnh báo khẩn cấp (xâm nhập, khói, gas) luôn được gửi để đảm bảo an toàn.</p>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-xl transition shadow-xs active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? 'Đang lưu…' : 'Lưu cài đặt'}
        </button>
      </div>
    </form>
  );
};
