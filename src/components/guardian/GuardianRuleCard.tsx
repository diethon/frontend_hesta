import React, { useState, useEffect, useRef } from 'react';
import { Icon, type IconName } from '../ui/LucideIcon';
import { iconHue } from '../automation/iconHue';
import type { ParentalGuardianRule } from '../../types/guardian';

interface GuardianRuleCardProps {
  rule: ParentalGuardianRule;
  onToggleEnabled: (rule: ParentalGuardianRule) => void;
  onToggleAway: (rule: ParentalGuardianRule) => void;
  onExtend: (rule: ParentalGuardianRule, extraMinutes: number) => void;
  onUnlock: (rule: ParentalGuardianRule) => void;
  onDelete: (rule: ParentalGuardianRule) => void;
  onEdit: (rule: ParentalGuardianRule) => void;
  onOpenLogs: (rule: ParentalGuardianRule) => void;
}

const MAX_NODES = 3;
const EXTEND_MINUTES = 15;

const formatRemaining = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/** One guardian rule drawn like an automation circuit: away condition ── wire ──▶ limited devices. */
export const GuardianRuleCard: React.FC<GuardianRuleCardProps> = ({
  rule,
  onToggleEnabled,
  onToggleAway,
  onExtend,
  onUnlock,
  onDelete,
  onEdit,
  onOpenLogs,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCounting = rule.status === 'COUNTDOWN' || rule.status === 'WARNING';
  const isLocked = rule.status === 'LOCKED_OUT';

  useEffect(() => {
    if (!isCounting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isCounting]);

  const remaining = rule.sessionExpiresAt
    ? Math.max(0, Math.round((Date.parse(rule.sessionExpiresAt) - now) / 1000))
    : rule.remainingSeconds || 0;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const menuItem = (label: string, icon: IconName, handler: () => void, danger = false) => (
    <button
      type="button"
      className={danger ? 'danger' : ''}
      onClick={() => {
        setMenuOpen(false);
        handler();
      }}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );

  const trigger = `${
    rule.cameraDeviceName ? `Camera ${rule.cameraDeviceName} thấy bố mẹ vắng nhà` : 'Khi bố mẹ báo vắng nhà'
  } · tối đa ${rule.allowedDurationMinutes} phút`;
  const devices = rule.targetDevices;

  return (
    // Whole card opens on mouse click; keyboard/screen readers use the name button.
    <div onClick={() => onEdit(rule)} className={`st-circuit ${rule.enabled ? 'is-on' : 'is-off'}`}>
      <div className="st-circuit-id">
        <h4 title={rule.name}>
          <button
            type="button"
            className="st-circuit-open"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(rule);
            }}
            aria-label={`Quy tắc giám hộ ${rule.name}`}
          >
            {rule.name}
          </button>
        </h4>
        <span className="st-status">
          <i className={`st-dot ${isLocked ? 'err' : rule.enabled ? 'on' : ''}`} />
          {rule.enabled ? 'Đang bật' : 'Đang tắt'} · {rule.parentAway ? 'Bố mẹ vắng nhà' : 'Bố mẹ ở nhà'}
        </span>
      </div>

      <div className="st-pipe">
        <span className="st-node trigger" title={trigger}>
          <i className="st-node-icon" style={iconHue('shield')}>
            <Icon name="shield" />
          </i>
          <span>{trigger}</span>
        </span>
        <span className="st-wire" aria-hidden="true" />
        {devices.length === 0 ? (
          <span className="st-node missing">Thiếu thiết bị</span>
        ) : (
          <span className="st-node-stack">
            {devices.slice(0, MAX_NODES).map((device) => (
              <span key={device.id} className="st-node action" title={device.name} style={iconHue('power')}>
                <Icon name="power" />
                <span>{device.name}</span>
              </span>
            ))}
            {devices.length > MAX_NODES && <span className="st-node more">+{devices.length - MAX_NODES}</span>}
          </span>
        )}
        {rule.status === 'COUNTDOWN' && <span className="st-tag">Còn {formatRemaining(remaining)}</span>}
        {rule.status === 'WARNING' && <span className="st-tag warn">Sắp hết giờ · {formatRemaining(remaining)}</span>}
        {isLocked && <span className="st-tag err">Đã khóa</span>}
      </div>

      <div className="st-circuit-side" onClick={(e) => e.stopPropagation()}>
        {isLocked ? (
          <button type="button" className="st-btn st-btn-sm" onClick={() => onUnlock(rule)}>
            <Icon name="lock" size={14} />
            Mở khóa
          </button>
        ) : (
          <button
            type="button"
            className="st-btn st-btn-sm"
            aria-pressed={rule.parentAway}
            onClick={() => onToggleAway(rule)}
            title={rule.parentAway ? 'Tạm ngưng giám hộ vì bố mẹ đã về' : 'Bắt đầu giám hộ khi bố mẹ ra ngoài'}
          >
            <Icon name={rule.parentAway ? 'home' : 'shield'} size={14} />
            {rule.parentAway ? 'Đã về nhà' : 'Vắng nhà'}
          </button>
        )}
        <button
          type="button"
          aria-pressed={rule.enabled}
          aria-label={rule.enabled ? `Tắt quy tắc ${rule.name}` : `Bật quy tắc ${rule.name}`}
          onClick={() => onToggleEnabled(rule)}
          className={`toggle ${rule.enabled ? 'active' : ''}`}
          title={rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'}
        >
          <span />
        </button>
        <div ref={menuRef} className="st-menu-wrap">
          <button
            type="button"
            className="st-icon-btn"
            onClick={(e) => {
              // Open upward when the card sits near the bottom (incl. the mobile bottom nav).
              setMenuUp(window.innerHeight - e.currentTarget.getBoundingClientRect().bottom < 280);
              setMenuOpen((open) => !open);
            }}
            aria-label="Thao tác khác"
            aria-expanded={menuOpen}
          >
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div className={`st-menu${menuUp ? ' up' : ''}`}>
              {menuItem('Chỉnh sửa', 'pencil', () => onEdit(rule))}
              {(isCounting || isLocked) &&
                menuItem(`Cho thêm ${EXTEND_MINUTES} phút`, 'clock', () => onExtend(rule, EXTEND_MINUTES))}
              {isLocked && menuItem(rule.parentAway ? 'Đánh dấu đã về nhà' : 'Bật chế độ vắng nhà', 'home', () => onToggleAway(rule))}
              {menuItem('Xem nhật ký', 'clock', () => onOpenLogs(rule))}
              <hr />
              {menuItem('Xóa quy tắc', 'trash', () => onDelete(rule), true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
