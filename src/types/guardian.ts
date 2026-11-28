export type GuardianStatus = 'IDLE' | 'COUNTDOWN' | 'WARNING' | 'LOCKED_OUT';

export interface GuardianTargetDevice {
  id: string;
  name: string;
  deviceType?: string | null;
}

export interface ParentalGuardianRule {
  id: string;
  homeId: string;
  targetDevices: GuardianTargetDevice[];
  cameraDeviceId?: string | null;
  cameraDeviceName?: string | null;
  name: string;
  enabled: boolean;
  parentAway: boolean;
  allowedDurationMinutes: number;
  warningMinutesBefore: number;
  status: GuardianStatus;
  sessionStartedAt?: string | null;
  sessionExpiresAt?: string | null;
  remainingSeconds: number;
  autoLockout: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParentalGuardianLog {
  id: string;
  ruleId: string;
  homeId: string;
  eventType: string;
  message: string;
  recordedAt: string;
}

export interface CreateGuardianRuleInput {
  name: string;
  targetDeviceIds: string[];
  cameraDeviceId?: string;
  allowedDurationMinutes: number;
  warningMinutesBefore: number;
  autoLockout: boolean;
}

export interface UpdateGuardianRuleInput extends CreateGuardianRuleInput {
  enabled: boolean;
}
