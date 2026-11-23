export type MaintenanceStatus =
  | 'SUBMITTED'
  | 'SCHEDULED'
  | 'RESCHEDULE_REQUESTED'
  | 'INSPECTING'
  | 'QUOTED'
  | 'REPAIRING'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REJECTED';

export type MaintenancePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type MaintenanceTicketSource = 'MANUAL' | 'CHATBOT';
export type MaintenanceDiagnosisQuality = 'HELPFUL' | 'PARTIAL' | 'MISLEADING';
export type MaintenanceItemType = 'PART' | 'LABOR' | 'FEE';
export type MaintenanceOutcome = 'FIXED' | 'REPLACED' | 'NOT_REPAIRABLE' | 'NO_ISSUE_FOUND';

export interface MaintenanceAttachment {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt?: string;
}

export interface UploadedMaintenanceAttachment {
  attachmentId: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt?: string;
}

export interface TimeSlot {
  id?: string;
  startAt: string;
  endAt: string;
}

export interface MaintenanceDeviceLine {
  id: string;
  deviceId?: string | null;
  deviceName: string;
  deviceType?: string;
  model?: string;
  serialNumber?: string;
  roomName?: string;
  issueNote?: string;
  sourceAnomalyId?: string | null;
  outcome?: MaintenanceOutcome | null;
  outcomeNote?: string | null;
}

export interface MaintenanceQuoteItem {
  id: string;
  ticketDeviceId?: string | null;
  itemType: MaintenanceItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface MaintenanceQuote {
  findings: string;
  warrantyMonths?: number | null;
  warrantyUntil?: string | null;
  total: number;
  currency: string;
  items: MaintenanceQuoteItem[];
  submittedAt: string;
  decision?: 'APPROVED' | 'REJECTED' | null;
  decidedAt?: string | null;
}

export interface MaintenanceEvent {
  id: string;
  actorName?: string | null;
  actorRole: 'USER' | 'ADMIN';
  fromStatus?: MaintenanceStatus | null;
  toStatus: MaintenanceStatus;
  note?: string | null;
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  code: string;
  homeId: string;
  homeName?: string;
  homeAddress?: string;
  title: string;
  description?: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  source?: MaintenanceTicketSource;
  diagnosisSummary?: string | null;
  imageObservations?: string | null;
  chatConversationId?: string | null;
  diagnosisQuality?: MaintenanceDiagnosisQuality | null;
  diagnosisQualityNote?: string | null;
  createdBy?: { id: string; fullName: string; email: string; phoneNumber?: string };
  contactPhone?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  scheduleConfirmed: boolean;
  adminNote?: string | null;
  cancelReason?: string | null;
  devices: MaintenanceDeviceLine[];
  slots: TimeSlot[];
  quote?: MaintenanceQuote | null;
  completedAt?: string | null;
  rating?: number | null;
  feedback?: string | null;
  events: MaintenanceEvent[];
  attachments?: MaintenanceAttachment[];
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceTicketSummary {
  id: string;
  code: string;
  homeId: string;
  homeName?: string;
  title: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  source?: MaintenanceTicketSource;
  deviceNames: string[];
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  scheduleConfirmed: boolean;
  quoteTotal?: number | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface CreateMaintenanceTicketPayload {
  title: string;
  description?: string;
  contactPhone?: string;
  priority?: MaintenancePriority;
  devices: Array<{ deviceId: string; issueNote?: string; anomalyId?: string }>;
  slots: TimeSlot[];
  attachmentIds?: string[];
}

export interface QuotePayload {
  findings: string;
  warrantyMonths?: number | null;
  items: Array<{ ticketDeviceId?: string | null; itemType: MaintenanceItemType; description: string; quantity: number; unitPrice: number }>;
}

export interface CompletePayload {
  devices: Array<{ ticketDeviceId: string; outcome: MaintenanceOutcome; note?: string }>;
  note?: string;
}

// ---- Maintenance Diagnostic Assistant ----

export type MaintenanceChatState =
  | 'SELECT_DEVICE'
  | 'SHOW_STATUS'
  | 'SELECT_SYMPTOM'
  | 'GUIDED_STEP'
  | 'RESOLVED'
  | 'ESCALATE'
  | 'DRAFT_TICKET'
  | 'PICK_SLOTS'
  | 'CONFIRM'
  | 'TICKET_CREATED';

export type MaintenanceChatStatus = 'ACTIVE' | 'RESOLVED' | 'ESCALATED' | 'ABANDONED';
export type MaintenanceChatRole = 'USER' | 'ASSISTANT';

export interface AssistantTextBlock {
  type: 'text';
  text: string;
  tone?: 'default' | 'info' | 'warn' | 'danger' | 'ok';
  aiGenerated?: boolean;
}

export interface AssistantQuickReplyOption {
  value: string;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
}

export interface AssistantQuickRepliesBlock {
  type: 'quick_replies';
  options: AssistantQuickReplyOption[];
}

export interface AssistantDeviceCardBlock {
  type: 'device_card';
  deviceId: string;
  name: string;
  deviceType?: string;
  model?: string | null;
  roomName?: string | null;
  status: string;
  lastSeen?: string | null;
  offlineDurationLabel?: string | null;
  currentStateSummary?: string | null;
  healthPercent?: number | null;
  switchCycles?: number | null;
  chatteringWarning?: boolean;
  openAnomalies?: Array<{ id: string; type?: string; severity?: string; reason?: string }>;
}

export interface AssistantDevicePickerBlock {
  type: 'device_picker';
  devices: Array<{
    deviceId: string;
    name: string;
    deviceType?: string;
    roomName?: string | null;
    model?: string | null;
    status: string;
  }>;
}

export interface AssistantSlotPickerBlock {
  type: 'slot_picker';
  prompt: string;
}

export interface AssistantTicketSummaryBlock {
  type: 'ticket_summary';
  title: string;
  description?: string | null;
  priority: MaintenancePriority;
  safetyFlag: boolean;
  deviceId: string;
  deviceName: string;
  roomName?: string | null;
  diagnosisSummary: string;
  aiSummary?: string | null;
  extractedDetails?: string | null;
  imageObservations?: string | null;
  suggestedAttachments?: Array<{ attachmentId: string; url: string }>;
}

export interface AssistantPrivacyNoticeBlock {
  type: 'privacy_notice';
  attachmentId: string;
  text: string;
  acceptValue: string;
  declineValue: string;
}

export interface AssistantImageAnalysisBlock {
  type: 'image_analysis';
  attachmentId: string;
  decision: string;
  imageQuality?: string | null;
  observations: string[];
  staticAdvice: string;
  telemetryMismatch?: boolean;
  suggestDeleteAttachment?: boolean;
  aiGenerated?: boolean;
  suspectedSymptomId?: string | null;
  suspectedSymptomLabel?: string | null;
}

export interface AssistantTicketCreatedBlock {
  type: 'ticket_created';
  ticketId: string;
  code: string;
  title: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  alreadyExisted?: boolean;
}

export interface AssistantImageBlock {
  type: 'image';
  attachmentId?: string;
  url: string;
  caption?: string;
}

export type AssistantBlock =
  | AssistantTextBlock
  | AssistantImageBlock
  | AssistantQuickRepliesBlock
  | AssistantDeviceCardBlock
  | AssistantDevicePickerBlock
  | AssistantSlotPickerBlock
  | AssistantTicketSummaryBlock
  | AssistantTicketCreatedBlock
  | AssistantPrivacyNoticeBlock
  | AssistantImageAnalysisBlock;

export interface AssistantMessage {
  id: string;
  role: MaintenanceChatRole;
  blocks: AssistantBlock[];
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  homeId: string;
  deviceId?: string | null;
  state: MaintenanceChatState;
  status: MaintenanceChatStatus;
  ticketId?: string | null;
  manualFallbackNote?: string | null;
  aiTextEnabled?: boolean;
  aiImageEnabled?: boolean;
  userRating?: number | null;
  userFeedbackNote?: string | null;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AssistantReply {
  conversationId: string;
  state: MaintenanceChatState;
  status: MaintenanceChatStatus;
  ticketId?: string | null;
  manualFallbackNote?: string | null;
  aiTextEnabled?: boolean;
  aiImageEnabled?: boolean;
  blocks: AssistantBlock[];
}

export interface AdminAssistantStatus {
  aiConfigEnabled: boolean;
  killSwitchActive: boolean;
}

export interface AdminAssistantMetrics {
  from: string;
  to: string;
  conversationsByStatus: Record<string, number>;
  selfResolutionRate: number;
  ticketsBySource: Record<string, number>;
  chatbotTicketsByQuality: Record<string, number>;
  misleadingRate: number;
  deviceTypeDistribution: Array<{ key: string; count: number }>;
  topSymptoms: Array<{ key: string; count: number }>;
  llmTotalAttempts: number;
  llmFallbackCount: number;
  llmFallbackRate: number;
  llmLowConfidenceCount: number;
  llmLowConfidenceRate: number;
  avgTokensPerConversation: number;
  totalTokens: number;
  tokensByDay: Array<{ day: string; tokens: number }>;
  estimatedCostUsd: number | null;
  safetyLayer1Count: number;
  safetyLayer2Count: number;
  cautionPromptedCount: number;
  cautionAnswers: Record<string, number>;
  imagesAnalyzedCount: number;
  imageRetakeCount: number;
  imageRetakeRate: number;
  imagePrivacyRejectCount: number;
  imagePrivacyRejectRate: number;
  userRatingPositive: number;
  userRatingNegative: number;
  userPositiveRate: number;
  homeWideOutageCount: number;
  alerts: {
    highMisleadingRate: boolean;
    highFallbackRate: boolean;
    safetySpike: boolean;
    safetyCurrentCount: number;
    safetyPreviousCount: number;
  };
}

export interface AssistantConfirmTicketPayload {
  slots: TimeSlot[];
  contactPhone?: string;
  attachmentIds?: string[];
  extraNote?: string;
  editedSummary?: string;
}

export interface AssistantConfirmTicketResponse {
  conversationId: string;
  state: MaintenanceChatState;
  status: MaintenanceChatStatus;
  ticket: MaintenanceTicket;
  blocks: AssistantBlock[];
}
