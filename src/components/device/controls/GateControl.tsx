import React, { useEffect, useRef, useState } from 'react';
import { DoorOpen, Hand, DoorClosed, Loader2 } from 'lucide-react';
import type { DeviceResponse } from '../../../types/device';
import { openGate, closeGate, stopGate } from '../../../services/deviceApi';
import { APERTURE_TRANSIT_LOCK_MS, getApertureInterlock } from '../deviceHelpers';

export interface GateControlProps {
  device: DeviceResponse;
  onStateChange?: (device: DeviceResponse) => void;
}

export const GateControl: React.FC<GateControlProps> = ({ device, onStateChange }) => {
  const isOnline = device.status === 'ONLINE';
  const isViewOnly = device.accessLevel === 'VIEW';

  const currentStateStr = String(device.currentState?.state || 'STOPPED').toUpperCase();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [transitLocked, setTransitLocked] = useState(false);
  const transitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentStateStr === 'OPEN' || currentStateStr === 'CLOSED' || currentStateStr === 'STOPPED') {
      if (transitTimerRef.current) {
        clearTimeout(transitTimerRef.current);
        transitTimerRef.current = null;
      }
      setTransitLocked(false);
    }
  }, [currentStateStr]);

  useEffect(() => () => {
    if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
  }, []);

  const interlock = getApertureInterlock(currentStateStr, transitLocked);

  const armTransitLock = () => {
    if (transitTimerRef.current) clearTimeout(transitTimerRef.current);
    setTransitLocked(true);
    transitTimerRef.current = setTimeout(() => {
      setTransitLocked(false);
      transitTimerRef.current = null;
    }, APERTURE_TRANSIT_LOCK_MS);
  };

  const handleAction = async (action: 'OPEN' | 'CLOSE' | 'STOP') => {
    if (!isOnline || isViewOnly || pendingAction) return;
    if (action === 'OPEN' && interlock.disableOpen) return;
    if (action === 'CLOSE' && interlock.disableClose) return;
    if (action === 'STOP' && interlock.disableStop) return;

    setPendingAction(action);
    try {
      if (action === 'OPEN') {
        await openGate(device.id, device.nodeId);
        armTransitLock();
        onStateChange?.({ ...device, currentState: { ...device.currentState, state: 'OPENING' } });
      } else if (action === 'CLOSE') {
        await closeGate(device.id, device.nodeId);
        armTransitLock();
        onStateChange?.({ ...device, currentState: { ...device.currentState, state: 'CLOSING' } });
      } else {
        await stopGate(device.id, device.nodeId);
        if (transitTimerRef.current) {
          clearTimeout(transitTimerRef.current);
          transitTimerRef.current = null;
        }
        setTransitLocked(false);
        onStateChange?.({ ...device, currentState: { ...device.currentState, state: 'STOPPED' } });
      }
    } catch (error) {
      console.error(`Failed to ${action} gate:`, error);
    } finally {
      setPendingAction(null);
    }
  };

  const getStatusColor = () => {
    switch (currentStateStr) {
      case 'OPEN':
      case 'OPENING':
        return 'text-success bg-success-soft border-success/30';
      case 'CLOSED':
      case 'CLOSING':
        return 'text-error bg-error-soft border-error/30';
      default:
        return 'text-warning bg-warning-soft border-warning/30';
    }
  };

  const getStatusText = () => {
    switch (currentStateStr) {
      case 'OPEN': return 'ĐANG MỞ';
      case 'OPENING': return 'ĐANG MỞ RA...';
      case 'CLOSED': return 'ĐÃ ĐÓNG';
      case 'CLOSING': return 'ĐANG ĐÓNG LẠI...';
      case 'STOPPED': return 'ĐÃ DỪNG';
      default: return 'KHÔNG RÕ';
    }
  };

  return (
    <div className="flex flex-col p-6 space-y-8 bg-surface rounded-2xl border border-line">
      {/* Status Indicator */}
      <div className="flex flex-col items-center justify-center space-y-2">
        <span className="text-sm font-medium text-muted">Trạng thái hiện tại</span>
        <div className={`px-6 py-2 rounded-full border font-bold tracking-wide ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center space-x-4">
        {/* OPEN BUTTON */}
        <button
          disabled={!isOnline || isViewOnly || pendingAction !== null || interlock.disableOpen}
          onClick={() => handleAction('OPEN')}
          className={`flex-1 flex flex-col items-center justify-center p-4 h-32 rounded-xl border-2 transition-all ${
            currentStateStr.includes('OPEN') && pendingAction !== 'OPEN'
              ? 'bg-success text-white border-transparent shadow-md shadow-success/30'
              : 'bg-surface border-success/20 text-success hover:bg-success-soft'
          } ${(!isOnline || isViewOnly || interlock.disableOpen || (pendingAction !== null && pendingAction !== 'OPEN')) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {pendingAction === 'OPEN' ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <DoorOpen className="w-10 h-10 mb-2" />
          )}
          <span className="font-bold">MỞ</span>
        </button>

        {/* STOP BUTTON */}
        <button
          disabled={!isOnline || isViewOnly || pendingAction !== null || interlock.disableStop}
          onClick={() => handleAction('STOP')}
          className={`flex-1 flex flex-col items-center justify-center p-4 h-32 rounded-xl border-2 transition-all ${
            currentStateStr === 'STOPPED' && pendingAction !== 'STOP'
              ? 'bg-warning text-white border-transparent shadow-md shadow-warning/30'
              : 'bg-surface border-warning/20 text-warning hover:bg-warning-soft'
          } ${(!isOnline || isViewOnly || interlock.disableStop || (pendingAction !== null && pendingAction !== 'STOP')) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {pendingAction === 'STOP' ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <Hand className="w-10 h-10 mb-2" />
          )}
          <span className="font-bold">DỪNG</span>
        </button>

        {/* CLOSE BUTTON */}
        <button
          disabled={!isOnline || isViewOnly || pendingAction !== null || interlock.disableClose}
          onClick={() => handleAction('CLOSE')}
          className={`flex-1 flex flex-col items-center justify-center p-4 h-32 rounded-xl border-2 transition-all ${
            currentStateStr.includes('CLOS') && pendingAction !== 'CLOSE'
              ? 'bg-error text-white border-transparent shadow-md shadow-error/30'
              : 'bg-surface border-error/20 text-error hover:bg-error-soft'
          } ${(!isOnline || isViewOnly || interlock.disableClose || (pendingAction !== null && pendingAction !== 'CLOSE')) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {pendingAction === 'CLOSE' ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <DoorClosed className="w-10 h-10 mb-2" />
          )}
          <span className="font-bold">ĐÓNG</span>
        </button>
      </div>
    </div>
  );
};
