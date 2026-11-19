export interface EnergySummary {
  totalKwh: number;
  estimatedCostVnd: number;
  currentTier: number;
  projectedMonthKwh: number;
  projectedMonthCostVnd: number;
  comparisonLastPeriodPercent: number;
  period: string;
  activeDeviceCount: number;
  totalDeviceCount: number;
}

export interface EnergyTimeSeriesPoint {
  timestamp: string;
  label: string;
  kwh: number;
  costVnd: number;
}

export interface DeviceEnergyBreakdown {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  roomName: string;
  kwh: number;
  percentage: number;
  costVnd: number;
  totalOnHours: number;
  wattage: number;
  energyKwh?: number;
  estimatedCostVnd?: number;
  ratedPowerWatts?: number;
  runtimeHours?: number;
}

export interface EnergyAnalyticsResponse {
  summary: EnergySummary;
  timeSeries: EnergyTimeSeriesPoint[];
  breakdown: DeviceEnergyBreakdown[];
}

export interface DemandResponseSettings {
  homeId: string;
  enabled: boolean;
  peakThresholdWatts: number;
  mode: 'AUTO_SHED' | 'ALERT_ONLY';
  updatedAt?: string;
}

export interface DemandResponseEvaluationResult {
  homeId: string;
  totalCurrentWatts: number;
  peakThresholdWatts: number;
  excessWatts: number;
  status: 'NORMAL' | 'WARNING_THRESHOLD' | 'PEAK_SHEDDING_EXECUTED';
  sheddedDevices: string[];
  wattsSaved: number;
  message: string;
  evaluatedAt: string;
}
