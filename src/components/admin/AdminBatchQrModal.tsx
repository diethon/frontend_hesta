import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Printer, Download, Sparkles, CheckCircle2, Copy, Check } from 'lucide-react';
import type { DeviceCatalog, DeviceBatchGenerateQrResponse, QrItem } from '../../types/deviceCatalog';
import { batchGenerateDeviceQr } from '../../services/deviceCatalogApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface AdminBatchQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  catalog: DeviceCatalog | null;
}

export const AdminBatchQrModal: React.FC<AdminBatchQrModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  catalog,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [customName, setCustomName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeviceBatchGenerateQrResponse | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Generate QR data URLs whenever result items change
  useEffect(() => {
    if (result?.items && result.items.length > 0) {
      const urlMap: Record<string, string> = {};
      const promises = result.items.map(async (item) => {
        try {
          const url = await QRCode.toDataURL(item.qr.payload, {
            width: 250,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          urlMap[item.device.id] = url;
        } catch (err) {
          console.error('Failed to generate QR for item', item.device.id, err);
        }
      });

      Promise.all(promises).then(() => {
        setQrDataUrls(urlMap);
      });
    }
  }, [result]);

  if (!isOpen || !catalog) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await batchGenerateDeviceQr({
        catalogId: catalog.id,
        quantity,
        customName: customName.trim() || undefined,
      });
      setResult(res);
      notify.success(`Đã tạo thành công ${res.generatedCount} mã QR thiết bị!`, '');
      onSuccess();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tạo mã QR'), '');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAll = () => {
    const printContent = printContainerRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=900,height=700');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tem In Mã QR HESTA - ${catalog.name}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 10px;
              background: #fff;
              color: #0f172a;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
              gap: 16px;
            }
            .badge {
              border: 2px solid #0f172a;
              border-radius: 14px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
              background: #fff;
            }
            .brand {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #0f172a;
              margin-bottom: 6px;
            }
            .qr-img {
              width: 170px;
              height: 170px;
              margin: 6px auto;
              display: block;
            }
            .title {
              font-size: 13px;
              font-weight: 700;
              margin: 4px 0 2px;
            }
            .meta {
              font-size: 11px;
              color: #475569;
              margin: 1px 0;
              font-family: monospace;
            }
            .footer {
              margin-top: 8px;
              font-size: 10px;
              font-weight: 800;
              color: #d97706;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadSingle = (item: QrItem) => {
    const dataUrl = qrDataUrls[item.device.id];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR-${item.device.serialNumber || 'hesta-device'}.png`;
    a.click();
  };

  const handleDownloadAll = () => {
    if (!result?.items) return;
    result.items.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 200);
    });
    notify.success(`Đang tải về ${result.items.length} file ảnh mã QR...`, '');
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    notify.success('Đã sao chép token vào clipboard', '');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const resetForm = () => {
    setResult(null);
    setQuantity(1);
    setCustomName('');
    setQrDataUrls({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-line bg-surface shadow-float transition-all overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-line flex items-center justify-between bg-surface/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            {catalog.imageUrl ? (
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-line shrink-0">
                <img src={catalog.imageUrl} alt={catalog.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text">{catalog.name}</h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {catalog.modelCode}
                </span>
              </div>
              <p className="text-xs text-muted">
                {result
                  ? `Đã tạo xong ${result.generatedCount} tem QR với số sê-ri tự tăng liên tiếp`
                  : `Cấp phát số sê-ri mới theo tiền tố "${catalog.serialPrefix}" và tạo mã QR`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!result ? (
            /* Step 1: Input Quantity & Config */
            <form onSubmit={handleGenerate} className="space-y-6 max-w-xl mx-auto py-2">
              <div className="surface-card p-5 rounded-2xl border border-line bg-surface/50 space-y-4">
                <label className="block text-xs font-semibold text-text uppercase tracking-wider">
                  Số lượng thiết bị / Mã QR cần tạo:
                </label>
                
                {/* Quick quantity selector */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[1, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuantity(num)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                        quantity === num
                          ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-soft scale-[1.02]'
                          : 'bg-surface border-line text-text hover:border-amber-500/50'
                      }`}
                    >
                      {num} {num === 1 ? 'chiếc' : 'chiếc'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-muted">Hoặc nhập số lượng tùy chọn (1 - 50):</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-24 rounded-xl border border-line bg-surface px-3 py-1.5 text-center text-sm font-bold text-text focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
                  Tên hiển thị gợi ý cho lô này (Không bắt buộc)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`Mặc định: ${catalog.name} #1, #2...`}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
                />
                <span className="text-[11px] text-muted">
                  Người dùng khi quét tem nhận thiết bị vào nhà vẫn có thể đổi lại tên này.
                </span>
              </div>

              {/* Live Preview Box */}
              <div className="rounded-2xl border border-line bg-surface p-4 text-xs text-muted space-y-1.5">
                <p className="font-semibold text-text flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Quy trình tạo tự động:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Tự động tìm số sê-ri lớn nhất hiện có của model này.</li>
                  <li>Tạo liên tiếp <strong>{quantity}</strong> số sê-ri mới (VD: <code className="font-mono text-primary">{catalog.serialPrefix}0001</code>).</li>
                  <li>Tạo bản ghi thiết bị ở trạng thái <span className="font-semibold text-amber-500">UNCLAIMED</span> (chờ khách kích hoạt).</li>
                  <li>Mã hóa bảo mật Token 1 lần (Single-use SHA-256) dán vào mã QR.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-7 py-3 text-sm font-bold text-slate-900 shadow-float hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Đang khởi tạo mã...' : `⚡ Tạo ${quantity} Mã QR Ngay`}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Generated QR Stickers Result */
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-sm text-text">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Đã tạo thành công <strong>{result.generatedCount}</strong> mã QR cho dòng <strong>{catalog.name}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintAll}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-bold hover:bg-slate-800 shadow-soft transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>In Tất Cả Tem QR</span>
                  </button>
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface text-text px-4 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 shadow-soft transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Tất Cả Ảnh</span>
                  </button>
                </div>
              </div>

              {/* Grid of QR Stickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {result.items.map((item, idx) => {
                  const qrUrl = qrDataUrls[item.device.id];
                  return (
                    <div
                      key={item.device.id}
                      className="surface-card rounded-2xl border-2 border-line bg-white dark:bg-slate-900 p-4 text-center shadow-soft flex flex-col justify-between"
                    >
                      <div>
                        {/* Sticker Header */}
                        <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
                          <span className="text-[11px] font-black tracking-widest text-text">HESTA SMART</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* QR Image */}
                        <div className="my-2 flex justify-center">
                          {qrUrl ? (
                            <img
                              src={qrUrl}
                              alt={`QR ${item.device.serialNumber}`}
                              className="w-40 h-40 rounded-xl border border-line bg-white p-1"
                            />
                          ) : (
                            <div className="w-40 h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                          )}
                        </div>

                        {/* Device Info */}
                        <h4 className="text-sm font-bold text-text truncate px-2">{item.device.name}</h4>
                        <p className="text-xs text-muted font-medium mt-0.5">Model: {item.device.model}</p>
                        <p className="text-xs font-mono font-bold text-amber-500 mt-0.5">
                          {item.device.serialNumber}
                        </p>
                        <p className="mt-2 text-[10px] font-bold text-amber-600 tracking-wider">
                          SCAN WITH HESTA APP
                        </p>
                      </div>

                      {/* Sticker Actions */}
                      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleCopyToken(item.qr.token)}
                          className="text-muted hover:text-text flex items-center gap-1 transition-colors cursor-pointer"
                          title="Sao chép Token"
                        >
                          {copiedToken === item.qr.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Token</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDownloadSingle(item)}
                          className="text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải ảnh</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hidden container for print */}
              <div ref={printContainerRef} className="hidden">
                {result.items.map((item) => (
                  <div key={item.device.id} className="badge">
                    <div className="brand">HESTA SMART HOME</div>
                    {qrDataUrls[item.device.id] && (
                      <img
                        src={qrDataUrls[item.device.id]}
                        alt={item.device.serialNumber || 'QR'}
                        className="qr-img"
                      />
                    )}
                    <div className="title">{item.device.name}</div>
                    <div className="meta">Model: {item.device.model}</div>
                    <div className="meta">Serial: {item.device.serialNumber}</div>
                    <div className="footer">SCAN WITH HESTA APP</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-line flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Sinh thêm lô khác cho mẫu này
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 px-6 py-2.5 text-sm font-bold text-text hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hoàn Tất &amp; Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
