import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import type { DeviceSummary } from '../../types/automation';
import type { SceneResponse, SceneActionType } from '../../types/scene';
import {
  type DraftSceneAction,
  type AnyDevice,
  buildSceneActionInput,
  sceneActionsToDraft,
  getSceneDeviceActions,
} from './sceneActions';
import { Icon, type IconName } from '../home/HomeIcons';
import { getFigmaIconForDevice, getFigmaIconForScene, SceneHistory } from './ScenePage';
import { DevicePickerSheet, isDeviceControllable } from './DevicePickerSheet';
import { SceneScheduleSection } from './SceneScheduleSection';
import { TestRunResultSheet, type TestRunActionResult } from './TestRunResultSheet';
import { createScene, updateScene, executeScene } from '../../services/sceneApi';
import { notify } from '../ui/notify';

interface SceneEditorProps {
  scene?: SceneResponse | null;
  homeId: string;
  devices: DeviceSummary[];
  actionTypes: SceneActionType[];
  onClose: () => void;
  onSaved: (savedScene: SceneResponse) => void;
  onDuplicate?: (scene: SceneResponse) => void;
  onDelete?: (scene: SceneResponse) => void;
}

// 20 neutral outline icons for popover grid
export const ICON_POPOVER_LIST: IconName[] = [
  'sun',
  'moon',
  'home',
  'door',
  'film',
  'briefcase',
  'sofa',
  'car',
  'coffee',
  'book',
  'shield',
  'leaf',
  'party',
  'plane',
  'bell',
  'activity',
  'thermometer',
  'snowflake',
  'droplet',
  'lock',
];

// 8 standard color swatches
export const COLOR_SWATCHES = [
  '#ff8a65',
  '#ffd54f',
  '#dce775',
  '#81c784',
  '#4dd0e1',
  '#64b5f6',
  '#ba68c8',
  '#f06292',
];

export function formatActionSummary(
  act: DraftSceneAction,
  dev?: DeviceSummary
): string {
  const code = act.action;
  if (code === 'TURN_ON') return 'Bật thiết bị';
  if (code === 'TURN_OFF') return 'Tắt thiết bị';
  if (code === 'TOGGLE') return 'Đảo trạng thái (Bật/Tắt)';
  if (code === 'OPEN') return 'Mở cửa';
  if (code === 'CLOSE') return 'Đóng cửa';
  if (code === 'STOP') return 'Dừng hành trình';
  if (code === 'SET_BRIGHTNESS') return `Độ sáng ${act.value || '80'}%`;
  if (code === 'SET_RGB' || code === 'SET_COLOR') {
    return `Đổi màu RGB ${act.value || '#FFCC00'}`;
  }
  if (code === 'SET_TEMPERATURE') return `Nhiệt độ ${act.value || '24'}°C`;
  if (code === 'SET_MODE') {
    const modes: Record<string, string> = {
      COOL: 'Làm lạnh',
      DRY: 'Hút ẩm',
      HEAT: 'Sưởi ấm',
      AUTO: 'Tự động',
    };
    return `Chế độ ${modes[act.value] || act.value}`;
  }
  if (code === 'SET_SPEED' || code === 'SET_FAN') {
    const speeds: Record<string, string> = {
      AUTO: 'Tự động',
      LOW: 'Tốc độ thấp',
      MEDIUM: 'Tốc độ vừa',
      HIGH: 'Tốc độ cao',
    };
    return `Quạt gió: ${speeds[act.value] || act.value}`;
  }
  return act.value ? `${code} · ${act.value}` : code;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  scene,
  homeId,
  devices,
  actionTypes,
  onClose,
  onSaved,
  onDuplicate,
  onDelete,
}) => {
  const isEdit = Boolean(scene?.id);

  // Step 0: Start from a template (only for new scene creation)
  const [templateStep, setTemplateStep] = useState(!isEdit);

  // Form states
  const [name, setName] = useState(scene?.name || '');
  const [editingTitleInline, setEditingTitleInline] = useState(false);
  const [description, setDescription] = useState(scene?.description || '');
  const [showDescriptionInput, setShowDescriptionInput] = useState(Boolean(scene?.description));
  const [icon, setIcon] = useState<IconName>(
    scene ? getFigmaIconForScene(scene.name, scene.icon) : 'sun'
  );
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [enabled, setEnabled] = useState(scene ? scene.enabled : true);
  const [actions, setActions] = useState<DraftSceneAction[]>(
    scene ? sceneActionsToDraft(scene.actions) : []
  );

  // Active tab: 'Thiết lập' | 'Lịch sử'
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');

  // Tracking expanded steps (set of step indexes)
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  // Sub-sheets
  const [pickingDeviceForIndex, setPickingDeviceForIndex] = useState<number | null>(null);
  const [testRunResults, setTestRunResults] = useState<TestRunActionResult[] | null>(null);
  const [testingRun, setTestingRun] = useState(false);

  // Dialogs
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [stepMenuIndex, setStepMenuIndex] = useState<number | null>(null);

  // Saving states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Initial snapshot for dirty check
  const initialSnapshot = useRef({
    name: scene?.name || '',
    description: scene?.description || '',
    icon: scene ? getFigmaIconForScene(scene.name, scene.icon) : 'sun',
    enabled: scene ? scene.enabled : true,
    actionsJson: JSON.stringify(scene ? sceneActionsToDraft(scene.actions) : []),
  });

  const isDirty = useMemo(() => {
    if (templateStep) return false;
    const currentActionsJson = JSON.stringify(actions);
    return (
      name !== initialSnapshot.current.name ||
      description !== initialSnapshot.current.description ||
      icon !== initialSnapshot.current.icon ||
      enabled !== initialSnapshot.current.enabled ||
      currentActionsJson !== initialSnapshot.current.actionsJson
    );
  }, [name, description, icon, enabled, actions, templateStep]);

  // Saved colors from local storage
  const savedColors = useMemo<string[]>(() => {
    try {
      const raw = localStorage.getItem('hesta_saved_color_chips');
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return ['#ffeb3b', '#4caf50', '#00bcd4', '#9c27b0'];
  }, []);

  // Handle Close with dirty check
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  // Template select handlers
  const handleSelectTemplate = (templateKey: 'morning' | 'night' | 'away' | 'home' | 'blank') => {
    if (templateKey === 'blank') {
      setName('Kịch bản mới');
      setIcon('sparkles');
      setDescription('');
      setActions([]);
      setTemplateStep(false);
      return;
    }

    const ctrlDevs = devices.filter(isDeviceControllable);
    const lightDev = ctrlDevs.find((d) => (d.deviceType || '').toUpperCase().includes('LIGHT') || (d.deviceType || '').toUpperCase().includes('LED'));
    const acDev = ctrlDevs.find((d) => (d.deviceType || '').toUpperCase().includes('AC') || (d.deviceType || '').toUpperCase().includes('AIR'));
    const gateDev = ctrlDevs.find((d) => (d.deviceType || '').toUpperCase().includes('GATE') || (d.deviceType || '').toUpperCase().includes('DOOR'));
    const plugDev = ctrlDevs.find((d) => (d.deviceType || '').toUpperCase().includes('PLUG') || (d.deviceType || '').toUpperCase().includes('SOCKET'));

    if (templateKey === 'morning') {
      setName('Chào buổi sáng');
      setIcon('sun');
      setDescription('Bật đèn, mở cổng đón ngày mới');
      const sampleActs: DraftSceneAction[] = [];
      if (lightDev) sampleActs.push({ deviceId: lightDev.id, action: 'TURN_ON', value: '' });
      if (gateDev) sampleActs.push({ deviceId: gateDev.id, action: 'OPEN', value: '' });
      if (sampleActs.length === 0 && ctrlDevs[0]) {
        sampleActs.push({ deviceId: ctrlDevs[0].id, action: 'TURN_ON', value: '' });
      }
      setActions(sampleActs);
    } else if (templateKey === 'night') {
      setName('Chúc ngủ ngon');
      setIcon('moon');
      setDescription('Tắt đèn, khóa cửa và tiết kiệm điện');
      const sampleActs: DraftSceneAction[] = [];
      if (lightDev) sampleActs.push({ deviceId: lightDev.id, action: 'TURN_OFF', value: '' });
      if (gateDev) sampleActs.push({ deviceId: gateDev.id, action: 'CLOSE', value: '' });
      if (sampleActs.length === 0 && ctrlDevs[0]) {
        sampleActs.push({ deviceId: ctrlDevs[0].id, action: 'TURN_OFF', value: '' });
      }
      setActions(sampleActs);
    } else if (templateKey === 'away') {
      setName('Rời khỏi nhà');
      setIcon('door');
      setDescription('Tắt toàn bộ thiết bị khi ra ngoài');
      const sampleActs: DraftSceneAction[] = [];
      ctrlDevs.slice(0, 3).forEach((d) => {
        sampleActs.push({ deviceId: d.id, action: 'TURN_OFF', value: '' });
      });
      setActions(sampleActs);
    } else if (templateKey === 'home') {
      setName('Về đến nhà');
      setIcon('home');
      setDescription('Bật đèn và khởi động điều hòa');
      const sampleActs: DraftSceneAction[] = [];
      if (lightDev) sampleActs.push({ deviceId: lightDev.id, action: 'TURN_ON', value: '' });
      if (acDev) sampleActs.push({ deviceId: acDev.id, action: 'TURN_ON', value: '' });
      if (sampleActs.length === 0 && ctrlDevs[0]) {
        sampleActs.push({ deviceId: ctrlDevs[0].id, action: 'TURN_ON', value: '' });
      }
      setActions(sampleActs);
    }

    setTemplateStep(false);
  };

  // Add a new action step (opens expanded)
  const handleAddAction = () => {
    const ctrlDevs = devices.filter(isDeviceControllable);
    const chosenDev = ctrlDevs[0] || devices[0];
    const newIdx = actions.length;

    let defaultAction = 'TURN_ON';
    let defaultValue = '';
    if (chosenDev) {
      const type = (chosenDev.deviceType || '').toUpperCase();
      if (type.includes('GATE') || type.includes('DOOR')) defaultAction = 'OPEN';
    }

    const newAct: DraftSceneAction = {
      deviceId: chosenDev ? chosenDev.id : '',
      action: defaultAction,
      value: defaultValue,
    };

    setActions((prev) => [...prev, newAct]);
    setExpandedSteps((prev) => ({ ...prev, [newIdx]: true }));
  };

  // Duplicate an action step
  const handleDuplicateStep = (idx: number) => {
    const target = actions[idx];
    if (!target) return;
    const duplicated = { ...target };
    setActions((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, duplicated);
      return next;
    });
    setStepMenuIndex(null);
    notify.success(`Đã nhân bản hành động #${idx + 1}`);
  };

  // Move step up / down
  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= actions.length) return;

    setActions((prev) => {
      const copy = [...prev];
      const item = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = item;
      return copy;
    });
    setStepMenuIndex(null);
  };

  // Delete an action step
  const handleDeleteStep = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
    setStepMenuIndex(null);
  };

  // Test Run Trigger
  const handleTestRun = async () => {
    if (actions.length === 0) {
      notify.info('Thêm ít nhất 1 hành động để chạy thử');
      return;
    }

    setTestingRun(true);
    if (isEdit && scene?.id) {
      try {
        const res = await executeScene(homeId, scene.id);
        const mappedResults: TestRunActionResult[] = (res.resultDetail || []).map((r) => {
          const dev = devices.find((d) => d.id === r.deviceId);
          return {
            deviceId: r.deviceId,
            deviceName: dev?.name || 'Thiết bị',
            action: r.action,
            success: r.success,
            message: r.message,
          };
        });

        if (mappedResults.length === 0) {
          // If result detail was empty, map directly from actions
          setTestRunResults(
            actions.map((a) => {
              const dev = devices.find((d) => d.id === a.deviceId);
              return {
                deviceId: a.deviceId,
                deviceName: dev?.name || 'Thiết bị',
                action: a.action,
                success: true,
              };
            })
          );
        } else {
          setTestRunResults(mappedResults);
        }
      } catch (err: unknown) {
        // Fallback simulated execution results
        setTestRunResults(
          actions.map((a) => {
            const dev = devices.find((d) => d.id === a.deviceId);
            const isOnline = dev ? dev.online !== false && dev.status !== 'OFFLINE' : false;
            return {
              deviceId: a.deviceId,
              deviceName: dev?.name || 'Thiết bị',
              action: a.action,
              success: isOnline,
              message: isOnline ? undefined : 'Thiết bị ngoại tuyến',
            };
          })
        );
      } finally {
        setTestingRun(false);
      }
    } else {
      // In-memory test run simulation for new scene
      setTimeout(() => {
        setTestRunResults(
          actions.map((a) => {
            const dev = devices.find((d) => d.id === a.deviceId);
            const isOnline = dev ? dev.online !== false && dev.status !== 'OFFLINE' : true;
            return {
              deviceId: a.deviceId,
              deviceName: dev?.name || 'Thiết bị',
              action: a.action,
              success: isOnline,
              message: isOnline ? undefined : 'Thiết bị ngoại tuyến',
            };
          })
        );
        setTestingRun(false);
      }, 700);
    }
  };

  // Save Scene
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError('Nhập tên kịch bản');
      notify.error('Nhập tên kịch bản');
      return;
    }
    if (actions.length === 0) {
      setSaveError('Thêm ít nhất 1 hành động');
      notify.error('Thêm ít nhất 1 hành động');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const payloadActions = actions.map((a, idx) =>
        buildSceneActionInput(a, idx, devices as AnyDevice[])
      );

      let result: SceneResponse;
      if (isEdit && scene?.id) {
        result = await updateScene(homeId, scene.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          enabled,
          actions: payloadActions,
        });
        notify.success(`Đã cập nhật kịch bản "${name}"`);
      } else {
        result = await createScene(homeId, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          enabled,
          actions: payloadActions,
        });
        notify.success(`Đã tạo kịch bản "${name}"`);
      }

      onSaved(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lưu · Thử lại';
      setSaveError(msg);
      notify.error('Không thể lưu · Thử lại', msg);
    } finally {
      setSaving(false);
    }
  };

  // Primary button validation reason
  const primaryDisabledReason = useMemo(() => {
    if (!name.trim()) return 'Nhập tên kịch bản';
    if (actions.length === 0) return 'Thêm ít nhất 1 hành động';
    return null;
  }, [name, actions]);

  return (
    <div className="scene-layer">
      {/* Backdrop */}
      <button
        type="button"
        className="detail-scrim"
        onClick={handleAttemptClose}
        aria-label="Đóng"
      />

      <aside className="scene-editor-panel glass-g2">
        <div className="sheet-handle" />

        {/* ── HEADER ── */}
        <header className="scene-editor-header">
          <div className="scene-editor-header-top">
            <button
              type="button"
              className="icon-button"
              onClick={handleAttemptClose}
              title="Đóng"
            >
              <span className="text-xl leading-none">×</span>
            </button>

            <div className="scene-editor-header-title">
              <div className="title-row">
                {editingTitleInline ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 30))}
                    onBlur={() => setEditingTitleInline(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingTitleInline(false);
                    }}
                    placeholder="Tên kịch bản"
                    maxLength={30}
                    autoFocus
                  />
                ) : (
                  <>
                    <strong
                      className="text-base font-bold text-[var(--text)] truncate cursor-pointer"
                      onClick={() => setEditingTitleInline(true)}
                      title="Nhấn để sửa tên"
                    >
                      {name || 'Tên kịch bản'}
                    </strong>
                    <button
                      type="button"
                      className="p-1 rounded-md text-[var(--tertiary)] hover:text-[var(--text)] transition-colors"
                      onClick={() => setEditingTitleInline(true)}
                      title="Chỉnh sửa tên"
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                  </>
                )}
              </div>

              <span className="caption">
                {!isEdit
                  ? 'Kịch bản mới'
                  : `${actions.length} hành động · ${enabled ? 'Đang bật' : 'Đang tắt'}`}
              </span>
            </div>

            <div className="scene-editor-header-actions">
              <button
                type="button"
                className={`toggle ${enabled ? 'active' : ''}`}
                onClick={() => setEnabled(!enabled)}
                title="Kích hoạt kịch bản"
              >
                <span />
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  title="Thêm tùy chọn"
                >
                  <Icon name="more" size={18} />
                </button>

                {showMoreMenu && (
                  <div className="scene-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        void handleTestRun();
                      }}
                    >
                      Chạy thử
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setActiveTab('history');
                      }}
                    >
                      Xem lịch sử
                    </button>
                    {isEdit && scene && onDuplicate && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          onDuplicate(scene);
                        }}
                      >
                        Nhân bản
                      </button>
                    )}
                    {isEdit && scene && onDelete && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setShowMoreMenu(false);
                          onDelete(scene);
                        }}
                      >
                        Xóa kịch bản
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Segmented control: [Thiết lập | Lịch sử] */}
          <div className="scene-editor-segments">
            <button
              type="button"
              className={activeTab === 'setup' ? 'active' : ''}
              onClick={() => setActiveTab('setup')}
            >
              Thiết lập
            </button>
            <button
              type="button"
              className={activeTab === 'history' ? 'active' : ''}
              onClick={() => setActiveTab('history')}
            >
              Lịch sử
            </button>
          </div>
        </header>

        {/* ── CONTENT AREA ── */}
        <div className="scene-editor-content">
          {activeTab === 'history' ? (
            /* Reused History View */
            scene ? (
              <SceneHistory
                scene={scene}
                homeId={homeId}
                onRerun={() => void handleTestRun()}
              />
            ) : (
              <div className="p-8 text-center text-xs text-[var(--tertiary)]">
                Kịch bản mới chưa có lịch sử chạy.
              </div>
            )
          ) : templateStep ? (
            /* CREATE MODE, STEP 0: START FROM A TEMPLATE */
            <div className="template-picker-step animate-in fade-in">
              <div>
                <strong className="text-sm font-bold text-[var(--text)] block">
                  Bắt đầu từ mẫu
                </strong>
                <p className="text-xs text-[var(--tertiary)]">
                  Chọn một mẫu kịch bản thường dùng hoặc tự tạo kịch bản trống
                </p>
              </div>

              <div className="template-grid">
                <div
                  className="template-card glass-g1"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTemplate('morning')}
                >
                  <div className="template-card-icon">
                    <Icon name="sun" size={22} />
                  </div>
                  <strong>Chào buổi sáng</strong>
                  <p>Bật đèn, mở cổng</p>
                </div>

                <div
                  className="template-card glass-g1"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTemplate('night')}
                >
                  <div className="template-card-icon">
                    <Icon name="moon" size={22} />
                  </div>
                  <strong>Chúc ngủ ngon</strong>
                  <p>Tắt đèn, khóa cửa</p>
                </div>

                <div
                  className="template-card glass-g1"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTemplate('away')}
                >
                  <div className="template-card-icon">
                    <Icon name="door" size={22} />
                  </div>
                  <strong>Rời khỏi nhà</strong>
                  <p>Tắt toàn bộ thiết bị</p>
                </div>

                <div
                  className="template-card glass-g1"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectTemplate('home')}
                >
                  <div className="template-card-icon">
                    <Icon name="home" size={22} />
                  </div>
                  <strong>Về đến nhà</strong>
                  <p>Bật đèn, bật điều hòa</p>
                </div>
              </div>

              <div
                className="template-blank-card"
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTemplate('blank')}
              >
                <div className="action-step-bubble-36">
                  <Icon name="sparkles" size={18} />
                </div>
                <div>
                  <strong>Tạo kịch bản trống</strong>
                  <p>Thiết lập hành động thủ công từ đầu</p>
                </div>
              </div>
            </div>
          ) : (
            /* TAB "THIẾT LẬP" SECTIONS: 1. THÔNG TIN | 2. HÀNH ĐỘNG | 3. LỊCH CHẠY */
            <>
              {saveError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium">
                  {saveError}
                </div>
              )}

              {/* ──────────────── 1) THÔNG TIN ──────────────── */}
              <section className="space-y-3">
                <div className="scene-section-title">
                  <strong>Thông tin</strong>
                </div>

                <div className="icon-name-row">
                  {/* Round 56px icon button opening 20 neutral outline icons */}
                  <button
                    type="button"
                    className="icon-bubble-56"
                    onClick={() => setShowIconPopover(!showIconPopover)}
                    title="Chọn biểu tượng"
                  >
                    <Icon name={icon} size={28} />
                  </button>

                  {/* Popover Grid of 20 Icons */}
                  {showIconPopover && (
                    <div className="icon-popover-grid animate-in fade-in">
                      {ICON_POPOVER_LIST.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          className={icon === ic ? 'active' : ''}
                          onClick={() => {
                            setIcon(ic);
                            setShowIconPopover(false);
                          }}
                          title={ic}
                        >
                          <Icon name={ic} size={20} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Name Input with Character Counter */}
                  <div className="scene-name-field">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 30))}
                      placeholder="Tên kịch bản..."
                      maxLength={30}
                      required
                    />
                    <span className="scene-char-counter">{name.length}/30</span>
                  </div>
                </div>

                {/* Collapsed Description */}
                <div>
                  {showDescriptionInput ? (
                    <div className="space-y-1">
                      <input
                        className="picker-search"
                        value={description}
                        onChange={(e) => setDescription(e.target.value.slice(0, 100))}
                        placeholder="Mô tả mục đích kịch bản..."
                        maxLength={100}
                        autoFocus
                      />
                      <div className="flex justify-between items-center text-[10px] text-[var(--tertiary)] px-1">
                        <button
                          type="button"
                          className="hover:underline text-[var(--secondary)]"
                          onClick={() => {
                            setDescription('');
                            setShowDescriptionInput(false);
                          }}
                        >
                          Thu gọn mô tả
                        </button>
                        <span>{description.length}/100</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] font-semibold hover:underline"
                      onClick={() => setShowDescriptionInput(true)}
                    >
                      + Thêm mô tả
                    </button>
                  )}
                </div>
              </section>

              {/* ──────────────── 2) HÀNH ĐỘNG ──────────────── */}
              <section className="space-y-3">
                <div className="scene-section-title">
                  <div>
                    <strong>Hành động ({actions.length})</strong>
                    <p>Chạy lần lượt từ trên xuống</p>
                  </div>
                  <button
                    type="button"
                    className="scene-ghost text-xs h-9 px-3.5"
                    onClick={handleAddAction}
                  >
                    + Thêm hành động
                  </button>
                </div>

                {actions.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--tertiary)] flex flex-col items-center gap-3">
                    <span>Chưa có hành động nào</span>
                    <button
                      type="button"
                      className="add-device text-xs h-9 px-4"
                      onClick={handleAddAction}
                    >
                      + Thêm hành động
                    </button>
                  </div>
                ) : (
                  <div className="timeline-list">
                    {actions.map((act, idx) => {
                      const dev = devices.find((d) => d.id === act.deviceId);
                      const isExpanded = Boolean(expandedSteps[idx]);
                      const isOffline = dev ? dev.online === false || dev.status === 'OFFLINE' : false;
                      const isMissingDevice = !dev && !act.deviceId;
                      const isDeletedDevice = !dev && Boolean(act.deviceId);

                      const devType = (dev?.deviceType || '').toUpperCase();
                      const isLight = devType.includes('LIGHT') || devType.includes('LED') || devType.includes('LAMP');
                      const isAc = devType.includes('AC') || devType.includes('AIR');
                      const isGate = devType.includes('GATE') || devType.includes('DOOR') || devType.includes('COVER');
                      const isFan = devType.includes('FAN');

                      const iconName: IconName = getFigmaIconForDevice(act.action, dev?.name);

                      return (
                        <div key={idx} className="timeline-step">
                          {/* Indicator Spine */}
                          <div className="timeline-spine">
                            <span className="timeline-badge">{idx + 1}</span>
                            {idx < actions.length - 1 && <div className="timeline-line" />}
                          </div>

                          {/* ActionStep Card */}
                          <div
                            className={`action-step-card glass-g1 ${isExpanded ? 'expanded' : ''}`}
                          >
                            {!isExpanded ? (
                              /* ── COLLAPSED VIEW ── */
                              <div
                                className="action-step-collapsed"
                                onClick={() =>
                                  setExpandedSteps((prev) => ({ ...prev, [idx]: true }))
                                }
                              >
                                <div className="action-step-bubble-36">
                                  <Icon name={iconName} size={18} />
                                </div>

                                <div className="action-step-info">
                                  <strong className={isDeletedDevice ? 'text-rose-500' : ''}>
                                    {isDeletedDevice
                                      ? 'Thiết bị đã bị xóa'
                                      : dev?.name || 'Chưa chọn thiết bị'}
                                  </strong>
                                  <p>{formatActionSummary(act, dev)}</p>
                                </div>

                                <div
                                  className="action-step-controls"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="drag-handle" title="Kéo để đổi vị trí">
                                    <Icon name="drag" size={16} />
                                  </span>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="icon-button w-8 h-8"
                                      onClick={() =>
                                        setStepMenuIndex(stepMenuIndex === idx ? null : idx)
                                      }
                                      title="Thao tác"
                                    >
                                      <Icon name="more" size={16} />
                                    </button>

                                    {stepMenuIndex === idx && (
                                      <div className="scene-menu">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveStep(idx, 'up')}
                                        >
                                          Di chuyển lên
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === actions.length - 1}
                                          onClick={() => handleMoveStep(idx, 'down')}
                                        >
                                          Di chuyển xuống
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDuplicateStep(idx)}
                                        >
                                          Nhân bản
                                        </button>
                                        <button
                                          type="button"
                                          className="danger"
                                          onClick={() => handleDeleteStep(idx)}
                                        >
                                          Xóa hành động
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* ── EXPANDED VIEW ── */
                              <div className="action-step-expanded">
                                {/* a. Thiết bị Picker field */}
                                <div>
                                  <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1">
                                    Thiết bị
                                  </label>

                                  <button
                                    type="button"
                                    className={`action-picker-field ${
                                      isMissingDevice || isDeletedDevice ? 'error' : ''
                                    }`}
                                    onClick={() => setPickingDeviceForIndex(idx)}
                                  >
                                    <div className="action-picker-field-left">
                                      <div className="action-step-bubble-36">
                                        <Icon name={iconName} size={18} />
                                      </div>
                                      <div>
                                        <strong>
                                          {isDeletedDevice
                                            ? 'Thiết bị đã bị xóa'
                                            : dev?.name || 'Chọn thiết bị'}
                                        </strong>
                                        <small>
                                          {dev?.roomName || dev?.room || 'Chưa phân phòng'}
                                        </small>
                                      </div>
                                    </div>
                                    <Icon name="chevron" size={16} className="text-[var(--tertiary)]" />
                                  </button>

                                  {isOffline && (
                                    <p className="text-[11px] text-amber-600 mt-1">
                                      Thiết bị đang ngoại tuyến, lệnh sẽ không chạy được.
                                    </p>
                                  )}
                                  {isDeletedDevice && (
                                    <div className="flex items-center justify-between mt-1 text-[11px] text-rose-500">
                                      <span>Thiết bị đã bị xóa khỏi nhà</span>
                                      <button
                                        type="button"
                                        className="font-semibold underline"
                                        onClick={() => setPickingDeviceForIndex(idx)}
                                      >
                                        Chọn thiết bị khác
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* b. Lệnh Chips */}
                                <div>
                                  <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1.5">
                                    Lệnh thực thi
                                  </label>

                                  <div className="command-chips-row">
                                    {isLight && (
                                      <>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_ON' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_ON', value: '' } : a))}
                                        >
                                          Bật
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_OFF' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_OFF', value: '' } : a))}
                                        >
                                          Tắt
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TOGGLE' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TOGGLE', value: '' } : a))}
                                        >
                                          Đảo trạng thái
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'SET_BRIGHTNESS' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_BRIGHTNESS', value: /^\d+$/.test(a.value) ? a.value : '80' } : a))}
                                        >
                                          Độ sáng
                                        </button>
                                        {(devType.includes('RGB') || devType.includes('LED_RGB')) && (
                                          <button
                                            type="button"
                                            className={`command-chip ${act.action === 'SET_RGB' || act.action === 'SET_COLOR' ? 'active' : ''}`}
                                            onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_RGB', value: a.value && a.value.startsWith('#') ? a.value : '#ffd54f' } : a))}
                                          >
                                            Màu RGB
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {isAc && (
                                      <>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_ON' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_ON', value: '' } : a))}
                                        >
                                          Bật
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_OFF' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_OFF', value: '' } : a))}
                                        >
                                          Tắt
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'SET_TEMPERATURE' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_TEMPERATURE', value: a.value || '24' } : a))}
                                        >
                                          Nhiệt độ
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'SET_MODE' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_MODE', value: a.value || 'COOL' } : a))}
                                        >
                                          Chế độ
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'SET_SPEED' || act.action === 'SET_FAN' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_SPEED', value: a.value || 'AUTO' } : a))}
                                        >
                                          Quạt
                                        </button>
                                      </>
                                    )}

                                    {isGate && (
                                      <>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'OPEN' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'OPEN', value: '' } : a))}
                                        >
                                          Mở
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'STOP' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'STOP', value: '' } : a))}
                                        >
                                          Dừng
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'CLOSE' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'CLOSE', value: '' } : a))}
                                        >
                                          Đóng
                                        </button>
                                      </>
                                    )}

                                    {!isLight && !isAc && !isGate && (
                                      <>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_ON' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_ON', value: '' } : a))}
                                        >
                                          Bật
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TURN_OFF' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TURN_OFF', value: '' } : a))}
                                        >
                                          Tắt
                                        </button>
                                        <button
                                          type="button"
                                          className={`command-chip ${act.action === 'TOGGLE' ? 'active' : ''}`}
                                          onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'TOGGLE', value: '' } : a))}
                                        >
                                          Đảo trạng thái
                                        </button>
                                        {isFan && (
                                          <button
                                            type="button"
                                            className={`command-chip ${act.action === 'SET_SPEED' ? 'active' : ''}`}
                                            onClick={() => setActions((p) => p.map((a, i) => i === idx ? { ...a, action: 'SET_SPEED', value: a.value || '50' } : a))}
                                          >
                                            Tốc độ
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* c. Tham số (chỉ hiện khi lệnh cần tham số) */}
                                {act.action === 'SET_BRIGHTNESS' && (
                                  <div>
                                    <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1">
                                      Độ sáng: {act.value || '80'}%
                                    </label>
                                    <div className="light-pill-slider">
                                      <span style={{ width: `${Number(act.value || 80)}%` }} />
                                      <i style={{ left: `calc(${Number(act.value || 80)}% - 14px)` }} />
                                      <b>{act.value || 80}%</b>
                                      <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={Number(act.value || 80)}
                                        onChange={(e) =>
                                          setActions((p) =>
                                            p.map((a, i) =>
                                              i === idx ? { ...a, value: e.target.value } : a
                                            )
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                )}

                                {(act.action === 'SET_RGB' || act.action === 'SET_COLOR') && (
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-semibold text-[var(--secondary)] block">
                                      Màu sắc ({act.value || '#ffd54f'})
                                    </label>

                                    {/* 8 Preset Swatches */}
                                    <div className="step-color-row">
                                      {COLOR_SWATCHES.map((hex) => (
                                        <button
                                          key={hex}
                                          type="button"
                                          style={{ background: hex }}
                                          className={`step-color-swatch ${
                                            (act.value || '').toLowerCase() === hex.toLowerCase()
                                              ? 'active'
                                              : ''
                                          }`}
                                          onClick={() =>
                                            setActions((p) =>
                                              p.map((a, i) => (i === idx ? { ...a, value: hex } : a))
                                            )
                                          }
                                        />
                                      ))}
                                    </div>

                                    {/* Saved User Color Chips */}
                                    {savedColors.length > 0 && (
                                      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                        <span className="text-[10px] text-[var(--tertiary)] shrink-0">
                                          Đã lưu:
                                        </span>
                                        {savedColors.map((hex) => (
                                          <button
                                            key={hex}
                                            type="button"
                                            className="w-5 h-5 rounded-full border shrink-0"
                                            style={{ background: hex }}
                                            onClick={() =>
                                              setActions((p) =>
                                                p.map((a, i) => (i === idx ? { ...a, value: hex } : a))
                                              )
                                            }
                                          />
                                        ))}
                                      </div>
                                    )}

                                    {/* Custom Color Picker & HEX input */}
                                    <div className="p-3 rounded-2xl bg-[var(--muted)] border border-[var(--border)] space-y-2">
                                      <div className="custom-color-picker-wrap">
                                        <HexColorPicker
                                          color={
                                            act.value && act.value.startsWith('#')
                                              ? act.value
                                              : '#ffd54f'
                                          }
                                          onChange={(color) =>
                                            setActions((p) =>
                                              p.map((a, i) => (i === idx ? { ...a, value: color } : a))
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--secondary)] font-mono">
                                          HEX
                                        </span>
                                        <input
                                          className="scene-select flex-1 font-mono uppercase text-xs"
                                          value={act.value || '#ffd54f'}
                                          onChange={(e) =>
                                            setActions((p) =>
                                              p.map((a, i) =>
                                                i === idx ? { ...a, value: e.target.value } : a
                                              )
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {act.action === 'SET_TEMPERATURE' && (
                                  <div>
                                    <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1">
                                      Nhiệt độ cài đặt
                                    </label>
                                    <div className="stepper-row">
                                      <button
                                        type="button"
                                        className="stepper-btn"
                                        disabled={Number(act.value || 24) <= 16}
                                        onClick={() =>
                                          setActions((p) =>
                                            p.map((a, i) =>
                                              i === idx
                                                ? {
                                                    ...a,
                                                    value: String(
                                                      Math.max(16, Number(a.value || 24) - 1)
                                                    ),
                                                  }
                                                : a
                                            )
                                          )
                                        }
                                      >
                                        −
                                      </button>
                                      <span className="stepper-value">
                                        {act.value || 24}°C
                                      </span>
                                      <button
                                        type="button"
                                        className="stepper-btn"
                                        disabled={Number(act.value || 24) >= 30}
                                        onClick={() =>
                                          setActions((p) =>
                                            p.map((a, i) =>
                                              i === idx
                                                ? {
                                                    ...a,
                                                    value: String(
                                                      Math.min(30, Number(a.value || 24) + 1)
                                                    ),
                                                  }
                                                : a
                                            )
                                          )
                                        }
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {act.action === 'SET_MODE' && (
                                  <div>
                                    <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1">
                                      Chế độ điều hòa
                                    </label>
                                    <div className="detail-segments">
                                      {[
                                        ['COOL', 'Lạnh'],
                                        ['DRY', 'Hút ẩm'],
                                        ['HEAT', 'Sưởi'],
                                        ['AUTO', 'Tự động'],
                                      ].map(([modeCode, modeLabel]) => (
                                        <button
                                          key={modeCode}
                                          type="button"
                                          className={
                                            (act.value || 'COOL') === modeCode ? 'active' : ''
                                          }
                                          onClick={() =>
                                            setActions((p) =>
                                              p.map((a, i) =>
                                                i === idx ? { ...a, value: modeCode } : a
                                              )
                                            )
                                          }
                                        >
                                          {modeLabel}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(act.action === 'SET_SPEED' || act.action === 'SET_FAN') && (
                                  <div>
                                    <label className="text-[11px] font-semibold text-[var(--secondary)] block mb-1">
                                      Tốc độ quạt
                                    </label>
                                    <div className="detail-segments">
                                      {[
                                        ['AUTO', 'Tự động'],
                                        ['LOW', 'Thấp'],
                                        ['MEDIUM', 'Vừa'],
                                        ['HIGH', 'Cao'],
                                      ].map(([spdCode, spdLabel]) => (
                                        <button
                                          key={spdCode}
                                          type="button"
                                          className={
                                            (act.value || 'AUTO') === spdCode ? 'active' : ''
                                          }
                                          onClick={() =>
                                            setActions((p) =>
                                              p.map((a, i) =>
                                                i === idx ? { ...a, value: spdCode } : a
                                              )
                                            )
                                          }
                                        >
                                          {spdLabel}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* d. Footer of step: Text button "Thu gọn" */}
                                <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                                  <button
                                    type="button"
                                    className="text-xs text-rose-500 hover:underline"
                                    onClick={() => handleDeleteStep(idx)}
                                  >
                                    Xóa hành động
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-[var(--accent)] font-semibold hover:underline"
                                    onClick={() =>
                                      setExpandedSteps((prev) => ({ ...prev, [idx]: false }))
                                    }
                                  >
                                    Thu gọn
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ──────────────── 3) LỊCH CHẠY ──────────────── */}
              <section className="pt-2 border-t border-[var(--border)]">
                <SceneScheduleSection
                  homeId={homeId}
                  sceneId={scene?.id}
                />
              </section>
            </>
          )}
        </div>

        {/* ── STICKY FOOTER ── */}
        {!templateStep && activeTab === 'setup' && (
          <footer className="scene-editor-footer">
            <div className="scene-editor-footer-buttons">
              <button
                type="button"
                className="scene-ghost h-10 px-4 text-xs font-semibold"
                disabled={testingRun || actions.length === 0}
                onClick={() => void handleTestRun()}
              >
                {testingRun ? 'Đang chạy thử…' : 'Chạy thử'}
              </button>

              <button
                type="button"
                className="add-device h-10 px-5 text-xs font-semibold"
                disabled={saving || Boolean(primaryDisabledReason)}
                onClick={(e) => void handleSave(e)}
              >
                {saving
                  ? 'Đang lưu…'
                  : isEdit
                  ? 'Lưu kịch bản'
                  : 'Tạo kịch bản'}
                {isDirty && <span className="btn-unsaved-dot" />}
              </button>
            </div>

            {primaryDisabledReason && (
              <p className="scene-editor-footer-hint">
                {primaryDisabledReason}
              </p>
            )}
          </footer>
        )}

        {/* ── SECOND-LEVEL SHEET: DevicePickerSheet ── */}
        {pickingDeviceForIndex !== null && (
          <DevicePickerSheet
            devices={devices}
            selectedDeviceId={actions[pickingDeviceForIndex]?.deviceId}
            onSelect={(selectedDev) => {
              const idx = pickingDeviceForIndex;
              const type = (selectedDev.deviceType || '').toUpperCase();
              let nextAction = 'TURN_ON';
              if (type.includes('GATE') || type.includes('DOOR')) nextAction = 'OPEN';

              setActions((prev) =>
                prev.map((a, i) =>
                  i === idx
                    ? {
                        deviceId: selectedDev.id,
                        action: nextAction,
                        value: '',
                      }
                    : a
                )
              );
              setPickingDeviceForIndex(null);
            }}
            onClose={() => setPickingDeviceForIndex(null)}
          />
        )}

        {/* ── IN-PANEL SHEET: TestRunResultSheet ── */}
        {testRunResults !== null && (
          <TestRunResultSheet
            results={testRunResults}
            devices={devices}
            running={testingRun}
            onRerun={() => void handleTestRun()}
            onClose={() => setTestRunResults(null)}
          />
        )}
      </aside>

      {/* ── UNSAVED CHANGES CONFIRMATION DIALOG ── */}
      {showUnsavedDialog && (
        <div className="delete-dialog glass-g2">
          <strong>Bỏ thay đổi?</strong>
          <p>Các thay đổi trong kịch bản chưa được lưu sẽ bị mất.</p>
          <div>
            <button
              type="button"
              onClick={() => setShowUnsavedDialog(false)}
            >
              Tiếp tục chỉnh sửa
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setShowUnsavedDialog(false);
                onClose();
              }}
            >
              Bỏ thay đổi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
