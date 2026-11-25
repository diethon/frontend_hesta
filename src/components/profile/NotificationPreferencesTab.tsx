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
    return <p role="alert" className="rounded-xl border border-[#f43f5e]/45 bg-[#fff1f2] px-4 py-3 text-xs font-medium text-[#be123c]">{loadError}</p>;
  }
  if (!preferences) {
    return <p role="status" className="py-8 text-center text-sm text-[#475569]">Đang tải cài đặt…</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 animate-in slide-in-from-right-4 duration-300">
      {OPTIONS.map((option) => {
        const checked = preferences[option.key];
        return (
          <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white hover:border-[#94a3b8] px-4 py-3.5 transition-colors">
            <span>
              <span className="block text-sm font-bold text-[#0f172a]">{option.title}</span>
              <span className="block text-xs text-[#475569] mt-0.5">{option.description}</span>
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
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-[#2563eb] ${
                checked ? 'bg-[#2563eb] after:translate-x-5' : 'bg-[#cbd5e1]'
              }`}
            />
          </label>
        );
      })}

      <p className="rounded-xl border border-[#f59e0b]/45 bg-[#fffbeb] px-3.5 py-2.5 text-xs font-medium text-[#92400e]">
        Cảnh báo khẩn cấp (xâm nhập, khói, gas) luôn được gửi để đảm bảo an toàn.
      </p>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto sm:min-w-[180px] py-2.5 px-6 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm rounded-xl transition shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? 'Đang lưu…' : 'Lưu cài đặt'}
        </button>
      </div>
    </form>
  );
};
