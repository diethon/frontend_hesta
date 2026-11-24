import { useState, type CSSProperties } from 'react';
import { actionOptions, type ActionOption } from '../deviceActionOptions';
import { getApertureInterlock } from '../device/deviceHelpers';
import { TwinLayoutButton } from './TwinLayoutButton';

interface ControlProps {
  disabled: boolean;
  onExecute: (action: string, parameters?: Record<string, unknown>) => void;
}

const fanOption: ActionOption = {
  code: 'SET_FAN', label: 'Đặt chế độ quạt', valueKind: 'text',
  valueLabel: 'Chế độ quạt (AUTO, LOW, MEDIUM, HIGH)', parameterKey: 'fan', defaultValue: 'AUTO',
};

function ValueControl({ option, initialValue, disabled, onExecute }: ControlProps & { option: ActionOption; initialValue: unknown }) {
  const [value, setValue] = useState(typeof initialValue === 'number' || typeof initialValue === 'string' ? String(initialValue) : option.defaultValue);
  if (!option.parameterKey) return null;
  const parameterKey = option.parameterKey;
  const numeric = option.valueKind === 'number' || option.valueKind === 'percentage';
  const valid = numeric ? value.trim() !== '' && Number.isFinite(Number(value))
    && (option.valueKind !== 'percentage' || (Number(value) >= 0 && Number(value) <= 100)) : value.trim() !== '';
  return <form className="twin-control-form space-y-2" onSubmit={(event) => {
    event.preventDefault();
    if (valid && !disabled) onExecute(option.code, { [parameterKey]: numeric ? Number(value) : value.trim() });
  }}>
    <label className="block text-xs font-semibold text-muted">{option.valueLabel}
      {option.valueKind === 'percentage' ? <span className="mt-2 flex items-center gap-3"><input disabled={disabled} type="range" min={0} max={100} step={1} value={value} style={{ '--twin-range-progress': `${Math.max(0, Math.min(100, Number(value) || 0))}%` } as CSSProperties} onChange={(event) => setValue(event.target.value)} className="twin-control-range min-h-11 min-w-0 flex-1 cursor-pointer disabled:opacity-40" /><output className="min-w-12 rounded-lg bg-info-soft px-2 py-1.5 text-right text-sm font-semibold text-text">{value}%</output></span> : <input disabled={disabled} type={numeric ? 'number' : 'text'} step={numeric ? 'any' : undefined} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-sm text-text" />}
    </label>
    {option.valueKind === 'percentage' ? <div className="grid grid-cols-4 gap-1" aria-label={`Mức nhanh · ${option.valueLabel}`}>{[25, 50, 75, 100].map((preset) => <button key={preset} type="button" disabled={disabled} aria-label={`${option.valueLabel} ${preset}%`} aria-pressed={Number(value) === preset} onClick={() => setValue(String(preset))} className={`min-h-11 rounded-lg border text-xs font-medium disabled:opacity-40 ${Number(value) === preset ? 'border-primary bg-info-soft text-primary-hover' : 'border-line bg-surface text-muted hover:bg-app'}`}>{preset}%</button>)}</div> : null}
    <TwinLayoutButton disabled={disabled || !valid} type="submit">{option.label}</TwinLayoutButton>
  </form>;
}

function ColorControl({ action, initialValue, disabled, onExecute }: ControlProps & { action: string; initialValue: string }) {
  const [color, setColor] = useState(initialValue);
  return <form className="twin-control-form space-y-2" onSubmit={(event) => {
    event.preventDefault();
    if (!disabled) onExecute(action, { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) });
  }}>
    <label className="flex min-h-11 items-center justify-between gap-3 text-xs font-semibold text-muted">Màu đèn<span className="flex items-center gap-2"><span className="text-xs font-medium uppercase text-muted">{color}</span><input className="twin-color-control" type="color" aria-label="Chọn màu đèn" disabled={disabled} value={color} onChange={(event) => setColor(event.target.value)} /></span></label>
    <TwinLayoutButton disabled={disabled} type="submit">Áp dụng màu đèn</TwinLayoutButton>
  </form>;
}

function StateControl({ disabled, onExecute }: ControlProps) {
  const [value, setValue] = useState('{}');
  let parameters: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parameters = parsed as Record<string, unknown>;
  } catch { /* Invalid draft stays local until the user completes the object. */ }
  return <details className="rounded-xl bg-app p-3"><summary className="cursor-pointer text-xs font-semibold text-muted">Trạng thái nâng cao</summary>
    <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); if (!disabled && parameters) onExecute('SET_STATE', parameters); }}>
      <label className="block text-xs text-muted">Trạng thái (JSON object)<textarea disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-sm text-text" /></label>
      {!parameters ? <p role="status" className="text-xs text-error">Nhập một JSON object hợp lệ.</p> : null}
      <TwinLayoutButton type="submit" disabled={disabled || !parameters}>Đặt trạng thái</TwinLayoutButton>
    </form>
  </details>;
}

/** Only renders actions declared by HESTA; form edits never change device state. */
export function TwinDeviceControls({ actions, currentValues, color, disabled, onExecute }: ControlProps & {
  actions: readonly string[]; currentValues: Record<string, unknown>; color: string;
}) {
  const colorAction = actions.includes('SET_COLOR') ? 'SET_COLOR' : actions.includes('SET_RGB') ? 'SET_RGB' : null;
  const interlock = getApertureInterlock(currentValues.state);
  const values = [...actionOptions, fanOption].filter((option) => actions.includes(option.code)
    && ['percentage', 'number', 'text'].includes(option.valueKind));
  return <>
    {values.map((option) => {
      const initialValue = option.code === 'SET_BRIGHTNESS' ? currentValues.brightness ?? currentValues.level : option.parameterKey ? currentValues[option.parameterKey] : undefined;
      return <ValueControl key={`${option.code}:${String(initialValue)}`} option={option} initialValue={initialValue} disabled={disabled} onExecute={onExecute} />;
    })}
    {colorAction ? <ColorControl key={`${colorAction}:${color}`} action={colorAction} initialValue={color} disabled={disabled} onExecute={onExecute} /> : null}
    <div className="flex flex-wrap gap-2">{actionOptions.filter((option) => actions.includes(option.code)
      && option.valueKind === 'none' && !['TURN_ON', 'TURN_OFF'].includes(option.code)).map((option) => {
      const actionLocked =
        (option.code === 'OPEN' && interlock.disableOpen) ||
        (option.code === 'CLOSE' && interlock.disableClose) ||
        (option.code === 'STOP' && interlock.disableStop);
      return <TwinLayoutButton key={option.code} disabled={disabled || actionLocked} onClick={() => onExecute(option.code)}>{option.label}</TwinLayoutButton>;
    })}</div>
    {actions.includes('SET_STATE') ? <StateControl disabled={disabled} onExecute={onExecute} /> : null}
  </>;
}
