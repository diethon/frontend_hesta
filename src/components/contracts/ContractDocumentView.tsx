import React from 'react';
import { Building2, CheckCircle2, Copy, Printer, ShieldCheck } from 'lucide-react';
import type { ContractDetail } from '../../types/contract';
import { formatDateOnly, formatDateTime, formatVnd, HOME_TYPE_LABELS } from './contractFormat';
import { notify } from '../ui/notify';

interface ContractDocumentViewProps {
  contract: ContractDetail;
  showPrintButton?: boolean;
}

/**
 * Văn bản Hợp đồng điện tử chuẩn A4.
 * Dùng mã màu hex tường minh để không bị đảo ngược bởi theme override (--color-slate-900: #ffffff) trong index.css.
 */
export const ContractDocumentView: React.FC<ContractDocumentViewProps> = ({
  contract,
  showPrintButton = true,
}) => {
  const copyText = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text);
    notify.success(`Đã sao chép ${label}`, '');
  };

  const transferNote = contract.depositTransferNote || `HESTA COC ${contract.code}`;

  return (
    <div className="contract-print-sheet rounded-3xl border border-[#cbd5e1] bg-[#ffffff] text-[#0f172a] shadow-sm overflow-hidden">
      {/* Toolbar (hidden in print) */}
      {showPrintButton && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-2 px-6 py-3 bg-[#f1f5f9] border-b border-[#cbd5e1]">
          <div className="flex items-center gap-2 text-xs text-[#334155]">
            <ShieldCheck className="w-4 h-4 text-[#0284c7]" />
            <span>
              Văn bản Hợp đồng điện tử · Mã <strong className="font-mono text-[#0f172a]">{contract.code}</strong> · Phiên bản <strong className="text-[#0f172a]">v{contract.contractVersion}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0f172a] text-[#ffffff] text-xs font-semibold hover:bg-[#1e293b] transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            In / Lưu PDF (A4)
          </button>
        </div>
      )}

      {/* A4 Document Body */}
      <div className="p-6 sm:p-10 space-y-6 text-sm leading-relaxed text-[#1e293b]">
        {/* Quốc hiệu - Tiêu ngữ */}
        <div className="text-center space-y-1 border-b border-[#cbd5e1] pb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0f172a]">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </p>
          <p className="text-xs font-semibold text-[#334155] underline underline-offset-4">
            Độc lập – Tự do – Hạnh phúc
          </p>
          <h2 className="pt-4 text-lg sm:text-xl font-extrabold uppercase tracking-tight text-[#0f172a]">
            {contract.termsTitle || 'HỢP ĐỒNG CUNG CẤP VÀ LẮP ĐẶT HỆ THỐNG NHÀ THÔNG MINH HESTA'}
          </h2>
          <p className="text-xs text-[#475569] font-mono">
            Số: {contract.code} / HESTA-HD · Phiên bản v{contract.contractVersion} · Ngày lập: {formatDateOnly(contract.createdAt)}
          </p>
        </div>

        {/* Thông tin 2 bên */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0369a1] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Bên A · Bên cung cấp &amp; lắp đặt
            </p>
            <p className="font-bold text-[#0f172a]">{contract.providerInfo.providerCompanyName}</p>
            <p className="text-xs text-[#334155]">
              MST: <span className="font-mono font-semibold text-[#0f172a]">{contract.providerInfo.providerTaxCode}</span>
            </p>
            <p className="text-xs text-[#334155]">Địa chỉ: {contract.providerInfo.providerAddress}</p>
            <p className="text-xs text-[#334155]">Đại diện: {contract.providerInfo.providerRepresentative}</p>
            <p className="text-xs text-[#334155]">
              Hotline: {contract.providerInfo.providerHotline} · {contract.providerInfo.providerEmail}
            </p>
          </div>

          <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#047857]">
              Bên B · Khách hàng (Chủ đầu tư)
            </p>
            <p className="font-bold text-[#0f172a]">{contract.customerName}</p>
            <p className="text-xs text-[#334155]">
              Điện thoại: <span className="font-mono font-semibold text-[#0f172a]">{contract.customerPhone}</span>
            </p>
            <p className="text-xs text-[#334155]">Email: {contract.customerEmail}</p>
            <p className="text-xs text-[#334155]">
              Công trình: {contract.homeName || 'Nhà thông minh HESTA'} ({HOME_TYPE_LABELS[contract.homeType] || contract.homeType})
            </p>
            <p className="text-xs text-[#334155]">Địa chỉ lắp đặt: {contract.installAddress}</p>
          </div>
        </div>

        {/* Bảng kê thiết bị */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0f172a]">
            I. Bảng kê thiết bị và dự toán giá trị hợp đồng
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-[#cbd5e1]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0f172a] text-[#ffffff]">
                  <th className="py-2.5 px-3 font-bold w-10">#</th>
                  <th className="py-2.5 px-3 font-bold">Tên thiết bị &amp; Mã Model</th>
                  <th className="py-2.5 px-3 font-bold">Vị trí phòng</th>
                  <th className="py-2.5 px-3 font-bold text-center">SL</th>
                  <th className="py-2.5 px-3 font-bold text-right">Đơn giá</th>
                  <th className="py-2.5 px-3 font-bold text-right">Thành tiền</th>
                  <th className="py-2.5 px-3 font-bold text-center">Bảo hành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] bg-[#ffffff]">
                {contract.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#64748b] italic">
                      Danh sách thiết bị sẽ được HESTA cập nhật chi tiết trong bản báo giá.
                    </td>
                  </tr>
                ) : (
                  contract.items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 px-3 text-[#475569] font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-[#0f172a]">{item.deviceName}</p>
                        {item.modelCode && (
                          <p className="text-[11px] font-mono text-[#475569]">{item.modelCode}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#1e293b]">{item.roomLabel || 'Phòng khách'}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-[#0f172a]">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#1e293b]">{formatVnd(item.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0f172a]">
                        {formatVnd(item.lineTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#334155]">{item.warrantyMonths} tháng</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Tổng kết tài chính */}
          <div className="flex justify-end">
            <div className="w-full sm:w-96 rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#334155]">
                <span>Tạm tính thiết bị</span>
                <span className="font-mono font-semibold text-[#0f172a]">{formatVnd(contract.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#334155]">
                <span>Phí thi công, cấu hình &amp; bàn giao</span>
                <span className="font-mono font-semibold text-[#0f172a]">{formatVnd(contract.installationFee)}</span>
              </div>
              {contract.discountAmount > 0 && (
                <div className="flex justify-between text-[#047857]">
                  <span>Ưu đãi / Chiết khấu</span>
                  <span className="font-mono font-semibold">- {formatVnd(contract.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-[#cbd5e1] pt-2 mt-1 flex justify-between text-sm font-extrabold text-[#0f172a]">
                <span>Tổng giá trị hợp đồng</span>
                <span className="font-mono text-[#0369a1]">{formatVnd(contract.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#1e293b] pt-1">
                <span>Đợt 1 · Đặt cọc ({contract.depositPercent}%)</span>
                <span className="font-mono font-bold text-[#b45309]">{formatVnd(contract.depositAmount)}</span>
              </div>
              <div className="flex justify-between text-[#475569]">
                <span>Đợt 2 · Thanh toán khi bàn giao</span>
                <span className="font-mono font-semibold text-[#1e293b]">{formatVnd(contract.remainingAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thông tin chuyển khoản đặt cọc & Lịch lắp đặt */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#fcd34d] bg-[#fffbeb] p-4 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#92400e]">
              II. Thông tin chuyển khoản đặt cọc (Bên A)
            </p>
            <div className="space-y-1 text-xs text-[#1e293b]">
              <p>Ngân hàng: <strong className="text-[#0f172a]">{contract.providerInfo.bankName}</strong></p>
              <div className="flex items-center justify-between gap-2">
                <span>
                  Số tài khoản: <strong className="font-mono text-sm text-[#0f172a]">{contract.providerInfo.bankAccountNumber}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(contract.providerInfo.bankAccountNumber, 'số tài khoản')}
                  className="print:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#f59e0b] bg-[#ffffff] text-[11px] font-semibold text-[#92400e] hover:bg-[#fef3c7] cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Chép
                </button>
              </div>
              <p>Chủ tài khoản: <strong className="text-[#0f172a]">{contract.providerInfo.bankAccountHolder}</strong></p>
              <p>
                Số tiền đặt cọc ({contract.depositPercent}%): <strong className="font-mono text-[#92400e]">{formatVnd(contract.depositAmount)}</strong>
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span>
                  Nội dung CK:{' '}
                  <strong className="font-mono bg-[#ffffff] text-[#0f172a] px-2 py-0.5 rounded border border-[#f59e0b]">
                    {transferNote}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(transferNote, 'nội dung chuyển khoản')}
                  className="print:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#f59e0b] bg-[#ffffff] text-[11px] font-semibold text-[#92400e] hover:bg-[#fef3c7] cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Chép
                </button>
              </div>
            </div>
            {contract.depositVerifiedAt && (
              <div className="pt-2 border-t border-[#fcd34d] text-xs text-[#065f46] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                Đã đối soát nhận cọc {formatVnd(contract.depositVerifiedAmount ?? contract.depositAmount)} lúc {formatDateTime(contract.depositVerifiedAt)}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#0f172a]">
              III. Lịch thi công &amp; Lắp đặt dự kiến
            </p>
            <div className="space-y-1 text-xs text-[#334155]">
              <p>
                Thời gian bắt đầu: <strong className="text-[#0f172a]">{formatDateTime(contract.scheduledInstallStart || contract.preferredInstallDate)}</strong>
              </p>
              {contract.scheduledInstallEnd && (
                <p>
                  Dự kiến hoàn thành: <strong className="text-[#0f172a]">{formatDateTime(contract.scheduledInstallEnd)}</strong>
                </p>
              )}
              <p>
                Địa điểm thi công: <strong className="text-[#0f172a]">{contract.installAddress}</strong>
              </p>
              {contract.handedOverAt && (
                <p className="pt-2 text-[#047857] font-semibold">
                  ✓ Đã hoàn tất bàn giao ngôi nhà &amp; thiết bị lúc {formatDateTime(contract.handedOverAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Điều khoản hợp đồng */}
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0f172a]">
            IV. Các điều khoản thỏa thuận
          </h3>
          <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 sm:p-5 whitespace-pre-line text-xs leading-6 text-[#1e293b]">
            {contract.termsContent}
          </div>
          {contract.specialTerms && (
            <div className="rounded-2xl border border-[#7dd3fc] bg-[#f0f9ff] p-4 text-xs text-[#0f172a] space-y-1">
              <p className="font-bold text-[#0369a1]">Điều khoản thỏa thuận bổ sung riêng:</p>
              <p className="whitespace-pre-line">{contract.specialTerms}</p>
            </div>
          )}
        </div>

        {/* Phụ lục thiết bị đã bàn giao */}
        {contract.provisionedDevices.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#065f46]">
              V. Phụ lục thiết bị đã bàn giao trực tiếp &amp; Thời hạn bảo hành
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-[#6ee7b7]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#ecfdf5] text-[#065f46] border-b border-[#6ee7b7]">
                    <th className="py-2 px-3 font-bold">Thiết bị</th>
                    <th className="py-2 px-3 font-bold">Phòng</th>
                    <th className="py-2 px-3 font-bold">Số sê-ri</th>
                    <th className="py-2 px-3 font-bold">Hạn bảo hành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1fae5] bg-[#ffffff]">
                  {contract.provisionedDevices.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 px-3 font-semibold text-[#0f172a]">{d.deviceName}</td>
                      <td className="py-2 px-3 text-[#334155]">{d.roomName || '—'}</td>
                      <td className="py-2 px-3 font-mono text-[#475569]">{d.serialNumber || '—'}</td>
                      <td className="py-2 px-3 text-[#065f46] font-medium">
                        {d.warrantyMonths} tháng (đến {formatDateOnly(d.warrantyExpiresAt)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chữ ký 2 bên */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#cbd5e1]">
          <div className="text-center space-y-2">
            <p className="text-xs font-bold uppercase text-[#0f172a]">ĐẠI DIỆN BÊN A (HESTA)</p>
            <p className="text-[11px] text-[#475569]">Ký và xác nhận điện tử</p>
            <div className="h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#38bdf8] bg-[#f0f9ff] px-3">
              {contract.adminSignedAt ? (
                <>
                  <span className="text-xs font-extrabold tracking-widest uppercase text-[#0369a1] border-2 border-[#0284c7] rounded-lg px-3 py-1">
                    HESTA VERIFIED
                  </span>
                  <span className="text-[11px] text-[#334155] mt-1.5">
                    {contract.adminSignedName || 'Quản trị viên HESTA'} · {formatDateOnly(contract.adminSignedAt)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#64748b] italic">Chờ gửi bản thảo chính thức</span>
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs font-bold uppercase text-[#0f172a]">ĐẠI DIỆN BÊN B (KHÁCH HÀNG)</p>
            <p className="text-[11px] text-[#475569]">Xác nhận đồng ý điều khoản &amp; ký điện tử</p>
            <div className="h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#94a3b8] bg-[#f8fafc] px-3 overflow-hidden">
              {contract.userSignedAt && contract.userSignatureData ? (
                <>
                  <img
                    src={contract.userSignatureData}
                    alt="Chữ ký điện tử khách hàng"
                    className="max-h-14 object-contain"
                  />
                  <span className="text-[11px] font-semibold text-[#0f172a]">
                    {contract.userSignatureName} · {formatDateTime(contract.userSignedAt)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#64748b] italic">Chưa ký xác nhận</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
