import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  FileSignature,
  FileText,
  Home,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import type { ContractDetail, ContractSummary } from '../../types/contract';
import {
  addUserContractComment,
  claimContractByToken,
  createUserContractRequest,
  getMyContract,
  listMyContracts,
  requestContractRevision,
  signContract,
  submitDepositProof,
  uploadDepositProofImage,
} from '../../services/contractApi';
import { DashboardNavRail } from '../home/DashboardNavRail';
import { DashboardBottomNav } from '../home/DashboardBottomNav';
import { NotificationBell } from '../notification/NotificationBell';
import { notify } from '../ui/notify';
import { getErrorMessage } from '../../utils/errors';
import { ContractDocumentView } from './ContractDocumentView';
import { SignaturePad } from './SignaturePad';
import { SurveyProfileCard } from './SurveyProfileCard';
import {
  CONTRACT_EVENT_LABELS,
  CONTRACT_STATUS_META,
  CONTRACT_STEPS,
  formatDateTime,
  formatVnd,
} from './contractFormat';

interface UserContractsPageProps {
  user: UserResponse;
  onLogout: () => void;
}

export const UserContractsPage: React.FC<UserContractsPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const { contractId: routeContractId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const claimTokenParam = searchParams.get('contractToken');

  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(routeContractId ?? null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals & action inputs
  const [showSignModal, setShowSignModal] = useState(false);
  const [signerName, setSignerName] = useState(user.fullName || '');
  const [signatureData, setSignatureData] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newForm, setNewForm] = useState({
    customerName: user.fullName || '',
    customerPhone: user.phoneNumber || '',
    customerEmail: user.email || '',
    installAddress: '',
    homeName: '',
    homeType: 'APARTMENT',
    roomCount: 3,
    packageCode: 'SAFETY_EDGE_AI',
    customerNote: '',
  });

  // Deposit proof form
  const [depositRef, setDepositRef] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositProofUrl, setDepositProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofFileRef = useRef<HTMLInputElement | null>(null);

  // Comment input
  const [commentText, setCommentText] = useState('');

  const claimedOnceRef = useRef(false);

  const loadContracts = useCallback(async (preferredId?: string | null) => {
    setLoading(true);
    try {
      const list = await listMyContracts();
      setContracts(list);
      const nextId = preferredId || routeContractId || (list.length > 0 ? list[0].id : null);
      setSelectedId(nextId);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không tải được danh sách hợp đồng'), '');
    } finally {
      setLoading(false);
    }
  }, [routeContractId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await getMyContract(id);
      setDetail(res);
      setDepositRef(res.depositReferenceCode || '');
      setDepositNote(res.depositNote || '');
      setDepositProofUrl(res.depositProofUrl || '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không tải được chi tiết hợp đồng'), '');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Auto-claim contractToken coming from Landing Page
  useEffect(() => {
    if (claimTokenParam && !claimedOnceRef.current) {
      claimedOnceRef.current = true;
      void (async () => {
        try {
          const claimed = await claimContractByToken(claimTokenParam);
          notify.success(`Đã liên kết hồ sơ hợp đồng ${claimed.code} vào tài khoản của bạn!`, '');
          setSearchParams({}, { replace: true });
          await loadContracts(claimed.id);
          setDetail(claimed);
        } catch (err) {
          notify.error(getErrorMessage(err, 'Không thể liên kết mã hợp đồng'), '');
          setSearchParams({}, { replace: true });
          await loadContracts();
        }
      })();
      return;
    }
    void loadContracts();
  }, [claimTokenParam, loadContracts, setSearchParams]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.customerPhone.trim() || !newForm.installAddress.trim()) {
      notify.error('Vui lòng nhập số điện thoại và địa chỉ lắp đặt', '');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createUserContractRequest(newForm);
      notify.success(`Đã tạo hồ sơ yêu cầu lắp đặt ${created.code}`, '');
      setShowCreateModal(false);
      await loadContracts(created.id);
      setDetail(created);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không tạo được yêu cầu'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignSubmit = async () => {
    if (!detail) return;
    if (!acceptedTerms) {
      notify.error('Vui lòng xác nhận đã đọc và đồng ý điều khoản hợp đồng', '');
      return;
    }
    if (!signerName.trim() || !signatureData) {
      notify.error('Vui lòng nhập họ tên và vẽ chữ ký tay vào khung', '');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await signContract(detail.id, {
        signerName: signerName.trim(),
        signatureData,
        acceptedTerms: true,
      });
      setDetail(updated);
      setShowSignModal(false);
      setSignatureData('');
      setAcceptedTerms(false);
      notify.success('Ký hợp đồng điện tử thành công! Vui lòng chuyển khoản đặt cọc theo thông tin trên hợp đồng.', '');
      void loadContracts(updated.id);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể ký hợp đồng'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!detail || !revisionMessage.trim()) {
      notify.error('Vui lòng nêu rõ nội dung muốn điều chỉnh', '');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await requestContractRevision(detail.id, revisionMessage.trim());
      setDetail(updated);
      setShowRevisionModal(false);
      setRevisionMessage('');
      notify.success('Đã gửi yêu cầu điều chỉnh tới đội ngũ HESTA', '');
      void loadContracts(updated.id);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không gửi được yêu cầu điều chỉnh'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const url = await uploadDepositProofImage(file);
      setDepositProofUrl(url);
      notify.success('Đã tải ảnh biên lai chuyển khoản lên thành công', '');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không tải được ảnh biên lai'), '');
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    try {
      const updated = await submitDepositProof(detail.id, {
        referenceCode: depositRef.trim() || undefined,
        proofUrl: depositProofUrl.trim() || undefined,
        note: depositNote.trim() || undefined,
      });
      setDetail(updated);
      notify.success('Đã gửi xác nhận chuyển khoản cọc! Kế toán HESTA sẽ sớm đối soát.', '');
      void loadContracts(updated.id);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không gửi được xác nhận đặt cọc'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!detail || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const updated = await addUserContractComment(detail.id, commentText.trim());
      setDetail(updated);
      setCommentText('');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không gửi được tin nhắn'), '');
    } finally {
      setSubmitting(false);
    }
  };

  const copyValue = (value: string, label: string) => {
    void navigator.clipboard?.writeText(value);
    notify.success(`Đã sao chép ${label}`, '');
  };

  const inputCls =
    'w-full rounded-xl border border-line bg-sidebar/30 px-3.5 py-2.5 text-xs sm:text-sm text-text focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';

  const currentStep = detail ? CONTRACT_STATUS_META[detail.status].stepIndex : 0;

  return (
    <div className="app-shell min-h-screen bg-app text-text relative">
      <div className="mesh mesh-one pointer-events-none print:hidden" />
      <div className="mesh mesh-two pointer-events-none print:hidden" />

      <div className="print:hidden">
        <DashboardNavRail activeItem="contracts" user={user} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 pb-24 lg:pb-12">
        {/* TopBar */}
        <header className="print:hidden flex flex-wrap items-center justify-between gap-3 py-2 border-b border-line/60">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Hợp đồng Lắp đặt HESTA
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Theo dõi báo giá, thương lượng điều khoản, ký hợp đồng điện tử, xác nhận đặt cọc và nhận bàn giao nhà
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                void loadContracts(selectedId);
                if (selectedId) void loadDetail(selectedId);
              }}
              className="p-2 rounded-xl border border-line bg-surface hover:bg-surface-hover text-muted hover:text-text cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Đăng ký lắp đặt mới
            </button>
            <NotificationBell />
          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">
            Đang tải hồ sơ hợp đồng của bạn...
          </div>
        ) : contracts.length === 0 ? (
          <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-10 text-center space-y-4">
            <FileText className="w-12 h-12 text-primary/60 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text">Bạn chưa có hợp đồng lắp đặt nào</h2>
              <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
                Gửi yêu cầu khảo sát để đội ngũ HESTA tư vấn danh mục thiết bị phù hợp mặt bằng, gửi hợp đồng chi tiết và lắp đặt chìa khóa trao tay cho ngôi nhà của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-hover shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Đăng ký tư vấn &amp; Lắp đặt ngay
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Sidebar list if user has multiple contracts */}
            <aside className="print:hidden lg:col-span-3 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted px-1">
                Hồ sơ của bạn ({contracts.length})
              </p>
              {contracts.map((c) => {
                const meta = CONTRACT_STATUS_META[c.status];
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      navigate(`/contracts/${c.id}`, { replace: true });
                    }}
                    className={`w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      isSelected ? 'border-primary bg-primary/8 shadow-sm' : 'border-line bg-surface hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-text">{c.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                        {meta.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-text mt-1 truncate">{c.homeName || 'Nhà HESTA'}</p>
                    <p className="text-xs font-mono text-primary-hover font-bold mt-1.5">
                      {c.totalAmount > 0 ? formatVnd(c.totalAmount) : 'Chờ khảo sát & báo giá'}
                    </p>
                  </button>
                );
              })}
            </aside>

            {/* Detail Column */}
            <div className="lg:col-span-9 space-y-5">
              {detailLoading || !detail ? (
                <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">
                  Đang tải chi tiết hợp đồng...
                </div>
              ) : (
                <>
                  {/* 6-step Progress Stepper */}
                  <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-text">{detail.code}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${CONTRACT_STATUS_META[detail.status].badgeClass}`}>
                          {CONTRACT_STATUS_META[detail.status].label}
                        </span>
                      </div>
                      <span className="text-xs text-muted">Phiên bản v{detail.contractVersion}</span>
                    </div>

                    {detail.status !== 'CANCELLED' && (
                      <ol className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
                        {CONTRACT_STEPS.map((label, idx) => {
                          const done = idx < currentStep || detail.status === 'HANDED_OVER';
                          const active = idx === currentStep && detail.status !== 'HANDED_OVER';
                          return (
                            <li
                              key={label}
                              className={`rounded-xl border px-2.5 py-2 text-[11px] font-semibold flex items-center gap-1.5 ${
                                done
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : active
                                  ? 'border-primary bg-primary/12 text-primary-hover'
                                  : 'border-line bg-sidebar/30 text-muted'
                              }`}
                            >
                              <span className="font-mono">{idx + 1}.</span>
                              <span className="truncate">{label}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {/* STATUS-DRIVEN ACTION CALLOUTS */}
                    {(detail.status === 'SUBMITTED' || detail.status === 'SURVEYING') && (
                      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/8 p-4 flex items-start gap-3 text-xs">
                        <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-text">
                            {detail.status === 'SURVEYING'
                              ? 'Đội ngũ HESTA đang khảo sát kỹ thuật công trình của bạn'
                              : 'HESTA đã tiếp nhận hồ sơ yêu cầu tư vấn của bạn'}
                          </p>
                          <p className="text-muted mt-0.5">
                            Hợp đồng chính thức kèm danh mục mã thiết bị và đơn giá sẽ chỉ được phát hành sau khi kỹ thuật viên hoàn tất khảo sát vị trí lắp đặt, kiểm tra hạ tầng điện/Wi-Fi và thống nhất phương án cùng bạn.
                          </p>
                        </div>
                      </div>
                    )}

                    {detail.status === 'QUOTED' && (() => {
                      const quoteEvents = [...detail.events]
                        .filter((ev) => ev.eventType === 'QUOTE_SENT')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      const latestQuote = quoteEvents[0];
                      const prevQuote = quoteEvents[1];
                      const latestRev = [...detail.events]
                        .filter((ev) => ev.eventType === 'REVISION_REQUESTED')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                      const prevTotalRaw = prevQuote?.metadata?.totalAmount;
                      const prevTotal =
                        typeof prevTotalRaw === 'number'
                          ? prevTotalRaw
                          : typeof prevTotalRaw === 'string' && prevTotalRaw.trim() !== ''
                          ? Number(prevTotalRaw)
                          : null;
                      const priceDiff =
                        prevTotal !== null && Number.isFinite(prevTotal)
                          ? detail.totalAmount - prevTotal
                          : null;
                      const isRevised = detail.contractVersion > 1;

                      return (
                        <div
                          className={`rounded-2xl border-2 p-4 sm:p-5 space-y-4 shadow-xs ${
                            isRevised
                              ? 'border-[#3b82f6] bg-[#eff6ff]'
                              : 'border-[#6366f1]/45 bg-[#eef2ff]'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                                    isRevised
                                      ? 'bg-[#1d4ed8] text-white'
                                      : 'bg-[#4f46e5] text-white'
                                  }`}
                                >
                                  {isRevised
                                    ? `Đã cập nhật Hợp đồng v${detail.contractVersion}`
                                    : `Bản thảo Hợp đồng v${detail.contractVersion}`}
                                </span>
                                {latestQuote?.createdAt && (
                                  <span className="text-[11px] font-medium text-[#475569]">
                                    Gửi lúc {formatDateTime(latestQuote.createdAt)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm sm:text-base font-extrabold text-[#0f172a]">
                                {isRevised
                                  ? `HESTA đã điều chỉnh phương án & gửi lại Hợp đồng v${detail.contractVersion}`
                                  : `HESTA đã phát hành bản thảo Hợp đồng v${detail.contractVersion} sau khảo sát`}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowRevisionModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#0f172a] hover:bg-[#f8fafc] cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Yêu cầu điều chỉnh
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSignerName(user.fullName || detail.customerName);
                                  setShowSignModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-md cursor-pointer"
                              >
                                <FileSignature className="w-4 h-4" />
                                Đồng ý &amp; Ký hợp đồng điện tử
                              </button>
                            </div>
                          </div>

                          {/* Visual Revision Request vs Admin Response comparison */}
                          {(isRevised || detail.adminNote) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                              {isRevised && latestRev?.message && (
                                <div className="rounded-xl border border-[#f59e0b]/60 bg-[#fffbeb] p-3 space-y-1">
                                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#92400e]">
                                    Yêu cầu điều chỉnh trước đó của bạn
                                  </p>
                                  <p className="text-[#0f172a] font-medium whitespace-pre-line">
                                    “{latestRev.message}”
                                  </p>
                                </div>
                              )}
                              <div
                                className={`rounded-xl border border-[#93c5fd] bg-white p-3 space-y-1 ${
                                  !(isRevised && latestRev?.message) ? 'md:col-span-2' : ''
                                }`}
                              >
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#1d4ed8]">
                                  Phản hồi &amp; Cập nhật từ HESTA (v{detail.contractVersion})
                                </p>
                                <p className="text-[#0f172a] font-semibold whitespace-pre-line">
                                  {detail.adminNote ||
                                    latestQuote?.message ||
                                    'HESTA đã cập nhật lại bảng kê thiết bị và giá trị hợp đồng theo trao đổi.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Financial Snapshot Tiles (highlighting discount & price change vs previous version) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="rounded-xl border border-[#cbd5e1] bg-white p-2.5">
                              <p className="text-[11px] text-[#64748b]">
                                Thiết bị ({detail.items.length} hạng mục)
                              </p>
                              <p className="font-mono font-bold text-[#0f172a] mt-0.5">
                                {formatVnd(detail.subtotalAmount)}
                              </p>
                              <p className="text-[10px] text-[#64748b]">
                                + Thi công {formatVnd(detail.installationFee)}
                              </p>
                            </div>

                            <div
                              className={`rounded-xl border p-2.5 ${
                                detail.discountAmount > 0
                                  ? 'border-[#10b981] bg-[#ecfdf5]'
                                  : 'border-[#cbd5e1] bg-white'
                              }`}
                            >
                              <p
                                className={`text-[11px] font-semibold ${
                                  detail.discountAmount > 0 ? 'text-[#047857]' : 'text-[#64748b]'
                                }`}
                              >
                                Ưu đãi / Chiết khấu
                              </p>
                              <p
                                className={`font-mono font-extrabold mt-0.5 ${
                                  detail.discountAmount > 0 ? 'text-[#047857]' : 'text-[#64748b]'
                                }`}
                              >
                                {detail.discountAmount > 0
                                  ? `- ${formatVnd(detail.discountAmount)}`
                                  : '0 đ'}
                              </p>
                            </div>

                            <div className="rounded-xl border border-[#93c5fd] bg-white p-2.5">
                              <p className="text-[11px] font-semibold text-[#1d4ed8]">
                                Tổng giá trị v{detail.contractVersion}
                              </p>
                              <p className="font-mono font-extrabold text-sm text-[#0f172a] mt-0.5">
                                {formatVnd(detail.totalAmount)}
                              </p>
                              {priceDiff !== null && priceDiff !== 0 && prevTotal !== null && (
                                <p
                                  className={`text-[10px] font-bold mt-0.5 ${
                                    priceDiff < 0 ? 'text-[#059669]' : 'text-[#b45309]'
                                  }`}
                                >
                                  <span className="line-through text-[#94a3b8] font-normal mr-1">
                                    {formatVnd(prevTotal)}
                                  </span>
                                  {priceDiff < 0
                                    ? `↓ Giảm ${formatVnd(Math.abs(priceDiff))}`
                                    : `↑ Tăng ${formatVnd(priceDiff)}`}
                                </p>
                              )}
                            </div>

                            <div className="rounded-xl border border-[#fcd34d] bg-[#fffbeb] p-2.5">
                              <p className="text-[11px] font-semibold text-[#92400e]">
                                Đặt cọc ({detail.depositPercent}%)
                              </p>
                              <p className="font-mono font-extrabold text-[#b45309] mt-0.5">
                                {formatVnd(detail.depositAmount)}
                              </p>
                              <p className="text-[10px] text-[#92400e]">
                                Còn lại: {formatVnd(detail.remainingAmount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {detail.status === 'REVISION_REQUESTED' && (() => {
                      const latestRev = [...detail.events]
                        .filter((ev) => ev.eventType === 'REVISION_REQUESTED')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                      return (
                        <div className="rounded-2xl border-2 border-[#f59e0b] bg-[#fffbeb] p-4 text-xs text-[#78350f] space-y-1">
                          <p className="font-extrabold text-[#92400e]">
                            Đang chờ HESTA cập nhật hợp đồng{latestRev?.createdAt ? ` · ${formatDateTime(latestRev.createdAt)}` : ''}
                          </p>
                          {latestRev?.message && (
                            <p className="text-sm font-semibold text-[#0f172a] whitespace-pre-line">
                              Nội dung bạn đã gửi: “{latestRev.message}”
                            </p>
                          )}
                          <p className="text-[#92400e]">
                            Yêu cầu điều chỉnh của bạn đã được chuyển tới quản trị viên. Phiên bản mới sẽ được gửi lại ngay tại đây.
                          </p>
                        </div>
                      );
                    })()}

                    {/* PROMINENT DEPOSIT REJECTION BANNER AT TOP OF PAGE */}
                    {detail.status === 'AWAITING_DEPOSIT' && (() => {
                      const latestReject = [...detail.events]
                        .filter((ev) => ev.eventType === 'DEPOSIT_REJECTED')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                      if (!latestReject) return null;
                      return (
                        <div className="rounded-2xl border-2 border-[#ef4444] bg-[#fef2f2] p-4 flex items-start gap-3 shadow-xs">
                          <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
                          <div className="space-y-1 text-xs">
                            <p className="font-extrabold uppercase tracking-wide text-[#991b1b]">
                              HESTA yêu cầu kiểm tra lại giao dịch đặt cọc · {formatDateTime(latestReject.createdAt)}
                            </p>
                            <p className="text-sm font-bold text-[#7f1d1d] whitespace-pre-line">
                              {latestReject.message || 'Thông tin chuyển khoản đặt cọc chưa khớp với sao kê tài khoản công ty.'}
                            </p>
                            <p className="text-[#991b1b]">
                              Vui lòng đối chiếu lại số tiền, nội dung chuyển khoản hoặc ảnh biên lai, sau đó gửi lại xác nhận ngay bên dưới.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* DEPOSIT PAYMENT & PROOF PANEL */}
                    {(detail.status === 'AWAITING_DEPOSIT' || detail.status === 'DEPOSIT_SUBMITTED') && (
                      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/8 p-4 sm:p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-text flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-amber-600" />
                            {detail.status === 'DEPOSIT_SUBMITTED'
                              ? 'Đã gửi xác nhận đặt cọc · Đang chờ HESTA đối soát tài khoản'
                              : `Bước tiếp theo · Chuyển khoản đặt cọc ${detail.depositPercent}% (${formatVnd(detail.depositAmount)})`}
                          </h3>
                        </div>

                        <div className="rounded-2xl border border-amber-300/60 bg-white/80 dark:bg-surface p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <p className="text-muted">Ngân hàng thụ hưởng</p>
                            <p className="font-bold text-text">{detail.providerInfo.bankName}</p>
                          </div>
                          <div>
                            <p className="text-muted">Chủ tài khoản</p>
                            <p className="font-bold text-text">{detail.providerInfo.bankAccountHolder}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-muted">Số tài khoản</p>
                              <p className="font-mono font-extrabold text-sm text-text">{detail.providerInfo.bankAccountNumber}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyValue(detail.providerInfo.bankAccountNumber, 'số tài khoản')}
                              className="px-2.5 py-1 rounded-lg border border-line bg-surface text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Chép
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-muted">Nội dung chuyển khoản</p>
                              <p className="font-mono font-extrabold text-primary-hover">
                                {detail.depositTransferNote || `HESTA COC ${detail.code}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyValue(detail.depositTransferNote || `HESTA COC ${detail.code}`, 'nội dung CK')}
                              className="px-2.5 py-1 rounded-lg border border-line bg-surface text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Chép
                            </button>
                          </div>
                        </div>

                        <form onSubmit={handleSubmitDeposit} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">
                                Mã giao dịch chuyển khoản (nếu có)
                              </label>
                              <input
                                type="text"
                                value={depositRef}
                                onChange={(e) => setDepositRef(e.target.value)}
                                placeholder="VD: FT2633099182"
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted mb-1">
                                Ghi chú chuyển khoản
                              </label>
                              <input
                                type="text"
                                value={depositNote}
                                onChange={(e) => setDepositNote(e.target.value)}
                                placeholder="VD: Đã chuyển từ Vietcombank"
                                className={inputCls}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                ref={proofFileRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleUploadProof}
                                className="hidden"
                              />
                              <button
                                type="button"
                                disabled={uploadingProof}
                                onClick={() => proofFileRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-surface text-xs font-semibold text-text hover:bg-surface-hover cursor-pointer"
                              >
                                <UploadCloud className="w-4 h-4 text-primary" />
                                {uploadingProof ? 'Đang tải ảnh...' : depositProofUrl ? 'Đổi ảnh biên lai' : 'Đính kèm ảnh biên lai (tùy chọn)'}
                              </button>
                              {depositProofUrl && (
                                <a
                                  href={depositProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary font-semibold underline"
                                >
                                  Xem biên lai đã tải
                                </a>
                              )}
                            </div>

                            <button
                              type="submit"
                              disabled={submitting}
                              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-sm cursor-pointer disabled:opacity-60"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {detail.status === 'DEPOSIT_SUBMITTED'
                                ? 'Cập nhật thông tin chuyển cọc'
                                : 'Tôi đã chuyển khoản đặt cọc'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {(detail.status === 'DEPOSIT_CONFIRMED' || detail.status === 'INSTALLING') && (
                      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 flex items-start gap-3 text-xs">
                        <CheckCircle2 className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-text">
                            {detail.status === 'INSTALLING'
                              ? 'Kỹ thuật viên HESTA đang lắp đặt và cấu hình ngôi nhà của bạn'
                              : 'HESTA đã xác nhận nhận đủ tiền đặt cọc!'}
                          </p>
                          <p className="text-muted mt-0.5">
                            Lịch thi công dự kiến: <strong>{formatDateTime(detail.scheduledInstallStart || detail.preferredInstallDate)}</strong>. Sau khi hoàn tất đấu nối, Admin sẽ bàn giao trực tiếp Nhà và toàn bộ Thiết bị vào tài khoản của bạn.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* HANDED OVER SUCCESS HERO CTA -> CORE DEMO */}
                    {detail.status === 'HANDED_OVER' && (
                      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/12 p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Bàn giao thành công! Ngôi nhà của bạn đã sẵn sàng
                          </p>
                          <p className="text-xs text-text/80">
                            Ngôi nhà <strong>{detail.linkedHomeName || detail.homeName}</strong> cùng các thiết bị theo hợp đồng đã được kích hoạt trực tiếp vào tài khoản Chủ nhà của bạn (không cần quét QR).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(detail.homeId ? `/home?homeId=${encodeURIComponent(detail.homeId)}` : '/home')
                          }
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-lg cursor-pointer"
                        >
                          <Home className="w-4 h-4" />
                          Vào điều khiển ngôi nhà ngay
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Show Structured Consultation & Survey Dossier BEFORE formal quote; show Official A4 Contract FROM QUOTED onward */}
                  {detail.status === 'SUBMITTED' || detail.status === 'SURVEYING' ? (
                    <SurveyProfileCard contract={detail} mode="customer" />
                  ) : (
                    <ContractDocumentView contract={detail} showPrintButton />
                  )}

                  {/* Negotiation Timeline & Direct Messaging */}
                  <div className="print:hidden rounded-3xl border border-line bg-surface/95 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-text flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Trao đổi trực tiếp &amp; Lịch sử hợp đồng ({detail.events.length})
                    </h3>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {detail.events.map((ev) => (
                        <div
                          key={ev.id}
                          className={`rounded-2xl border p-3 text-xs ${
                            ev.actorRole === 'CUSTOMER'
                              ? 'border-primary/25 bg-primary/5 ml-6'
                              : 'border-line bg-sidebar/30 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-text">
                              {ev.actorName || (ev.actorRole === 'ADMIN' ? 'HESTA' : 'Bạn')}{' '}
                              <span className="font-normal text-muted">· {CONTRACT_EVENT_LABELS[ev.eventType]}</span>
                            </span>
                            <span className="text-[11px] text-muted">{formatDateTime(ev.createdAt)}</span>
                          </div>
                          {ev.message && <p className="mt-1 text-text/90 whitespace-pre-line">{ev.message}</p>}
                        </div>
                      ))}
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
                        placeholder="Nhắn tin trao đổi với quản trị viên HESTA..."
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
            </div>
          </div>
        )}
      </main>

      <div className="print:hidden">
        <DashboardBottomNav activeItem="contracts" />
      </div>

      {/* E-SIGN MODAL */}
      {showSignModal && detail && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Ký hợp đồng điện tử {detail.code}</h3>
                <p className="text-xs text-muted">Tổng giá trị {formatVnd(detail.totalAmount)} · Đặt cọc {detail.depositPercent}% ({formatVnd(detail.depositAmount)})</p>
              </div>
              <button type="button" onClick={() => setShowSignModal(false)} className="p-1.5 rounded-full hover:bg-sidebar cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-text mb-1">Họ và tên người ký (Bên B)</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className={inputCls}
              />
            </div>

            <SignaturePad onChange={setSignatureData} />

            <label className="flex items-start gap-2.5 text-xs text-text cursor-pointer rounded-xl border border-line bg-sidebar/30 p-3">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                Tôi xác nhận đã đọc kỹ bảng kê thiết bị, tiến độ đặt cọc, thông tin tài khoản thụ hưởng và đồng ý với toàn bộ các điều khoản của Hợp đồng phiên bản <strong>v{detail.contractVersion}</strong>.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold cursor-pointer"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSignSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover cursor-pointer disabled:opacity-60"
              >
                <FileSignature className="w-4 h-4" />
                {submitting ? 'Đang xác nhận...' : 'Xác nhận ký hợp đồng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION REQUEST MODAL */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">Yêu cầu điều chỉnh hợp đồng</h3>
              <button type="button" onClick={() => setShowRevisionModal(false)} className="p-1.5 rounded-full hover:bg-sidebar cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={revisionMessage}
              onChange={(e) => setRevisionMessage(e.target.value)}
              placeholder="VD: Nhờ HESTA thêm 1 cảm biến gas cho bếp và dời lịch lắp sang chiều thứ 7..."
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowRevisionModal(false)} className="px-4 py-2 rounded-xl border border-line text-xs font-semibold cursor-pointer">
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRequestRevision}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 cursor-pointer"
              >
                Gửi yêu cầu chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CONTRACT MODAL (for existing logged-in users) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRequest}
            className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">Đăng ký khảo sát &amp; Lập hợp đồng lắp đặt</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-full hover:bg-sidebar cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Họ tên *</label>
                <input required value={newForm.customerName} onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Số điện thoại *</label>
                <input required value={newForm.customerPhone} onChange={(e) => setNewForm({ ...newForm, customerPhone: e.target.value })} placeholder="090..." className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Địa chỉ lắp đặt *</label>
              <input required value={newForm.installAddress} onChange={(e) => setNewForm({ ...newForm, installAddress: e.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện..." className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Tên ngôi nhà mong muốn</label>
                <input value={newForm.homeName} onChange={(e) => setNewForm({ ...newForm, homeName: e.target.value })} placeholder="VD: Căn hộ Masteri" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Gói quan tâm</label>
                <select value={newForm.packageCode} onChange={(e) => setNewForm({ ...newForm, packageCode: e.target.value })} className={inputCls}>
                  <option value="STARTER_HOME">Gói Khởi Đầu (Căn hộ)</option>
                  <option value="SAFETY_EDGE_AI">Gói An Toàn &amp; Edge AI</option>
                  <option value="CUSTOM_HOME">Gói Thiết Kế Riêng</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Ghi chú nhu cầu &amp; thời gian lắp mong muốn</label>
              <textarea rows={3} value={newForm.customerNote} onChange={(e) => setNewForm({ ...newForm, customerNote: e.target.value })} placeholder="VD: Muốn lắp đèn phòng khách, cảm biến gas bếp và camera té ngã phòng ông bà..." className={inputCls} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl border border-line text-xs font-semibold cursor-pointer">
                Hủy
              </button>
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover cursor-pointer">
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu lập hợp đồng'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
