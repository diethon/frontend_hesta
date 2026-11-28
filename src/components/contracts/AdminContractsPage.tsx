import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Home,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import type {
  AdminContractStats,
  ContractDetail,
  ContractProvisionOptions,
  ContractSummary,
  HandoverDeviceInput,
  ProposalItemInput,
} from '../../types/contract';
import {
  addAdminContractComment,
  cancelAdminContract,
  confirmAdminDeposit,
  getAdminContract,
  getAdminContractStats,
  getAdminProvisionOptions,
  handoverAdminContract,
  listAdminContracts,
  rejectAdminDeposit,
  saveAdminContractProposal,
  startAdminInstallation,
  updateAdminContractSurvey,
} from '../../services/contractApi';
import { SurveyProfileCard } from './SurveyProfileCard';
import type { SurveyChecklistItem, SurveyFlags } from '../../types/contract';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { AdminAvatarMenu } from '../admin/AdminAvatarMenu';
import { ProfileModal } from '../profile/ProfileModal';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { ContractDocumentView } from './ContractDocumentView';
import {
  CONTRACT_EVENT_LABELS,
  CONTRACT_STATUS_META,
  formatDateTime,
  formatVnd,
  HOME_TYPE_LABELS,
  toLocalDateTimeInputValue,
} from './contractFormat';

interface AdminContractsPageProps {
  user: UserResponse;
  onLogout: () => void;
  onProfileUpdate: (user: UserResponse) => void;
}

type AdminTab = 'survey' | 'compose' | 'operations' | 'preview';

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SUBMITTED', label: 'Chờ tư vấn' },
  { value: 'SURVEYING', label: 'Đang khảo sát' },
  { value: 'REVISION_REQUESTED', label: 'Yêu cầu chỉnh sửa' },
  { value: 'QUOTED', label: 'Đã gửi báo giá' },
  { value: 'AWAITING_DEPOSIT', label: 'Chờ đặt cọc' },
  { value: 'DEPOSIT_SUBMITTED', label: 'Chờ đối soát cọc' },
  { value: 'DEPOSIT_CONFIRMED', label: 'Đã nhận cọc' },
  { value: 'INSTALLING', label: 'Đang lắp đặt' },
  { value: 'HANDED_OVER', label: 'Đã bàn giao' },
];

export const AdminContractsPage: React.FC<AdminContractsPageProps> = ({
  user,
  onLogout,
  onProfileUpdate,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [stats, setStats] = useState<AdminContractStats | null>(null);
  const [options, setOptions] = useState<ContractProvisionOptions | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('survey');
  const [submitting, setSubmitting] = useState(false);

  // Proposal composer form state
  const [templateCode, setTemplateCode] = useState('STANDARD_HOME');
  const [termsTitle, setTermsTitle] = useState('');
  const [termsContent, setTermsContent] = useState('');
  const [specialTerms, setSpecialTerms] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [installationFee, setInstallationFee] = useState<number>(1500000);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [depositPercent, setDepositPercent] = useState<number>(30);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [items, setItems] = useState<ProposalItemInput[]>([]);
  const [showProviderEditor, setShowProviderEditor] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [providerCompanyName, setProviderCompanyName] = useState('');
  const [providerTaxCode, setProviderTaxCode] = useState('');
  const [providerAddress, setProviderAddress] = useState('');
  const [providerRepresentative, setProviderRepresentative] = useState('');
  const [providerHotline, setProviderHotline] = useState('');
  const [providerEmail, setProviderEmail] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');

  // Deposit verification state
  const [verifiedAmount, setVerifiedAmount] = useState<number>(0);
  const [verifyRefCode, setVerifyRefCode] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Handover (Turnkey Direct Provisioning) state
  const [handoverMode, setHandoverMode] = useState<'CREATE_NEW_HOME' | 'LINK_EXISTING_HOME'>('CREATE_NEW_HOME');
  const [existingHomeId, setExistingHomeId] = useState('');
  const [handoverHomeName, setHandoverHomeName] = useState('');
  const [handoverHomeAddress, setHandoverHomeAddress] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverDevices, setHandoverDevices] = useState<HandoverDeviceInput[]>([]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const [rows, statsRes, opts] = await Promise.all([
        listAdminContracts({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          keyword: keyword.trim() || undefined,
        }),
        getAdminContractStats(),
        getAdminProvisionOptions(),
      ]);
      setContracts(rows);
      setStats(statsRes);
      setOptions(opts);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể tải danh sách hợp đồng'), '');
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, keyword]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const hydrateFromDetail = useCallback((c: ContractDetail) => {
    setTemplateCode(c.templateCode || 'STANDARD_HOME');
    setTermsTitle(c.termsTitle || '');
    setTermsContent(c.termsContent || '');
    setSpecialTerms(c.specialTerms || '');
    setAdminNote(c.adminNote || '');
    setInstallationFee(Number(c.installationFee || 0));
    setDiscountAmount(Number(c.discountAmount || 0));
    setDepositPercent(c.depositPercent ?? 30);
    setScheduleStart(toLocalDateTimeInputValue(c.scheduledInstallStart || c.preferredInstallDate));
    setScheduleEnd(toLocalDateTimeInputValue(c.scheduledInstallEnd));
    setItems(
      c.items.map((it) => ({
        catalogId: it.catalogId ?? null,
        deviceName: it.deviceName,
        modelCode: it.modelCode ?? '',
        deviceType: it.deviceType ?? 'SWITCH',
        roomLabel: it.roomLabel || 'Phòng khách',
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice || 0),
        warrantyMonths: it.warrantyMonths || 12,
      }))
    );
    setProviderCompanyName(c.providerInfo.providerCompanyName);
    setProviderTaxCode(c.providerInfo.providerTaxCode);
    setProviderAddress(c.providerInfo.providerAddress);
    setProviderRepresentative(c.providerInfo.providerRepresentative);
    setProviderHotline(c.providerInfo.providerHotline);
    setProviderEmail(c.providerInfo.providerEmail);
    setBankName(c.providerInfo.bankName);
    setBankAccountNumber(c.providerInfo.bankAccountNumber);
    setBankAccountHolder(c.providerInfo.bankAccountHolder);

    setVerifiedAmount(Number(c.depositAmount || 0));
    setVerifyRefCode(c.depositReferenceCode || '');
    setVerifyNote('');
    setRejectReason('');

    setHandoverHomeName(c.homeName || `Nhà của ${c.customerName}`);
    setHandoverHomeAddress(c.installAddress);
    setHandoverNote('');
    // Expand contract items into 1-per-unit direct provisioning rows
    const expanded: HandoverDeviceInput[] = [];
    for (const it of c.items) {
      const qty = Math.max(1, it.quantity || 1);
      for (let i = 1; i <= qty; i++) {
        expanded.push({
          contractItemId: it.id,
          existingDeviceId: null,
          catalogId: it.catalogId ?? null,
          deviceName: qty > 1 ? `${it.deviceName} #${i}` : it.deviceName,
          roomName: it.roomLabel || 'Phòng khách',
          nodeCode: '',
          localId: '',
          warrantyMonths: it.warrantyMonths || 12,
        });
      }
    }
    setHandoverDevices(expanded);

    // Choose smart default tab based on status
    if (['SUBMITTED', 'SURVEYING'].includes(c.status)) {
      setActiveTab('survey');
    } else if (['QUOTED', 'REVISION_REQUESTED'].includes(c.status)) {
      setActiveTab('compose');
    } else if (['AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_CONFIRMED', 'INSTALLING'].includes(c.status)) {
      setActiveTab('operations');
    } else {
      setActiveTab('preview');
    }
  }, []);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await getAdminContract(id);
        setDetail(res);
        hydrateFromDetail(res);
      } catch (err) {
        notify.error(getErrorMessage(err, 'Không thể tải chi tiết hợp đồng'), '');
      } finally {
        setDetailLoading(false);
      }
    },
    [hydrateFromDetail]
  );

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const liveTotals = useMemo(() => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
    const total = Math.max(0, subtotal + (Number(installationFee) || 0) - (Number(discountAmount) || 0));
    const depPct = Math.max(0, Math.min(100, Number(depositPercent) || 0));
    const deposit = Math.round((total * depPct) / 100);
    const remaining = Math.max(0, total - deposit);
    return { subtotal, total, deposit, remaining };
  }, [items, installationFee, discountAmount, depositPercent]);

  const previewContract: ContractDetail | null = useMemo(() => {
    if (!detail) return null;
    if (!['SUBMITTED', 'SURVEYING', 'QUOTED', 'REVISION_REQUESTED'].includes(detail.status)) {
      return detail;
    }
    return {
      ...detail,
      templateCode,
      termsTitle,
      termsContent,
      specialTerms,
      subtotalAmount: liveTotals.subtotal,
      installationFee,
      discountAmount,
      totalAmount: liveTotals.total,
      depositPercent,
      depositAmount: liveTotals.deposit,
      remainingAmount: liveTotals.remaining,
      scheduledInstallStart: scheduleStart ? new Date(scheduleStart).toISOString() : detail.scheduledInstallStart,
      scheduledInstallEnd: scheduleEnd ? new Date(scheduleEnd).toISOString() : detail.scheduledInstallEnd,
      providerInfo: {
        providerCompanyName,
        providerTaxCode,
        providerAddress,
        providerRepresentative,
        providerHotline,
        providerEmail,
        bankName,
        bankAccountNumber,
        bankAccountHolder,
      },
      items: items.map((it, idx) => ({
        id: `preview-${idx}`,
        catalogId: it.catalogId ?? null,
        deviceName: it.deviceName,
        modelCode: it.modelCode ?? null,
        deviceType: it.deviceType ?? null,
        roomLabel: it.roomLabel ?? 'Phòng khách',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0),
        warrantyMonths: it.warrantyMonths,
        sortOrder: idx,
      })),
    };
  }, [
    detail,
    templateCode,
    termsTitle,
    termsContent,
    specialTerms,
    liveTotals,
    installationFee,
    discountAmount,
    depositPercent,
    scheduleStart,
    scheduleEnd,
    providerCompanyName,
    providerTaxCode,
    providerAddress,
    providerRepresentative,
    providerHotline,
    providerEmail,
    bankName,
    bankAccountNumber,
    bankAccountHolder,
    items,
  ]);

  const applyTemplate = (code: string) => {
    const tpl = options?.templates.find((t) => t.code === code);
    if (!tpl) return;
    setTemplateCode(tpl.code);
    setTermsTitle(tpl.termsTitle);
    setTermsContent(tpl.termsContent);
    setDepositPercent(tpl.defaultDepositPercent);
    setInstallationFee(Number(tpl.defaultInstallationFee || 0));
    notify.success(`Đã áp dụng mẫu: ${tpl.name}`, '');
  };

  const addCatalogItem = (catalogId: string) => {
    const cat = options?.catalogs.find((c) => c.id === catalogId);
    if (!cat) return;
    setItems((prev) => [
      ...prev,
      {
        catalogId: cat.id,
        deviceName: cat.name,
        modelCode: cat.modelCode,
        deviceType: cat.deviceType,
        roomLabel: 'Phòng khách',
        quantity: 1,
        unitPrice: Number(cat.unitPrice || 0),
        warrantyMonths: cat.warrantyMonths || 12,
      },
    ]);
  };

  const handleSaveSurvey = async (payload: {
    surveyChecklist: SurveyChecklistItem[];
    surveyFlags: SurveyFlags;
    surveyNotes: string;
  }) => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const updated = await updateAdminContractSurvey(detail.id, {
        surveyChecklist: payload.surveyChecklist,
        surveyFlags: payload.surveyFlags,
        surveyNotes: payload.surveyNotes,
      });
      setDetail(updated);
      notify.success('Đã lưu hồ sơ khảo sát kỹ thuật', '');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không lưu được hồ sơ khảo sát'), '');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-suggest draft quotation items from customer's surveyed needs when Admin clicks "Lập phương án & Báo giá"
  const handlePromoteSurveyToProposal = () => {
    if (!detail) return;
    if (items.length === 0 && detail.requestedDevices?.length > 0 && options?.catalogs?.length) {
      const catMap: Record<string, string[]> = {
        SMART_SWITCH: ['HESTA-SW-01', 'LIGHT', 'SWITCH'],
        CAMERA_AI: ['HESTA-CAM-01', 'CAMERA_AI', 'CAMERA'],
        SENSORS: ['HESTA-PIR-01', 'HESTA-TH-01', 'MOTION_SENSOR', 'TEMP_HUMID_SENSOR'],
        GATE_MOTOR: ['HESTA-GATE-01', 'GATE_MOTOR', 'GATE'],
        LIGHTING_RGB: ['HESTA-RGB-01', 'LED_RGB'],
        AC_AI_HUB: ['HESTA-AC-01', 'AC_REMOTE'],
      };
      const suggested: ProposalItemInput[] = [];
      for (const need of detail.requestedDevices) {
        const keys = catMap[need.category] || [];
        const matched = options.catalogs.find(
          (c) => keys.includes(c.modelCode.toUpperCase()) || keys.includes(c.deviceType.toUpperCase())
        );
        if (matched) {
          const parsedNum = parseInt((need.estimatedQuantity || '').replace(/[^0-9]/g, ''), 10);
          const qty = Number.isFinite(parsedNum) && parsedNum > 0 ? Math.min(parsedNum, 20) : 1;
          suggested.push({
            catalogId: matched.id,
            deviceName: matched.name,
            modelCode: matched.modelCode,
            deviceType: matched.deviceType,
            roomLabel: need.locations && need.locations.length > 0 ? need.locations[0] : 'Phòng khách',
            quantity: qty,
            unitPrice: Number(matched.unitPrice || 0),
            warrantyMonths: matched.warrantyMonths || 12,
          });
        }
      }
      if (suggested.length > 0) {
        setItems(suggested);
        if (installationFee === 0) setInstallationFee(1500000);
        notify.info(`Đã gợi ý ${suggested.length} hạng mục từ phiếu khảo sát — hãy kiểm tra lại số lượng & đơn giá trước khi gửi báo giá.`);
      }
    }
    setActiveTab('compose');
  };

  const handleSaveProposal = async () => {
    if (!detail) return;
    if (items.length === 0) {
      notify.error('Vui lòng thêm ít nhất 1 thiết bị vào hợp đồng', '');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await saveAdminContractProposal(detail.id, {
        templateCode,
        termsTitle,
        termsContent,
        specialTerms: specialTerms.trim() || undefined,
        installationFee,
        discountAmount,
        depositPercent,
        scheduledInstallStart: scheduleStart ? new Date(scheduleStart).toISOString() : null,
        scheduledInstallEnd: scheduleEnd ? new Date(scheduleEnd).toISOString() : null,
        adminNote: adminNote.trim() || undefined,
        providerCompanyName,
        providerTaxCode,
        providerAddress,
        providerRepresentative,
        providerHotline,
        providerEmail,
        bankName,
        bankAccountNumber,
        bankAccountHolder,
        items,
      });
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.success(`Đã gửi bản thảo hợp đồng v${updated.contractVersion} tới khách hàng`, '');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể gửi bản thảo hợp đồng'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!detail || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const updated = await addAdminContractComment(detail.id, commentText.trim());
      setDetail(updated);
      setCommentText('');
      notify.success('Đã gửi phản hồi tới khách hàng', '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không gửi được tin nhắn'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const updated = await confirmAdminDeposit(detail.id, {
        verifiedAmount,
        referenceCode: verifyRefCode.trim() || undefined,
        note: verifyNote.trim() || undefined,
      });
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.success('Đã xác nhận nhận tiền đặt cọc! Sẵn sàng triển khai lắp đặt.', '');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể xác nhận tiền cọc'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectDeposit = async () => {
    if (!detail || !rejectReason.trim()) {
      notify.error('Vui lòng nhập lý do cần kiểm tra lại cọc', '');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await rejectAdminDeposit(detail.id, rejectReason.trim());
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.info('Đã thông báo khách kiểm tra lại giao dịch cọc');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Thao tác thất bại'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartInstall = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const updated = await startAdminInstallation(detail.id, 'Đội kỹ thuật HESTA bắt đầu triển khai thi công tại công trình.');
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.success('Đã chuyển sang trạng thái Đang lắp đặt', '');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không chuyển trạng thái được'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHandover = async () => {
    if (!detail) return;
    if (handoverMode === 'LINK_EXISTING_HOME' && !existingHomeId) {
      notify.error('Vui lòng chọn ngôi nhà có sẵn để bàn giao', '');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await handoverAdminContract(detail.id, {
        mode: handoverMode,
        existingHomeId: handoverMode === 'LINK_EXISTING_HOME' ? existingHomeId : null,
        homeName: handoverMode === 'CREATE_NEW_HOME' ? handoverHomeName.trim() : undefined,
        homeAddress: handoverMode === 'CREATE_NEW_HOME' ? handoverHomeAddress.trim() : undefined,
        handoverNote: handoverNote.trim() || undefined,
        devices: handoverDevices,
      });
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.success('Bàn giao hệ thống hoàn tất! Khách hàng đã có thể vào điều khiển nhà ngay.', '');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể bàn giao hệ thống'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelContract = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const updated = await cancelAdminContract(detail.id, 'Quản trị viên hủy hồ sơ');
      setDetail(updated);
      hydrateFromDetail(updated);
      notify.info('Đã hủy hợp đồng');
      void loadList();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không hủy được hợp đồng'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const adminNavRailItems = [
    { id: 'admin', icon: 'grid' as const, label: 'Quản lý thiết bị & QR', onClick: () => navigate('/admin'), active: false },
    { id: 'users', icon: 'users' as const, label: 'Quản lý người dùng', onClick: () => navigate('/admin/users'), active: false },
    { id: 'diagnostics', icon: 'activity' as const, label: 'Chẩn đoán hạ tầng IoT', onClick: () => navigate('/admin/diagnostics'), active: false },
    { id: 'maintenance', icon: 'wrench' as const, label: 'Bảo trì thiết bị', onClick: () => navigate('/admin/maintenance'), active: false },
    { id: 'contracts', icon: 'briefcase' as const, label: 'Hợp đồng lắp đặt', onClick: () => setSearchParams({}), active: true },
  ];

  const isLocked = detail
    ? ['AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_CONFIRMED', 'INSTALLING', 'HANDED_OVER', 'CANCELLED'].includes(detail.status)
    : false;

  const inputCls =
    'w-full rounded-xl border border-line bg-sidebar/30 px-3 py-2 text-xs sm:text-sm text-text focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="app-shell min-h-screen bg-app text-text relative">
      <div className="mesh mesh-one pointer-events-none print:hidden" />
      <div className="mesh mesh-two pointer-events-none print:hidden" />

      <div className="print:hidden">
        <DashboardNavRail
          activeItem="contracts"
          items={adminNavRailItems}
          user={user}
          onOpenProfile={() => setIsProfileOpen(true)}
          hideSettings
          brandTitle="HESTA Admin Center"
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 pb-24 lg:pb-12">
        {/* TopBar */}
        <header className="print:hidden flex items-center justify-between gap-4 py-2 border-b border-line/60">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">
              Hợp đồng Lắp đặt &amp; Bàn giao
            </h1>
            <p className="text-xs text-muted mt-0.5 truncate">
              Tiếp nhận yêu cầu từ Landing Page, soạn hợp đồng mẫu, đối soát đặt cọc và bàn giao thiết bị trực tiếp (không cần quét QR)
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                void loadList();
                if (selectedId) void loadDetail(selectedId);
              }}
              className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-text cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <NotificationBell />
            <AdminAvatarMenu
              user={user}
              onOpenProfile={() => setIsProfileOpen(true)}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* KPI Strip */}
        {stats && (
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Chờ tư vấn', value: stats.submitted, color: 'text-sky-600' },
              { label: 'Đang khảo sát', value: stats.surveying, color: 'text-blue-600' },
              { label: 'Báo giá / Sửa', value: stats.quoted + stats.revisionRequested, color: 'text-indigo-600' },
              { label: 'Chờ đối soát cọc', value: stats.depositSubmitted, color: 'text-purple-600' },
              { label: 'Chờ / Đang lắp', value: stats.depositConfirmed + stats.installing, color: 'text-cyan-600' },
              { label: 'Đã bàn giao', value: stats.handedOver, color: 'text-emerald-600' },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-surface/90 p-3.5 shadow-2xs">
                <p className="text-[11px] font-medium text-muted">{k.label}</p>
                <p className={`text-2xl font-extrabold mt-1 font-mono ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main 2-column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Contract Queue */}
          <section className="print:hidden lg:col-span-4 space-y-3">
            <div className="rounded-2xl border border-line bg-surface/95 p-3.5 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm mã HĐ, tên, SĐT, email..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                      statusFilter === f.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-sidebar/40 text-muted border-line hover:text-text'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-y-auto custom-scrollbar pr-1">
              {listLoading ? (
                <div className="rounded-2xl border border-line bg-surface p-6 text-center text-xs text-muted">
                  Đang tải danh sách hợp đồng...
                </div>
              ) : contracts.length === 0 ? (
                <div className="rounded-2xl border border-line bg-surface p-8 text-center space-y-1.5">
                  <FileText className="w-8 h-8 text-muted/50 mx-auto" />
                  <p className="text-sm font-semibold text-text">Chưa có hồ sơ hợp đồng</p>
                  <p className="text-xs text-muted">Yêu cầu từ Landing Page hoặc khách hàng sẽ hiển thị tại đây.</p>
                </div>
              ) : (
                contracts.map((c) => {
                  const meta = CONTRACT_STATUS_META[c.status];
                  const active = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSearchParams({ id: c.id })}
                      className={`w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                        active
                          ? 'border-primary bg-primary/8 shadow-sm'
                          : 'border-line bg-surface hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-text">
                          {c.code} <span className="text-muted font-normal">v{c.contractVersion}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-text mt-1 truncate">{c.customerName}</p>
                      <p className="text-xs text-muted truncate">
                        {c.customerPhone} · {c.homeName || HOME_TYPE_LABELS[c.homeType] || c.homeType}
                      </p>
                      <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-line/50">
                        <span className="font-mono font-semibold text-primary-hover">
                          {c.totalAmount > 0 ? formatVnd(c.totalAmount) : 'Chờ khảo sát & báo giá'}
                        </span>
                        <span className="text-muted">{formatDateTime(c.createdAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Right: Workspace */}
          <section className="lg:col-span-8 space-y-4">
            {!selectedId ? (
              <div className="print:hidden rounded-3xl border border-line bg-surface/90 p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-primary/60 mx-auto" />
                <h2 className="text-lg font-bold text-text">Chọn một hồ sơ hợp đồng để xử lý</h2>
                <p className="text-xs text-muted max-w-md mx-auto">
                  Tại đây bạn có thể chọn hợp đồng mẫu chuẩn Việt Nam, thêm thiết bị từ Danh mục sản phẩm, gửi báo giá, đối soát đặt cọc và bàn giao trực tiếp nhà + thiết bị cho khách.
                </p>
              </div>
            ) : detailLoading || !detail ? (
              <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">
                Đang tải chi tiết hợp đồng...
              </div>
            ) : (
              <>
                  {/* Header card */}
                <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-extrabold text-text">{detail.code}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-sidebar text-xs font-mono text-muted">
                          v{detail.contractVersion}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${CONTRACT_STATUS_META[detail.status].badgeClass}`}>
                          {CONTRACT_STATUS_META[detail.status].label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text mt-1">
                        {detail.customerName} · {detail.customerPhone} · {detail.customerEmail}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Công trình: {detail.homeName} ({HOME_TYPE_LABELS[detail.homeType] || detail.homeType}) — {detail.installAddress}
                      </p>
                      {detail.customerNote && (
                        <p className="text-xs text-[#78350f] mt-1.5 bg-[#fef3c7] px-3 py-1.5 rounded-xl border border-[#f59e0b]">
                          <strong>Ghi chú khách hàng:</strong> {detail.customerNote}
                        </p>
                      )}
                    </div>

                    {['SUBMITTED', 'SURVEYING', 'QUOTED', 'REVISION_REQUESTED', 'AWAITING_DEPOSIT'].includes(detail.status) && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleCancelContract}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-600 text-xs font-semibold hover:bg-rose-500/10 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Hủy hồ sơ
                      </button>
                    )}
                  </div>

                  {/* Prominent Banner when Customer requests revision */}
                  {detail.status === 'REVISION_REQUESTED' && (() => {
                    const latestRevision = [...detail.events]
                      .filter((ev) => ev.eventType === 'REVISION_REQUESTED')
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    return (
                      <div className="rounded-2xl border-2 border-[#f59e0b] bg-[#fffbeb] p-4 flex flex-wrap items-start justify-between gap-3 shadow-xs">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <ShieldAlert className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-[#92400e]">
                              Khách hàng yêu cầu điều chỉnh hợp đồng
                              {latestRevision?.createdAt ? ` · ${formatDateTime(latestRevision.createdAt)}` : ''}
                            </p>
                            <p className="text-sm font-semibold text-[#0f172a] whitespace-pre-line">
                              {latestRevision?.message || 'Khách hàng đã gửi yêu cầu điều chỉnh phương án / báo giá.'}
                            </p>
                          </div>
                        </div>
                        {activeTab !== 'compose' && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('compose')}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#b45309] text-white text-xs font-bold hover:bg-[#92400e] cursor-pointer"
                          >
                            Sửa Phương án &amp; Báo giá →
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Prominent Banner when Admin previously rejected deposit and waiting for customer re-submission */}
                  {detail.status === 'AWAITING_DEPOSIT' && (() => {
                    const latestReject = [...detail.events]
                      .filter((ev) => ev.eventType === 'DEPOSIT_REJECTED')
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    if (!latestReject) return null;
                    return (
                      <div className="rounded-2xl border border-[#ef4444] bg-[#fef2f2] p-3.5 flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-[#991b1b]">
                            Đã yêu cầu khách kiểm tra lại giao dịch đặt cọc ({formatDateTime(latestReject.createdAt)})
                          </p>
                          <p className="text-[#7f1d1d] whitespace-pre-line">
                            Lý do đã gửi khách: <strong>{latestReject.message}</strong>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Workspace Tabs */}
                  <div className="flex flex-wrap gap-2 border-t border-line/60 pt-3">
                    {[
                      { id: 'survey' as const, label: '1. Hồ sơ nhu cầu & Khảo sát', icon: Search },
                      { id: 'compose' as const, label: '2. Phương án & Hợp đồng', icon: FileText },
                      { id: 'operations' as const, label: '3. Đặt cọc & Bàn giao (Bypass QR)', icon: Wrench },
                      { id: 'preview' as const, label: '4. Văn bản A4 & In PDF', icon: Eye },
                    ].map((t) => {
                      const TabIcon = t.icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTab(t.id)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            activeTab === t.id
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-sidebar/40 text-muted border-line hover:text-text'
                          }`}
                        >
                          <TabIcon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TAB 0: CONSULTATION DOSSIER & TECHNICAL SURVEY */}
                {activeTab === 'survey' && (
                  <div className="print:hidden">
                    <SurveyProfileCard
                      key={`${detail.id}-${detail.updatedAt}`}
                      contract={detail}
                      mode="admin"
                      locked={isLocked}
                      submitting={submitting}
                      onSaveSurvey={handleSaveSurvey}
                      onPromoteToQuotation={handlePromoteSurveyToProposal}
                    />
                  </div>
                )}

                {/* TAB 1: CONTRACT COMPOSER */}
                {activeTab === 'compose' && (
                  <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-5 space-y-5">
                    {isLocked && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        Hợp đồng đã được khách ký xác nhận (trạng thái {CONTRACT_STATUS_META[detail.status].label}). Toàn bộ giá trị và điều khoản đã được khóa bất biến.
                      </div>
                    )}

                    {/* Template Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted">
                        Chọn Bộ Hợp đồng Mẫu chuẩn Việt Nam (1 chạm)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {options?.templates.map((tpl) => (
                          <button
                            key={tpl.code}
                            type="button"
                            disabled={isLocked}
                            onClick={() => applyTemplate(tpl.code)}
                            className={`text-left rounded-2xl border p-3 transition-all cursor-pointer disabled:opacity-60 ${
                              templateCode === tpl.code
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-line bg-sidebar/30 hover:border-primary/40'
                            }`}
                          >
                            <p className="text-xs font-bold text-text">{tpl.name}</p>
                            <p className="text-[11px] text-muted mt-1 line-clamp-2">{tpl.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Device Items Picker */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted">
                          Bảng kê thiết bị ({items.length} dòng)
                        </label>
                        {!isLocked && (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  addCatalogItem(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-text"
                            >
                              <option value="">+ Thêm thiết bị từ Catalog...</option>
                              {options?.catalogs.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name} ({cat.modelCode}) — {formatVnd(cat.unitPrice)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) => [
                                  ...prev,
                                  {
                                    catalogId: null,
                                    deviceName: 'Phụ kiện / Vật tư thi công',
                                    modelCode: 'CUSTOM',
                                    deviceType: 'OTHER',
                                    roomLabel: 'Chung',
                                    quantity: 1,
                                    unitPrice: 200000,
                                    warrantyMonths: 12,
                                  },
                                ])
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-sidebar/50 text-xs font-semibold hover:bg-sidebar cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Hạng mục ngoài
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {items.length > 0 && (
                          <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 rounded-xl bg-sidebar/40 border border-line/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                            <div className="col-span-4">Tên thiết bị / Hạng mục</div>
                            <div className="col-span-2">Phòng / khu vực</div>
                            <div className="col-span-1 text-center">SL</div>
                            <div className="col-span-2 text-right">Đơn giá (VNĐ)</div>
                            <div className="col-span-2 text-center">Bảo hành (tháng)</div>
                            <div className="col-span-1 text-right">Xóa</div>
                          </div>
                        )}
                        {items.map((it, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 items-center rounded-2xl border border-line bg-sidebar/20 p-2.5"
                          >
                            <div className="col-span-12 sm:col-span-4">
                              <span className="sm:hidden block text-[10px] font-bold uppercase text-muted mb-1">Tên thiết bị</span>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={it.deviceName}
                                onChange={(e) =>
                                  setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, deviceName: e.target.value } : x)))
                                }
                                placeholder="Tên thiết bị"
                                className={inputCls}
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-2">
                              <span className="sm:hidden block text-[10px] font-bold uppercase text-muted mb-1">Phòng / khu vực</span>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={it.roomLabel || ''}
                                onChange={(e) =>
                                  setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, roomLabel: e.target.value } : x)))
                                }
                                placeholder="Phòng / khu vực"
                                className={inputCls}
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                              <span className="sm:hidden block text-[10px] font-bold uppercase text-muted mb-1">SL</span>
                              <input
                                type="number"
                                min={1}
                                disabled={isLocked}
                                value={it.quantity}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))
                                  )
                                }
                                title="Số lượng"
                                className={`${inputCls} text-center font-mono`}
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-2">
                              <span className="sm:hidden block text-[10px] font-bold uppercase text-muted mb-1">Đơn giá (VNĐ)</span>
                              <input
                                type="number"
                                min={0}
                                step={10000}
                                disabled={isLocked}
                                value={it.unitPrice}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, unitPrice: Math.max(0, Number(e.target.value) || 0) } : x))
                                  )
                                }
                                title="Đơn giá (VNĐ)"
                                className={`${inputCls} text-right font-mono`}
                              />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                              <span className="sm:hidden block text-[10px] font-bold uppercase text-muted mb-1">Bảo hành (tháng)</span>
                              <input
                                type="number"
                                min={0}
                                max={60}
                                disabled={isLocked}
                                value={it.warrantyMonths}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, warrantyMonths: Math.max(0, Number(e.target.value) || 0) } : x))
                                  )
                                }
                                title="Bảo hành (tháng)"
                                className={`${inputCls} text-center font-mono`}
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1 flex justify-end">
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  title="Xóa dòng"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financials & Schedule */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Phí thi công &amp; cấu hình (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          disabled={isLocked}
                          value={installationFee}
                          onChange={(e) => setInstallationFee(Math.max(0, Number(e.target.value) || 0))}
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-muted">Ưu đãi / Chiết khấu (VNĐ)</label>
                          {!isLocked && (
                            <div className="flex items-center gap-1">
                              {[2, 5, 10].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => {
                                    const baseTotal = liveTotals.subtotal + installationFee;
                                    setDiscountAmount(Math.round((baseTotal * pct) / 100 / 1000) * 1000);
                                  }}
                                  className="px-1.5 py-0.5 rounded-md border border-line bg-sidebar/50 text-[10px] font-bold text-primary hover:bg-primary/10 cursor-pointer"
                                  title={`Áp dụng giảm ${pct}% trên tạm tính + phí thi công`}
                                >
                                  -{pct}%
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          disabled={isLocked}
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Tỷ lệ đặt cọc (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={isLocked}
                          value={depositPercent}
                          onChange={(e) => setDepositPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                    </div>

                    {/* Live Financial Summary */}
                    <div className="rounded-2xl border border-primary/25 bg-primary/8 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted">Tạm tính thiết bị</p>
                        <p className="font-mono font-bold text-text mt-0.5">{formatVnd(liveTotals.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-muted">Tổng giá trị HĐ</p>
                        <p className="font-mono font-extrabold text-primary-hover text-sm mt-0.5">{formatVnd(liveTotals.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted">Đặt cọc ({depositPercent}%)</p>
                        <p className="font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5">{formatVnd(liveTotals.deposit)}</p>
                      </div>
                      <div>
                        <p className="text-muted">Thanh toán khi bàn giao</p>
                        <p className="font-mono font-bold text-text mt-0.5">{formatVnd(liveTotals.remaining)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Thời gian lắp đặt bắt đầu</label>
                        <input
                          type="datetime-local"
                          disabled={isLocked}
                          value={scheduleStart}
                          onChange={(e) => setScheduleStart(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Dự kiến hoàn thành</label>
                        <input
                          type="datetime-local"
                          disabled={isLocked}
                          value={scheduleEnd}
                          onChange={(e) => setScheduleEnd(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* Terms Editor */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Tiêu đề Hợp đồng</label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={termsTitle}
                          onChange={(e) => setTermsTitle(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Nội dung các Điều khoản (chỉnh sửa trực tiếp)</label>
                        <textarea
                          rows={8}
                          disabled={isLocked}
                          value={termsContent}
                          onChange={(e) => setTermsContent(e.target.value)}
                          className={`${inputCls} leading-relaxed font-sans`}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Điều khoản thỏa thuận riêng (tùy chọn)</label>
                          <textarea
                            rows={2}
                            disabled={isLocked}
                            value={specialTerms}
                            onChange={(e) => setSpecialTerms(e.target.value)}
                            placeholder="VD: Miễn phí khảo sát mặt bằng, hỗ trợ thi công ngoài giờ hành chính..."
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Lời nhắn gửi khách kèm bản báo giá</label>
                          <textarea
                            rows={2}
                            disabled={isLocked}
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="VD: Gửi anh/chị bản báo giá chi tiết và lịch lắp dự kiến..."
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Provider & Bank Info */}
                    <div className="rounded-2xl border border-line bg-sidebar/20 p-3.5 space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowProviderEditor((v) => !v)}
                        className="w-full flex items-center justify-between text-xs font-bold text-text cursor-pointer"
                      >
                        <span>Thông tin Bên A &amp; Tài khoản Ngân hàng nhận cọc (mẫu chuẩn, bấm để chỉnh sửa)</span>
                        <span className="text-primary">{showProviderEditor ? 'Thu gọn' : 'Mở chỉnh sửa'}</span>
                      </button>
                      {showProviderEditor && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-line/60">
                          <input disabled={isLocked} value={providerCompanyName} onChange={(e) => setProviderCompanyName(e.target.value)} placeholder="Tên công ty" className={inputCls} />
                          <input disabled={isLocked} value={providerTaxCode} onChange={(e) => setProviderTaxCode(e.target.value)} placeholder="Mã số thuế" className={inputCls} />
                          <input disabled={isLocked} value={providerAddress} onChange={(e) => setProviderAddress(e.target.value)} placeholder="Địa chỉ trụ sở" className={`${inputCls} sm:col-span-2`} />
                          <input disabled={isLocked} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Tên ngân hàng" className={`${inputCls} sm:col-span-2`} />
                          <input disabled={isLocked} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Số tài khoản" className={`${inputCls} font-mono`} />
                          <input disabled={isLocked} value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="Chủ tài khoản" className={inputCls} />
                        </div>
                      )}
                    </div>

                    {!isLocked && (
                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('preview')}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line bg-surface text-xs font-bold text-text hover:bg-surface-hover cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          Xem trước văn bản A4
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleSaveProposal}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm cursor-pointer disabled:opacity-60"
                        >
                          <Send className="w-4 h-4" />
                          {submitting ? 'Đang gửi...' : 'Gửi bản thảo Hợp đồng & Báo giá'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DEPOSIT VERIFICATION & TURNKEY HANDOVER */}
                {activeTab === 'operations' && (
                  <div className="print:hidden space-y-4">
                    {/* Deposit Verification Section */}
                    <div className="rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-text flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-amber-600" />
                          Bước 1 · Đối soát chuyển khoản đặt cọc ({detail.depositPercent}% = {formatVnd(detail.depositAmount)})
                        </h3>
                        {detail.depositVerifiedAt && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận cọc
                          </span>
                        )}
                      </div>

                      <div className="rounded-2xl border border-line bg-sidebar/25 p-3.5 text-xs space-y-1">
                        <p>Ngân hàng nhận: <strong>{detail.providerInfo.bankName}</strong> · STK <strong className="font-mono">{detail.providerInfo.bankAccountNumber}</strong></p>
                        <p>Cú pháp đối soát: <strong className="font-mono text-primary-hover">{detail.depositTransferNote || `HESTA COC ${detail.code}`}</strong></p>
                        {detail.depositSubmittedAt && (
                          <p className="text-purple-700 dark:text-purple-300 font-medium pt-1">
                            Khách đã báo chuyển cọc lúc {formatDateTime(detail.depositSubmittedAt)}
                            {detail.depositReferenceCode ? ` · Mã GD: ${detail.depositReferenceCode}` : ''}
                            {detail.depositNote ? ` · Ghi chú: ${detail.depositNote}` : ''}
                          </p>
                        )}
                        {detail.depositProofUrl && (
                          <div className="pt-2">
                            <p className="text-[11px] text-muted mb-1">Ảnh biên lai chuyển khoản khách gửi:</p>
                            <a href={detail.depositProofUrl} target="_blank" rel="noreferrer" className="inline-block">
                              <img
                                src={detail.depositProofUrl}
                                alt="Biên lai đặt cọc"
                                className="max-h-56 rounded-xl border border-line object-contain bg-white"
                              />
                            </a>
                          </div>
                        )}
                      </div>

                      {['AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED'].includes(detail.status) ? (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">Số tiền thực nhận (VNĐ)</label>
                              <input
                                type="number"
                                value={verifiedAmount}
                                onChange={(e) => setVerifiedAmount(Number(e.target.value) || 0)}
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">Mã tham chiếu ngân hàng</label>
                              <input
                                type="text"
                                value={verifyRefCode}
                                onChange={(e) => setVerifyRefCode(e.target.value)}
                                placeholder="VD: FT26330..."
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">Ghi chú kế toán</label>
                              <input
                                type="text"
                                value={verifyNote}
                                onChange={(e) => setVerifyNote(e.target.value)}
                                placeholder="Đã khớp sao kê Vietcombank"
                                className={inputCls}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            {detail.status === 'DEPOSIT_SUBMITTED' && (
                              <div className="flex flex-1 min-w-[240px] items-center gap-2">
                                <input
                                  type="text"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Lý do chưa nhận được / sai số tiền..."
                                  className={inputCls}
                                />
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={handleRejectDeposit}
                                  className="shrink-0 px-3 py-2 rounded-xl border border-amber-500/40 text-amber-700 text-xs font-bold hover:bg-amber-500/10 cursor-pointer"
                                >
                                  Yêu cầu kiểm tra lại
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={handleConfirmDeposit}
                              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-60"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Xác nhận đã nhận tiền cọc
                            </button>
                          </div>
                        </div>
                      ) : detail.status === 'SUBMITTED' || detail.status === 'QUOTED' || detail.status === 'REVISION_REQUESTED' ? (
                        <p className="text-xs text-muted italic">Khách hàng cần ký hợp đồng trước khi chuyển khoản đặt cọc.</p>
                      ) : null}
                    </div>

                    {/* Installation & Turnkey Direct Handover Section */}
                    <div className="rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-text flex items-center gap-2">
                          <Home className="w-4 h-4 text-primary" />
                          Bước 2 · Lắp đặt &amp; Bàn giao Trực tiếp (Tạo Nhà + Add Thiết bị không cần quét QR)
                        </h3>
                        {detail.status === 'DEPOSIT_CONFIRMED' && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleStartInstall}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Chuyển trạng thái Đang lắp đặt
                          </button>
                        )}
                      </div>

                      {['DEPOSIT_CONFIRMED', 'INSTALLING'].includes(detail.status) ? (
                        <div className="space-y-4">
                          {/* Handover Mode Toggle */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setHandoverMode('CREATE_NEW_HOME')}
                              className={`text-left rounded-2xl border p-3.5 cursor-pointer transition-all ${
                                handoverMode === 'CREATE_NEW_HOME'
                                  ? 'border-primary bg-primary/10'
                                  : 'border-line bg-sidebar/30 hover:border-primary/40'
                              }`}
                            >
                              <p className="text-xs font-bold text-text">1. Tạo Ngôi nhà mới &amp; Add trực tiếp thiết bị</p>
                              <p className="text-[11px] text-muted mt-1">
                                Tự tạo Nhà + các Phòng theo hợp đồng cho tài khoản khách, gán thẳng thiết bị vào phòng ở trạng thái ONLINE (vô hiệu hóa mã QR cũ).
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setHandoverMode('LINK_EXISTING_HOME')}
                              className={`text-left rounded-2xl border p-3.5 cursor-pointer transition-all ${
                                handoverMode === 'LINK_EXISTING_HOME'
                                  ? 'border-primary bg-primary/10'
                                  : 'border-line bg-sidebar/30 hover:border-primary/40'
                              }`}
                            >
                              <p className="text-xs font-bold text-text">2. Bàn giao vào Ngôi nhà sẵn có (Demo phần cứng thật)</p>
                              <p className="text-[11px] text-muted mt-1">
                                Cấp quyền Chủ nhà (OWNER) vào ngôi nhà đã gắn sẵn bo mạch ESP32/Camera thật (và có thể add thêm thiết bị trực tiếp).
                              </p>
                            </button>
                          </div>

                          {handoverMode === 'CREATE_NEW_HOME' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-muted mb-1">Tên Ngôi nhà tạo cho khách</label>
                                <input
                                  type="text"
                                  value={handoverHomeName}
                                  onChange={(e) => setHandoverHomeName(e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-muted mb-1">Địa chỉ ngôi nhà</label>
                                <input
                                  type="text"
                                  value={handoverHomeAddress}
                                  onChange={(e) => setHandoverHomeAddress(e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">
                                Chọn Ngôi nhà có sẵn để cấp quyền OWNER cho khách ({detail.customerEmail})
                              </label>
                              <select
                                value={existingHomeId}
                                onChange={(e) => setExistingHomeId(e.target.value)}
                                className={inputCls}
                              >
                                <option value="">-- Chọn ngôi nhà --</option>
                                {options?.existingHomes.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name} ({h.roomNames.length} phòng) {h.address ? `— ${h.address}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Direct Device Provisioning Table */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-text">
                                Thiết bị gán trực tiếp vào nhà không cần quét QR ({handoverDevices.length})
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setHandoverDevices((prev) => [
                                    ...prev,
                                    {
                                      contractItemId: null,
                                      existingDeviceId: null,
                                      catalogId: options?.catalogs[0]?.id ?? null,
                                      deviceName: options?.catalogs[0]?.name ?? 'Thiết bị HESTA',
                                      roomName: 'Phòng khách',
                                      nodeCode: '',
                                      localId: '',
                                      warrantyMonths: 12,
                                    },
                                  ])
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-line bg-sidebar/50 text-[11px] font-semibold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Thêm dòng thiết bị
                              </button>
                            </div>

                            {handoverMode === 'LINK_EXISTING_HOME' && handoverDevices.length > 0 && (
                              <div className="flex items-center justify-between text-[11px] text-muted bg-sidebar/30 px-3 py-2 rounded-xl">
                                <span>Nếu ngôi nhà mẫu đã có đủ thiết bị thật, bạn có thể bỏ trống danh sách gán thêm bên dưới.</span>
                                <button
                                  type="button"
                                  onClick={() => setHandoverDevices([])}
                                  className="text-rose-600 font-semibold hover:underline cursor-pointer shrink-0 ml-2"
                                >
                                  Xóa tất cả dòng thêm mới
                                </button>
                              </div>
                            )}

                            {handoverDevices.length > 0 && (
                              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 rounded-xl bg-sidebar/40 border border-line/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                                <div className="col-span-3">Tên thiết bị</div>
                                <div className="col-span-2">Phòng / khu vực</div>
                                <div className="col-span-3">Nguồn thiết bị</div>
                                <div className="col-span-2">Node ESP32</div>
                                <div className="col-span-1">localId</div>
                                <div className="col-span-1 text-right">Xóa</div>
                              </div>
                            )}

                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                              {handoverDevices.map((dev, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-2xl border border-line bg-sidebar/20 p-2.5 text-xs">
                                  <div className="col-span-12 sm:col-span-3">
                                    <input
                                      type="text"
                                      value={dev.deviceName || ''}
                                      onChange={(e) =>
                                        setHandoverDevices((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, deviceName: e.target.value } : x))
                                        )
                                      }
                                      placeholder="Tên hiển thị"
                                      className={inputCls}
                                    />
                                  </div>
                                  <div className="col-span-6 sm:col-span-2">
                                    <input
                                      type="text"
                                      value={dev.roomName}
                                      onChange={(e) =>
                                        setHandoverDevices((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, roomName: e.target.value } : x))
                                        )
                                      }
                                      placeholder="Tên phòng"
                                      className={inputCls}
                                    />
                                  </div>
                                  <div className="col-span-6 sm:col-span-3">
                                    <select
                                      value={dev.existingDeviceId || ''}
                                      onChange={(e) => {
                                        const val = e.target.value || null;
                                        const inv = options?.unclaimedDevices.find((u) => u.id === val);
                                        setHandoverDevices((prev) =>
                                          prev.map((x, i) =>
                                            i === idx
                                              ? {
                                                  ...x,
                                                  existingDeviceId: val,
                                                  nodeCode: inv?.nodeCode || x.nodeCode,
                                                }
                                              : x
                                          )
                                        );
                                      }}
                                      className={inputCls}
                                    >
                                      <option value="">Tạo mới từ Catalog (auto serial)</option>
                                      {options?.unclaimedDevices.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          Kho UNCLAIMED: {u.serialNumber} ({u.name})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="col-span-5 sm:col-span-2">
                                    <input
                                      type="text"
                                      value={dev.nodeCode || ''}
                                      onChange={(e) =>
                                        setHandoverDevices((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, nodeCode: e.target.value } : x))
                                        )
                                      }
                                      placeholder="Node (tùy chọn)"
                                      className={`${inputCls} font-mono`}
                                    />
                                  </div>
                                  <div className="col-span-5 sm:col-span-1">
                                    <input
                                      type="text"
                                      value={dev.localId || ''}
                                      onChange={(e) =>
                                        setHandoverDevices((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, localId: e.target.value } : x))
                                        )
                                      }
                                      placeholder="localId"
                                      className={`${inputCls} font-mono`}
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setHandoverDevices((prev) => prev.filter((_, i) => i !== idx))}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">Ghi chú nghiệm thu &amp; bàn giao</label>
                            <input
                              type="text"
                              value={handoverNote}
                              onChange={(e) => setHandoverNote(e.target.value)}
                              placeholder="VD: Đã kiểm thử toàn bộ đèn, cảm biến gas và camera AI hoạt động ổn định."
                              className={inputCls}
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={handleHandover}
                              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 shadow-md cursor-pointer disabled:opacity-60"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {submitting ? 'Đang bàn giao...' : 'Hoàn tất lắp đặt & Bàn giao hệ thống'}
                            </button>
                          </div>
                        </div>
                      ) : detail.status === 'HANDED_OVER' ? (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                          <p className="font-bold">✓ Hệ thống đã được bàn giao hoàn tất lúc {formatDateTime(detail.handedOverAt)}</p>
                          <p>Ngôi nhà liên kết: <strong>{detail.linkedHomeName || detail.homeName}</strong> · Số thiết bị bàn giao trực tiếp: <strong>{detail.provisionedDevices.length}</strong></p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted italic">
                          Cần hoàn tất xác nhận tiền đặt cọc ở Bước 1 trước khi triển khai lắp đặt và bàn giao.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: A4 PREVIEW */}
                {activeTab === 'preview' && previewContract && (
                  <div className="space-y-4">
                    <ContractDocumentView contract={previewContract} showPrintButton />
                  </div>
                )}

                {/* ALWAYS-VISIBLE NEGOTIATION & HISTORY LOG (ACROSS ALL TABS) */}
                <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Trao đổi trực tiếp &amp; Lịch sử hợp đồng ({detail.events.length})
                  </h3>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {detail.events.map((ev) => {
                      const isAlertEvent =
                        ev.eventType === 'REVISION_REQUESTED' || ev.eventType === 'DEPOSIT_REJECTED';
                      return (
                        <div
                          key={ev.id}
                          className={`rounded-2xl border p-3 text-xs ${
                            ev.eventType === 'REVISION_REQUESTED'
                              ? 'border-[#f59e0b] bg-[#fffbeb] mr-6'
                              : ev.eventType === 'DEPOSIT_REJECTED'
                              ? 'border-[#ef4444] bg-[#fef2f2] ml-6'
                              : ev.actorRole === 'ADMIN'
                              ? 'border-primary/25 bg-primary/5 ml-6'
                              : 'border-line bg-sidebar/30 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold ${isAlertEvent ? 'text-[#0f172a]' : 'text-text'}`}>
                              {ev.actorName || (ev.actorRole === 'ADMIN' ? 'HESTA Admin' : 'Khách hàng')}{' '}
                              <span className={`font-normal ${isAlertEvent ? 'text-[#475569]' : 'text-muted'}`}>
                                · {CONTRACT_EVENT_LABELS[ev.eventType]}
                              </span>
                            </span>
                            <span className={`text-[11px] ${isAlertEvent ? 'text-[#64748b]' : 'text-muted'}`}>
                              {formatDateTime(ev.createdAt)}
                            </span>
                          </div>
                          {ev.message && (
                            <p className={`mt-1 whitespace-pre-line ${isAlertEvent ? 'text-[#0f172a] font-medium' : 'text-text/90'}`}>
                              {ev.message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-line/60">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendComment();
                        }
                      }}
                      placeholder="Nhắn tin trao đổi với khách hàng về thiết bị, giá hoặc lịch lắp..."
                      className={inputCls}
                    />
                    <button
                      type="button"
                      disabled={submitting || !commentText.trim()}
                      onClick={handleSendComment}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Gửi
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <div className="print:hidden">
        <DashboardBottomNav activeItem="contracts" items={adminNavRailItems} />
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onProfileUpdate={onProfileUpdate}
      />
    </div>
  );
};
