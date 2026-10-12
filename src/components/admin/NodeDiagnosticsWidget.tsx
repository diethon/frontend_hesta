import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Send,
  AlertTriangle,
  Server,
  Zap
} from 'lucide-react';
import type { DiagnosticsSummary, NodeDiagnostics } from '../../types/diagnostics';
import {
  getDiagnosticsSummary,
  getNodeDiagnostics,
  resetNodeCircuitBreaker,
  pingNode
} from '../../services/diagnosticsApi';
import { notify } from '../ui/notify';

export const NodeDiagnosticsWidget: React.FC = () => {
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [nodes, setNodes] = useState<NodeDiagnostics[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sumRes, nodeRes] = await Promise.all([
        getDiagnosticsSummary(),
        getNodeDiagnostics()
      ]);
      setSummary(sumRes);
      setNodes(nodeRes);
    } catch (e) {
      console.error('Failed to load diagnostics', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async (nodeId: string, nodeCode: string) => {
    setPingingId(nodeId);
    try {
      const updated = await pingNode(nodeId);
      setNodes((prev) => prev.map((n) => (n.nodeId === nodeId ? updated : n)));
      notify(`Ping ${nodeCode}: ${updated.averageLatencyMs}ms (Thành công)`, 'success');
    } catch {
      notify(`Lỗi ping đến ${nodeCode}`, 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleResetCircuit = async (nodeId: string, nodeCode: string) => {
    setResettingId(nodeId);
    try {
      const updated = await resetNodeCircuitBreaker(nodeId);
      setNodes((prev) => prev.map((n) => (n.nodeId === nodeId ? updated : n)));
      notify(`Đã khôi phục Circuit Breaker cho ${nodeCode} về CLOSED`, 'success');
      fetchData();
    } catch {
      notify(`Lỗi khôi phục circuit breaker cho ${nodeCode}`, 'error');
    } finally {
      setResettingId(null);
    }
  };

  const getCircuitBadge = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            CLOSED (Ổn định)
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            OPEN (Cách ly)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            HALF_OPEN (Thăm dò)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Broker Status */}
        <div className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-primary">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">MQTT Broker</span>
            <div className="w-9 h-9 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-text">
              {summary?.brokerConnected ? 'CONNECTED' : 'STANDBY'}
            </h3>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-muted mt-1 truncate" title={summary?.brokerUrl}>
            {summary?.brokerUrl || 'tcp://broker:1883'}
          </p>
        </div>

        {/* Card 2: Edge Nodes Online/Total */}
        <div className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-primary">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">ESP32 Edge Nodes</span>
            <div className="w-9 h-9 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-text">
              {summary ? `${summary.onlineNodes} / ${summary.totalNodes}` : '...'}
            </h3>
            <span className="text-xs font-semibold text-emerald-600">Trực tuyến</span>
          </div>
          <p className="text-xs text-muted mt-1">
            {summary?.offlineNodes ?? 0} node ngoại tuyến
          </p>
        </div>

        {/* Card 3: Circuit Breaker Quarantined */}
        <div className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-warning">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Circuit Breakers</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              (summary?.quarantinedNodes ?? 0) > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-2xl font-bold ${
              (summary?.quarantinedNodes ?? 0) > 0 ? 'text-rose-600' : 'text-text'
            }`}>
              {summary?.quarantinedNodes ?? 0}
            </h3>
            <span className="text-xs font-semibold text-muted">Node bị cách ly</span>
          </div>
          <p className="text-xs text-muted mt-1">
            {(summary?.quarantinedNodes ?? 0) === 0 ? 'Tất cả mạch thông suốt' : 'Cần kiểm tra phần cứng'}
          </p>
        </div>

        {/* Card 4: Network Reliability & Latency */}
        <div className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-primary">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Độ Tin Cậy Mạng</span>
            <div className="w-9 h-9 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-text">
              {summary ? `${summary.systemReliabilityPct}%` : '99.4%'}
            </h3>
            <span className="text-xs font-semibold text-muted">~{summary?.averageLatencyMs ?? 28}ms</span>
          </div>
          <p className="text-xs text-muted mt-1">Độ trễ trung bình RTT</p>
        </div>
      </div>

      {/* ── Detailed Edge Nodes Monitor Table ── */}
      <div className="surface-card p-5 sm:p-6 rounded-2xl border border-line shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Giám Sát Sức Khỏe Phần Cứng &amp; Mạch Bảo Vệ (Circuit Breaker)
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Tự động cách ly node mất gói tin liên tiếp để chống nghẽn đường truyền; hỗ trợ Ping và Reset mạch trực tiếp.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-line bg-surface hover:bg-off-soft text-text transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-muted uppercase text-[11px] font-bold bg-off-soft/40">
                <th className="py-3 px-3">Node Code</th>
                <th className="py-3 px-3">Nhà sở hữu</th>
                <th className="py-3 px-3">Trạng thái kết nối</th>
                <th className="py-3 px-3">Trạng thái Mạch (Circuit)</th>
                <th className="py-3 px-3 text-center">Độ trễ RTT</th>
                <th className="py-3 px-3 text-center">Lệnh thành công</th>
                <th className="py-3 px-3 text-right">Thao tác Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    {loading ? 'Đang tải dữ liệu node...' : 'Chưa có node phần cứng nào trong hệ thống'}
                  </td>
                </tr>
              ) : (
                nodes.map((node) => {
                  const isPinging = pingingId === node.nodeId;
                  const isResetting = resettingId === node.nodeId;

                  return (
                    <tr key={node.nodeId} className="hover:bg-off-soft/30 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-text">
                        {node.nodeCode}
                      </td>
                      <td className="py-3.5 px-3 text-muted">
                        {node.homeName || 'N/A'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${
                          node.status === 'ONLINE' ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            node.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                          }`} />
                          {node.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {getCircuitBadge(node.circuitState)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                          node.averageLatencyMs < 40
                            ? 'text-emerald-700 bg-emerald-50'
                            : node.averageLatencyMs < 90
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}>
                          {node.averageLatencyMs} ms
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-text">
                        {node.successfulCommands}/{node.totalCommands}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            disabled={isPinging}
                            onClick={() => handlePing(node.nodeId, node.nodeCode)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-line bg-surface hover:bg-primary hover:text-white text-text transition-colors shadow-xs disabled:opacity-50"
                            title="Gửi gói tin ping kiểm tra kết nối MQTT thực tế"
                          >
                            <Send className={`w-3 h-3 ${isPinging ? 'animate-bounce' : ''}`} />
                            Ping
                          </button>

                          {node.circuitState !== 'CLOSED' && (
                            <button
                              type="button"
                              disabled={isResetting}
                              onClick={() => handleResetCircuit(node.nodeId, node.nodeCode)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors shadow-xs disabled:opacity-50"
                              title="Khôi phục trạng thái mạch về CLOSED"
                            >
                              <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
