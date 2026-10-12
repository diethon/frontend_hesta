export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface DiagnosticsSummary {
  brokerConnected: boolean;
  brokerUrl: string;
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  quarantinedNodes: number;
  systemReliabilityPct: number;
  averageLatencyMs: number;
}

export interface NodeDiagnostics {
  nodeId: string;
  nodeCode: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  homeId?: string;
  homeName?: string;
  circuitState: CircuitState;
  consecutiveFailures: number;
  totalCommands: number;
  successfulCommands: number;
  averageLatencyMs: number;
  p95LatencyMs?: number;
  latencyMetrics?: LatencyMetrics;
  lastPingAt?: string;
  lastTrippedAt?: string;
}

export interface LatencyMetrics {
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface MqttPacket {
  id: string;
  timestamp: string;
  topic: string;
  direction: 'INBOUND' | 'OUTBOUND';
  qos: number;
  payloadSummary: string;
}
