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
  lastPingAt?: string;
  lastTrippedAt?: string;
}
