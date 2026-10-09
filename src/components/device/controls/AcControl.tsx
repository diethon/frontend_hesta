import React, { useState, useEffect } from 'react';
import { Power, Minus, Plus, Wind, Thermometer, Droplets, Sun as SunIcon, RefreshCcw } from 'lucide-react';
import type { DeviceResponse } from '../../../types/device';
import { 
  setAcPower, 
  adjustAcTempUp, 
  adjustAcTempDown, 
  setAcMode, 
  setAcFan, 
  setAcSwing 
} from '../../../services/deviceApi';

export interface AcControlProps {
  device: DeviceResponse;
  onStateChange?: (device: DeviceResponse) => void;
}

const MODES = [
  { value: 'AUTO', label: 'TỰ ĐỘNG', icon: RefreshCcw },
  { value: 'COOL', label: 'LÀM LẠNH', icon: Wind },
  { value: 'DRY', label: 'HÚT ẨM', icon: Droplets },
  { value: 'HEAT', label: 'SƯỞI ẤM', icon: SunIcon },
];

const FAN_SPEEDS = [
  { value: 'AUTO', label: 'TỰ ĐỘNG' },
  { value: 'LOW', label: 'THẤP' },
  { value: 'MID', label: 'TRUNG' },
  { value: 'HIGH', label: 'CAO' },
];

export const AcControl: React.FC<AcControlProps> = ({ device, onStateChange }) => {
  const isOnline = device.status === 'ONLINE';
  
  // Local state for optimistic updates
  const [power, setPower] = useState<boolean>(device.currentState?.power === 'ON');
  const [temperature, setTemp] = useState<number>(Number(device.currentState?.temperature) || 24);
  const [mode, setModeState] = useState<string>(String(device.currentState?.mode || 'COOL'));
  const [fan, setFanState] = useState<string>(String(device.currentState?.fan || 'AUTO'));
  const [swing, setSwingState] = useState<boolean>(device.currentState?.swing === true || device.currentState?.swing === 'ON');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setPower(device.currentState?.power === 'ON');
    if (device.currentState?.temperature) setTemp(Number(device.currentState.temperature));
    if (device.currentState?.mode) setModeState(String(device.currentState.mode));
    if (device.currentState?.fan) setFanState(String(device.currentState.fan));
    setSwingState(device.currentState?.swing === true || device.currentState?.swing === 'ON');
  }, [device.currentState]);

  const handlePower = async () => {
    if (!isOnline || isPending) return;
    setIsPending(true);
    const newPower = !power;
    setPower(newPower);
    try {
      await setAcPower(device.id, newPower);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setPower(!newPower); // revert
    } finally {
      setIsPending(false);
    }
  };

  const handleTempUp = async () => {
    if (!isOnline || !power || isPending || temperature >= 30) return;
    setIsPending(true);
    const newTemp = temperature + 1;
    setTemp(newTemp);
    try {
      await adjustAcTempUp(device.id);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setTemp(newTemp - 1); // revert
    } finally {
      setIsPending(false);
    }
  };

  const handleTempDown = async () => {
    if (!isOnline || !power || isPending || temperature <= 16) return;
    setIsPending(true);
    const newTemp = temperature - 1;
    setTemp(newTemp);
    try {
      await adjustAcTempDown(device.id);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setTemp(newTemp + 1); // revert
    } finally {
      setIsPending(false);
    }
  };

  const handleSetMode = async (newMode: string) => {
    if (!isOnline || !power || isPending || mode === newMode) return;
    setIsPending(true);
    const oldMode = mode;
    setModeState(newMode);
    try {
      await setAcMode(device.id, newMode);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setModeState(oldMode);
    } finally {
      setIsPending(false);
    }
  };

  const handleSetFan = async (newFan: string) => {
    if (!isOnline || !power || isPending || fan === newFan) return;
    setIsPending(true);
    const oldFan = fan;
    setFanState(newFan);
    try {
      await setAcFan(device.id, newFan);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setFanState(oldFan);
    } finally {
      setIsPending(false);
    }
  };

  const handleSwing = async () => {
    if (!isOnline || !power || isPending) return;
    setIsPending(true);
    const newSwing = !swing;
    setSwingState(newSwing);
    try {
      await setAcSwing(device.id, newSwing);
      if (onStateChange) onStateChange(device);
    } catch (e) {
      setSwingState(!newSwing);
    } finally {
      setIsPending(false);
    }
  };

  // Theming based on mode
  const isHeating = mode === 'HEAT';
  const activeColorClass = isHeating ? 'text-warning bg-warning-soft' : 'text-primary bg-info-soft';
  const buttonActiveBg = isHeating ? 'bg-warning text-white' : 'bg-primary text-white';

  return (
    <div className="flex flex-col p-6 space-y-8 bg-surface rounded-2xl border border-line">
      {/* Header: Power Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Thermometer className="w-5 h-5 text-muted" />
          <span className="font-semibold text-text">Điều Hòa</span>
        </div>
        <button
          disabled={!isOnline || isPending}
          onClick={handlePower}
          className={`p-3 rounded-full transition-all ${
            power ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-sidebar border border-line text-icon'
          } ${(!isOnline || isPending) ? 'opacity-50' : 'hover:scale-105'}`}
        >
          <Power className="w-6 h-6" />
        </button>
      </div>

      {/* Temperature Display */}
      <div className="flex items-center justify-center space-x-6">
        <button
          disabled={!isOnline || !power || temperature <= 16 || isPending}
          onClick={handleTempDown}
          className="p-4 rounded-full bg-sidebar text-muted hover:bg-line transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="w-6 h-6" />
        </button>
        <div className={`flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 ${power ? activeColorClass : 'border-line text-muted bg-surface'}`}>
          <span className="text-4xl font-bold">{power ? temperature : '--'}°C</span>
        </div>
        <button
          disabled={!isOnline || !power || temperature >= 30 || isPending}
          onClick={handleTempUp}
          className="p-4 rounded-full bg-sidebar text-muted hover:bg-line transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Mode Selection */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted uppercase tracking-wider">Chế độ</span>
        <div className="flex space-x-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              disabled={!isOnline || !power || isPending}
              onClick={() => handleSetMode(m.value)}
              className={`flex-1 py-2 flex flex-col items-center space-y-1 rounded-xl border transition-all ${
                mode === m.value && power
                  ? `${buttonActiveBg} border-transparent shadow-sm`
                  : 'bg-surface border-line text-muted hover:bg-sidebar'
              } ${(!isOnline || !power || isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <m.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fan Speed */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted uppercase tracking-wider">Quạt</span>
        <div className="flex space-x-2">
          {FAN_SPEEDS.map((f) => (
            <button
              key={f.value}
              disabled={!isOnline || !power || isPending}
              onClick={() => handleSetFan(f.value)}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                fan === f.value && power
                  ? 'bg-muted text-white border-transparent'
                  : 'bg-surface border-line text-muted hover:bg-sidebar'
              } ${(!isOnline || !power || isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Swing Toggle */}
      <div className="flex items-center justify-between p-4 bg-sidebar rounded-xl">
        <span className="font-medium text-text">Đảo Gió</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={swing}
            disabled={!isOnline || !power || isPending}
            onChange={handleSwing}
          />
          <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 disabled:opacity-50"></div>
        </label>
      </div>
    </div>
  );
};
