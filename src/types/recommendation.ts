export interface Recommendation {
  id: string;
  homeId: string;
  deviceId: string | null;
  deviceName: string | null;
  triggerCondition: { type: string; time: string; repeatDays: number[] };
  proposedAction: { deviceId: string; action: string; parameters: Record<string, unknown> };
  explanation: string;
  confidence: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  resolvedAt: string | null;
}
