export interface Recommendation {
  id: string;
  homeId: string;
  deviceId: string | null;
  deviceName: string | null;
  triggerCondition: {
    type: string;
    time: string;
    repeatDays: number[];
    patternType?: string;
  };
  proposedAction: {
    deviceId: string;
    action: string;
    parameters: Record<string, unknown>;
  };
  explanation: string;
  confidence: number;
  status: 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'DISMISSED';
  engineType?: 'ML' | 'RULE_BASED';
  modelVersion?: string;
  eligible?: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MlModelStatus {
  status: 'READY' | 'COLD_START' | 'NOT_TRAINED' | 'TRAINING' | 'UNAVAILABLE' | 'ERROR';
  version: string;
  modelType: string;
  trainedAt?: string;
  trainSamples?: number;
  testSamples?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  baselineAccuracy?: number;
  baselineF1?: number;
  confidenceThreshold: number;
  calibrated?: boolean;
  labelDistribution?: Record<string, number>;
  metrics?: Record<string, unknown>;
}
