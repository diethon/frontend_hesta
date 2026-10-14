import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  adminCreateDevice,
  adminRegenerateQr,
  type AdminCreateDevicePayload,
  type AdminDeviceCreatedResponse,
} from '../../services/deviceApi';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';

interface AdminDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEVICE_TYPES = [
  { value: 'LIGHT', label: 'Đèn Relay (LIGHT)' },
  { value: 'LED_RGB', label: 'Đèn LED RGB (LED_RGB)' },
  { value: 'SMART_PLUG', label: 'Ổ cắm thông minh (SMART_PLUG)' },
  { value: 'TEMP_HUMID_SENSOR', label: 'Cảm biến Nhiệt/Ẩm (TEMP_HUMID_SENSOR)' },
  { value: 'MOTION_SENSOR', label: 'Cảm biến Chuyển động (MOTION_SENSOR)' },
  { value: 'SMOKE_SENSOR', label: 'Cảm biến Khói (SMOKE_SENSOR)' },
  { value: 'IR_REMOTE', label: 'Bộ điều khiển hồng ngoại (IR_REMOTE)' },
  { value: 'CAMERA_AI', label: 'Camera AI (CAMERA_AI)' },
];

export const AdminDeviceModal: React.FC<AdminDeviceModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<AdminCreateDevicePayload>({
    name: 'SYNA RGB Light',
    deviceType: 'LED_RGB',
    model: 'SYNA-RGB-001',
    serialNumber: `SYNA-RGB-001-${Math.floor(1000 + Math.random() * 9000)}`,
  });

  const [loading, setLoading] = useState(false);
  const [createdData, setCreatedData] = useState<AdminDeviceCreatedResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (createdData?.qr?.payload) {
      QRCode.toDataURL(createdData.qr.payload, {
        width: 250,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [createdData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminCreateDevice(formData);
      setCreatedData(res);
      notify.success('Tạo thiết bị và sinh mã QR thành công!', '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tạo thiết bị'), '');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!createdData?.device?.id) return;
    setLoading(true);
    try {
      const newQr = await adminRegenerateQr(createdData.device.id);
      setCreatedData({
        ...createdData,
        qr: newQr,
      });
      notify.success('Mã QR đã được làm mới thành công!', '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể làm mới mã QR'), '');
    } finally {

      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=600,height=600');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>In mã QR Thiết bị - ${createdData?.device?.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #fff;
            }
            .badge {
              width: 300px;
              border: 2px solid #0f172a;
              border-radius: 16px;
              padding: 24px;
              text-align: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .badge h1 {
              margin: 0 0 12px;
              font-size: 24px;
              letter-spacing: 2px;
              color: #0f172a;
            }
            .badge img {
              width: 200px;
              height: 200px;
              margin: 8px 0;
            }
            .badge h2 {
              margin: 8px 0 4px;
              font-size: 16px;
              color: #1e293b;
            }
            .badge p {
              margin: 2px 0;
              font-size: 13px;
              color: #64748b;
            }
            .badge .footer {
              margin-top: 14px;
              font-size: 12px;
              font-weight: bold;
              color: #0284c7;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
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

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${createdData?.device?.serialNumber || 'device'}.png`;
    a.click();
  };

  const resetForm = () => {
    setCreatedData(null);
    setQrDataUrl('');
    setFormData({
      name: 'SYNA RGB Light',
      deviceType: 'LED_RGB',
      model: 'SYNA-RGB-001',
      serialNumber: `SYNA-RGB-001-${Math.floor(1000 + Math.random() * 9000)}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-float transition-all sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-xl font-bold text-text">
              {createdData ? 'Mã QR Thiết Bị Mới' : 'Thêm Thiết Bị Mới (Admin)'}
            </h2>
            <p className="text-xs text-muted">
              {createdData
                ? 'Thiết bị đã được tạo ở trạng thái UNCLAIMED'
                : 'Đăng ký record thiết bị để người dùng quét ghép nối'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-slate-100 hover:text-text transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {!createdData ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Tên Thiết Bị
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: SYNA RGB Light"
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Loại Thiết Bị (Device Type)
              </label>
              <select
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="VD: SYNA-RGB-001"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="VD: SYNA-RGB-001-0001"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {loading ? 'Đang tạo...' : 'Tạo Thiết Bị & Sinh QR'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Printable Badge Card */}
            <div className="flex justify-center">
              <div
                ref={printRef}
                className="w-72 rounded-2xl border-2 border-slate-800 bg-white p-5 text-center shadow-md"
              >
                <div className="badge">
                  <h1 className="text-xl font-black tracking-widest text-slate-900">SYNA</h1>
                  <div className="my-2 flex justify-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Device QR Code" className="h-44 w-44 rounded-lg" />
                    ) : (
                      <div className="h-44 w-44 animate-pulse rounded-lg bg-slate-100" />
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">{createdData.device.name}</h2>
                  <p className="text-xs text-slate-500 font-medium">Model: {createdData.device.model || 'N/A'}</p>
                  <p className="text-xs text-slate-500 font-mono">Serial: {createdData.device.serialNumber}</p>
                  <p className="footer mt-3 text-[11px] font-bold text-sky-600 tracking-wider">
                    SCAN WITH SYNA APP
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                In Mã QR
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-text hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Lưu Ảnh QR
              </button>

              <button
                onClick={handleRegenerate}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Làm Mới QR
              </button>
            </div>

            <div className="flex justify-between border-t border-line pt-4">
              <button
                onClick={resetForm}
                className="rounded-xl px-4 py-2 text-sm font-medium text-primary hover:underline"
              >
                + Tạo thêm thiết bị khác
              </button>
              <button
                onClick={onClose}
                className="rounded-xl bg-slate-100 px-5 py-2 text-sm font-medium text-text hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
