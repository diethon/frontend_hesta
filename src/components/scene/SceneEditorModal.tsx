import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Sliders,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { SceneActionType, SceneResponse } from '../../types/scene';
import {
  AVAILABLE_ICONS,
  SCENE_PRESETS,
  getDeviceTypeIcon,
  detectSceneTheme,
} from './sceneConstants';
import { SceneIcon } from './SceneIcon';
import {
  buildSceneActionInput,
  getSceneDeviceActions,
  sceneActionsToDraft,
  type AnyDevice,
  type DraftSceneAction,
} from './sceneActions';

interface SceneEditorModalProps {
  homeId: string;
  editingScene: SceneResponse | null;
  devices: AnyDevice[];
  actionTypes: SceneActionType[];
  onClose: () => void;
  onSave: (payload: {
    name: string;
    icon: string;
    description: string;
    enabled: boolean;
    actions: DraftSceneAction[];
  }) => Promise<void>;
}

export const SceneEditorModal: React.FC<SceneEditorModalProps> = ({
  editingScene,
  devices,
  actionTypes,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(editingScene);
  const [name, setName] = useState(editingScene?.name ?? '');
  const [icon, setIcon] = useState(editingScene?.icon ?? 'home');
  const [description, setDescription] = useState(editingScene?.description ?? '');
  const [enabled, setEnabled] = useState(editingScene?.enabled ?? true);
  const [actions, setActions] = useState<DraftSceneAction[]>(
    editingScene ? sceneActionsToDraft(editingScene.actions) : [],
  );
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingScene) {
      setName(editingScene.name);
      setIcon(editingScene.icon ?? 'home');
      setDescription(editingScene.description ?? '');
      setEnabled(editingScene.enabled);
      setActions(sceneActionsToDraft(editingScene.actions));
    }
  }, [editingScene]);

  const currentTheme = detectSceneTheme(name, icon);

  const handleApplyPreset = (preset: (typeof SCENE_PRESETS)[0]) => {
    setName(preset.name);
    setIcon(preset.icon);
    setDescription(preset.description);
  };

  const handleAddAction = () => {
    const firstValidDevice =
      devices.find((d) => getSceneDeviceActions(d, actionTypes).length > 0) || devices[0];
    const defaultActions = firstValidDevice
      ? getSceneDeviceActions(firstValidDevice, actionTypes)
      : [];
    const firstAction = defaultActions[0];

    setActions((prev) => [
      ...prev,
      {
        deviceId: firstValidDevice?.id ?? '',
        action: firstAction?.code ?? '',
        value: firstAction?.defaultValue ?? '',
      },
    ]);
  };

  const handleUpdateAction = (index: number, patch: Partial<DraftSceneAction>) => {
    setActions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleChangeDevice = (index: number, deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId);
    const available = getSceneDeviceActions(dev, actionTypes);
    const first = available[0];
    handleUpdateAction(index, {
      deviceId,
      action: first?.code ?? '',
      value: first?.defaultValue ?? '',
    });
  };

  const handleChangeAction = (index: number, actionCode: string) => {
    const item = actions[index];
    const dev = devices.find((d) => d.id === item.deviceId);
    const available = getSceneDeviceActions(dev, actionTypes);
    const opt = available.find((a) => a.code === actionCode);
    handleUpdateAction(index, {
      action: actionCode,
      value: opt?.defaultValue ?? '',
    });
  };

  const handleMoveAction = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    setActions((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const handleRemoveAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên kịch bản.');
      return;
    }

    try {
      actions.forEach((act, idx) => {
        buildSceneActionInput(act, idx, devices, actionTypes);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dữ liệu hành động chưa hợp lệ.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        icon,
        description: description.trim(),
        enabled,
        actions,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu kịch bản. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-5 backdrop-blur-md transition-all duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="surface-card w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl shadow-2xl border border-line bg-surface/98 animate-in fade-in zoom-in-95 duration-200">
        {/* Header with ambient gradient banner */}
        <div className={`relative px-6 py-5 border-b border-line bg-gradient-to-r ${currentTheme.bgGradient}`}>
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3.5">
              <SceneIcon iconKey={icon} name={name} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-text">
                  {isEditing ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản thông minh'}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {isEditing
                    ? 'Cập nhật tên, biểu tượng và luồng thiết bị tự động.'
                    : 'Thiết lập chuỗi lệnh kích hoạt nhiều thiết bị chỉ bằng 1 thao tác.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl text-muted hover:text-text hover:bg-sidebar transition-all"
              title="Đóng cửa sổ"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Form */}
        <form
          aria-label={isEditing ? 'Chỉnh sửa kịch bản' : 'Tạo kịch bản'}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar"
        >
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-semibold text-rose-700 flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets Strip (when creating) */}
          {!isEditing && (
            <div className="space-y-2.5 bg-sidebar/50 p-4 rounded-2xl border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Chọn mẫu kịch bản thông minh có sẵn:</span>
                </span>
                <span className="text-[11px] text-muted">Bấm để tự điền thông tin</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SCENE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-sidebar text-xs font-semibold text-text transition-all duration-200 hover:scale-102 hover:border-primary/40 shadow-2xs"
                  >
                    <SceneIcon iconKey={preset.icon} size="xs" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Basic Information */}
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] items-start">
            {/* Visual Icon Picker Trigger */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text">Biểu tượng</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className={`flex items-center justify-center w-16 h-16 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                    showIconPicker
                      ? 'border-primary ring-4 ring-primary/20 scale-102'
                      : 'border-line hover:border-primary/50'
                  } bg-surface`}
                  title="Bấm để đổi biểu tượng"
                >
                  <SceneIcon iconKey={icon} name={name} size="md" />
                </button>

                {/* Icon Grid Popover */}
                {showIconPicker && (
                  <div className="absolute left-0 top-full mt-2.5 z-50 w-80 rounded-3xl border border-line bg-surface/98 p-3.5 shadow-2xl grid grid-cols-5 gap-2 backdrop-blur-lg animate-in fade-in zoom-in-95">
                    {AVAILABLE_ICONS.map((item) => {
                      const isSelected = icon === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setIcon(item.key);
                            setShowIconPicker(false);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${
                            isSelected
                              ? 'bg-primary text-white shadow-sm scale-105'
                              : 'hover:bg-sidebar text-text'
                          }`}
                          title={item.label}
                        >
                          <item.icon size={20} />
                          <span className="text-[10px] mt-1 font-medium truncate max-w-full">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Name & Description */}
            <div className="space-y-4">
              <div>
                <label htmlFor="scene-name" className="block text-xs font-bold text-text mb-1.5">
                  Tên kịch bản <span className="text-rose-500">*</span>
                </label>
                <input
                  id="scene-name"
                  type="text"
                  required
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Chào buổi sáng, Xem phim, Đi ngủ..."
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="scene-description" className="block text-xs font-bold text-text mb-1.5">
                  Mô tả mục đích
                </label>
                <textarea
                  id="scene-description"
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả tóm tắt những thao tác kịch bản sẽ thực hiện..."
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 transition-all shadow-xs resize-none"
                />
              </div>
            </div>
          </div>

          {/* Enabled Toggle Switch Card */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-sidebar/50 border border-line">
            <div>
              <span className="font-bold text-xs text-text block">Bật trạng thái kịch bản</span>
              <span className="text-[11px] text-muted block mt-0.5">
                Cho phép kích hoạt bằng 1 chạm, qua tự động hóa hoặc lịch hẹn giờ.
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-emerald-500 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5 shadow-xs" />
            </label>
          </div>

          {/* Section: Action Pipeline Sequence */}
          <div className="space-y-3.5 pt-3 border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-text flex items-center gap-2">
                  <Sliders size={16} className="text-primary" />
                  <span>Chuỗi lệnh thiết bị</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {actions.length} bước
                  </span>
                </h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Các lệnh được thực hiện tuần tự từ trên xuống dưới khi kích hoạt kịch bản.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddAction}
                disabled={devices.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                <Plus size={14} />
                <span>+ Thêm hành động</span>
              </button>
            </div>

            {devices.length === 0 ? (
              <p className="text-xs text-muted italic p-5 bg-sidebar/40 rounded-2xl border border-dashed border-line text-center">
                Chưa có thiết bị nào trong nhà. Hãy ghép nối thiết bị trước để sử dụng kịch bản.
              </p>
            ) : actions.length === 0 ? (
              <div className="p-8 rounded-3xl border border-dashed border-line bg-sidebar/20 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sidebar flex items-center justify-center text-muted mx-auto">
                  <Sliders size={20} />
                </div>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Kịch bản chưa có hành động nào. Nhấn nút <strong>Thêm hành động</strong> ở trên để liên kết thiết bị đầu tiên.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-line/70 before:-z-0">
                {actions.map((act, index) => {
                  const selectedDev = devices.find((d) => d.id === act.deviceId);
                  const availableActions = getSceneDeviceActions(selectedDev, actionTypes);
                  const selectedOpt = availableActions.find((a) => a.code === act.action);
                  const DevIcon = getDeviceTypeIcon(selectedDev?.deviceType);

                  return (
                    <div
                      key={index}
                      className="relative z-10 rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-xs hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-text">
                            Bước {index + 1}
                          </span>
                        </div>

                        {/* Order & Remove Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Đưa bước ${index + 1} lên`}
                            disabled={index === 0}
                            onClick={() => handleMoveAction(index, -1)}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                            title="Di chuyển lên"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Đưa bước ${index + 1} xuống`}
                            disabled={index === actions.length - 1}
                            onClick={() => handleMoveAction(index, 1)}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-sidebar disabled:opacity-25 transition-colors"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAction(index)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors ml-1"
                            title="Xóa bước này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Row Inputs: Device & Action */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1 flex items-center gap-1">
                            <DevIcon size={12} className="text-primary" />
                            <span>Thiết bị mục tiêu</span>
                          </label>
                          <select
                            required
                            value={act.deviceId}
                            onChange={(e) => handleChangeDevice(index, e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none shadow-2xs"
                          >
                            <option value="" disabled>
                              -- Chọn thiết bị trong nhà --
                            </option>
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.deviceType})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            Lệnh thực thi
                          </label>
                          <select
                            required
                            value={act.action}
                            onChange={(e) => handleChangeAction(index, e.target.value)}
                            disabled={!selectedDev || availableActions.length === 0}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-text focus:border-primary focus:outline-none disabled:opacity-50 shadow-2xs"
                          >
                            {!selectedDev && <option value="">Chọn thiết bị trước</option>}
                            {selectedDev && availableActions.length === 0 && (
                              <option value="">Thiết bị không hỗ trợ thao tác này</option>
                            )}
                            {availableActions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Value Input (Percentage, Number, JSON) */}
                      {selectedOpt && selectedOpt.valueKind === 'percentage' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60">
                          <div className="flex justify-between items-center text-xs font-bold text-text mb-1.5">
                            <span>{selectedOpt.valueLabel || 'Mức độ điều chỉnh'}</span>
                            <span className="font-extrabold text-primary text-sm px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                              {act.value || 0}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={act.value || '50'}
                              onChange={(e) => handleUpdateAction(index, { value: e.target.value })}
                              className="flex-1 accent-primary cursor-pointer h-2 bg-slate-200 rounded-lg"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={act.value}
                              onChange={(e) => handleUpdateAction(index, { value: e.target.value })}
                              className="w-16 rounded-xl border border-line px-2 py-1.5 text-xs text-center font-bold bg-surface"
                            />
                          </div>
                        </div>
                      )}

                      {selectedOpt && selectedOpt.valueKind === 'number' && (
                        <div className="pt-2 bg-sidebar/30 p-3 rounded-xl border border-line/60">
                          <label className="block text-[11px] font-bold text-muted mb-1.5">
                            {selectedOpt.valueLabel || 'Cài đặt nhiệt độ (°C)'}
                          </label>
                          <div className="flex items-center gap-2 max-w-[220px]">
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(act.value || 25);
                                handleUpdateAction(index, { value: String(Math.max(16, val - 1)) });
                              }}
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base text-text flex items-center justify-center hover:bg-sidebar active:scale-95 shadow-2xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={act.value}
                              onChange={(e) => handleUpdateAction(index, { value: e.target.value })}
                              className="w-20 rounded-xl border border-line px-2 py-1.5 text-sm text-center font-bold bg-surface"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(act.value || 25);
                                handleUpdateAction(index, { value: String(Math.min(32, val + 1)) });
                              }}
                              className="w-9 h-9 rounded-xl border border-line bg-surface font-extrabold text-base text-text flex items-center justify-center hover:bg-sidebar active:scale-95 shadow-2xs"
                            >
                              +
                            </button>
                            <span className="text-xs font-bold text-muted ml-1">°C</span>
                          </div>
                        </div>
                      )}

                      {selectedOpt && selectedOpt.valueKind === 'json' && (
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-muted mb-1">
                            {selectedOpt.valueLabel || 'Cấu hình tham số JSON'}
                          </label>
                          <textarea
                            value={act.value}
                            onChange={(e) => handleUpdateAction(index, { value: e.target.value })}
                            placeholder='{"power": "ON"}'
                            rows={2}
                            className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs font-mono text-text focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-sidebar hover:bg-sidebar-hover text-text transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang lưu kịch bản...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>{isEditing ? 'Lưu thay đổi' : 'Tạo kịch bản'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
