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
