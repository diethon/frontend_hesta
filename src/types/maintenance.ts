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
export type MaintenanceItemType = 'PART' | 'LABOR' | 'FEE';
export type MaintenanceOutcome = 'FIXED' | 'REPLACED' | 'NOT_REPAIRABLE' | 'NO_ISSUE_FOUND';

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
