import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, FileText } from 'lucide-react';
import { listMyContracts } from '../../services/contractApi';
import type { ContractSummary } from '../../types/contract';
import { CONTRACT_STATUS_META, formatVnd } from './contractFormat';

export const ActiveContractBanner: React.FC = () => {
  const navigate = useNavigate();
  const [activeContract, setActiveContract] = useState<ContractSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    listMyContracts()
      .then((rows) => {
        if (!mounted) return;
        const ongoing = rows.find(
          (c) => c.status !== 'HANDED_OVER' && c.status !== 'CANCELLED'
        );
        setActiveContract(ongoing ?? null);
      })
      .catch(() => {
        // Non-blocking banner
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!activeContract) return null;

  const meta = CONTRACT_STATUS_META[activeContract.status];

  return (
    <div className="col-span-full rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text">
              Hợp đồng lắp đặt <span className="font-mono">{activeContract.code}</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-muted truncate mt-0.5">
            {activeContract.homeName || 'Nhà HESTA'} · Giá trị {formatVnd(activeContract.totalAmount)} · Bấm để theo dõi, ký hợp đồng hoặc xác nhận đặt cọc.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/contracts/${activeContract.id}`)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer shrink-0"
      >
        Mở hồ sơ hợp đồng
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
