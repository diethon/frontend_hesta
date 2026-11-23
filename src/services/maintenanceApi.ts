import { featureRequest } from './featureApi';
import { notifySessionExpired } from './session';
import type {
  AdminAssistantMetrics,
  AdminAssistantStatus,
  AssistantConfirmTicketPayload,
  AssistantConfirmTicketResponse,
  AssistantConversation,
  AssistantReply,
  CompletePayload,
  CreateMaintenanceTicketPayload,
  MaintenanceDiagnosisQuality,
  MaintenancePage,
  MaintenanceStatus,
  MaintenanceTicket,
  MaintenanceTicketSummary,
  QuotePayload,
  TimeSlot,
  UploadedMaintenanceAttachment,
} from '../types/maintenance';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

interface ListQuery {
  page?: number;
  size?: number;
  status?: MaintenanceStatus;
  deviceId?: string;
  from?: string;
  to?: string;
}

const toQuery = (params: ListQuery) => {
  const search = new URLSearchParams();
  Object.entries({ page: 0, size: 20, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return `?${search.toString()}`;
};

const post = <T>(path: string, body?: unknown) =>
  featureRequest<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

const home = (homeId: string) => `/homes/${encodeURIComponent(homeId)}/maintenance-tickets`;

// ---- Home user ----

export const createMaintenanceTicket = (homeId: string, payload: CreateMaintenanceTicketPayload) =>
  post<MaintenanceTicket>(home(homeId), payload);

export async function uploadMaintenanceAttachment(homeId: string, file: File): Promise<UploadedMaintenanceAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/homes/${encodeURIComponent(homeId)}/maintenance-attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
    body: formData,
  });
  if (response.status === 401) notifySessionExpired();
  const payload = await response.json() as { code: number; message?: string; result: UploadedMaintenanceAttachment };
  if (!response.ok) throw new Error(payload.message || 'Không tải được ảnh đính kèm.');
  return payload.result;
}

export const listMaintenanceTickets = (homeId: string, query: ListQuery = {}) =>
  featureRequest<MaintenancePage<MaintenanceTicketSummary>>(`${home(homeId)}${toQuery(query)}`);

export const getMaintenanceTicket = (homeId: string, ticketId: string) =>
  featureRequest<MaintenanceTicket>(`${home(homeId)}/${ticketId}`);

export const cancelMaintenanceTicket = (homeId: string, ticketId: string, note?: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/cancel`, { note });

export const confirmMaintenanceSchedule = (homeId: string, ticketId: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/schedule/confirm`);

export const rescheduleMaintenance = (homeId: string, ticketId: string, slots: TimeSlot[], note?: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/schedule/reschedule`, { slots, note });

export const approveMaintenanceQuote = (homeId: string, ticketId: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/quote/approve`);

export const rejectMaintenanceQuote = (homeId: string, ticketId: string, note?: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/quote/reject`, { note });

export const sendMaintenanceFeedback = (homeId: string, ticketId: string, rating: number, comment?: string) =>
  post<MaintenanceTicket>(`${home(homeId)}/${ticketId}/feedback`, { rating, comment });

// ---- Platform admin ----

const admin = '/admin/maintenance-tickets';

export const adminListMaintenanceTickets = (query: ListQuery = {}) =>
  featureRequest<MaintenancePage<MaintenanceTicketSummary>>(`${admin}${toQuery(query)}`);

export const adminGetMaintenanceTicket = (ticketId: string) =>
  featureRequest<MaintenanceTicket>(`${admin}/${ticketId}`);

export const adminScheduleMaintenance = (ticketId: string, startAt: string, endAt: string, note?: string) =>
  post<MaintenanceTicket>(`${admin}/${ticketId}/schedule`, { startAt, endAt, note });

export const adminStartInspection = (ticketId: string, note?: string) =>
  post<MaintenanceTicket>(`${admin}/${ticketId}/start-inspection`, { note });

export const adminSubmitQuote = (ticketId: string, payload: QuotePayload) =>
  featureRequest<MaintenanceTicket>(`${admin}/${ticketId}/quote`, { method: 'PUT', body: JSON.stringify(payload) });

export const adminCompleteMaintenance = (ticketId: string, payload: CompletePayload) =>
  post<MaintenanceTicket>(`${admin}/${ticketId}/complete`, payload);

export const adminRejectMaintenance = (ticketId: string, note?: string) =>
  post<MaintenanceTicket>(`${admin}/${ticketId}/reject`, { note });

// ---- Maintenance Diagnostic Assistant ----

const assistant = (homeId: string) => `/homes/${encodeURIComponent(homeId)}/maintenance-assistant`;

export const startMaintenanceAssistant = (homeId: string, deviceId?: string) =>
  post<AssistantConversation>(`${assistant(homeId)}/conversations`, deviceId ? { deviceId } : {});

export const getActiveMaintenanceAssistant = (homeId: string) =>
  featureRequest<AssistantConversation | null>(`${assistant(homeId)}/conversations/active`);

export const getMaintenanceAssistantConversation = (homeId: string, conversationId: string) =>
  featureRequest<AssistantConversation>(`${assistant(homeId)}/conversations/${conversationId}`);

export const sendMaintenanceAssistantMessage = (
  homeId: string,
  conversationId: string,
  type: 'QUICK_REPLY' | 'TEXT' | 'IMAGE',
  value: string,
  note?: string,
) => post<AssistantReply>(`${assistant(homeId)}/conversations/${conversationId}/messages`, note ? { type, value, note } : { type, value });

export const confirmMaintenanceAssistantTicket = (
  homeId: string,
  conversationId: string,
  payload: AssistantConfirmTicketPayload,
) => post<AssistantConfirmTicketResponse>(`${assistant(homeId)}/conversations/${conversationId}/confirm-ticket`, payload);

export const abandonMaintenanceAssistant = (homeId: string, conversationId: string) =>
  post<void>(`${assistant(homeId)}/conversations/${conversationId}/abandon`);

export const submitMaintenanceAssistantFeedback = (
  homeId: string,
  conversationId: string,
  rating: 1 | 5,
  note?: string,
) => post<{ conversationId: string; userRating: number; userFeedbackNote?: string | null }>(
  `${assistant(homeId)}/conversations/${conversationId}/feedback`,
  { rating, note },
);

export const deleteMaintenanceAssistantConversation = (homeId: string, conversationId: string) =>
  featureRequest<void>(`${assistant(homeId)}/conversations/${conversationId}`, { method: 'DELETE' });

export const deleteMaintenanceAttachment = (homeId: string, attachmentId: string) =>
  featureRequest<void>(`/homes/${encodeURIComponent(homeId)}/maintenance-attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });

export const adminRateDiagnosisQuality = (ticketId: string, quality: MaintenanceDiagnosisQuality, note?: string) =>
  featureRequest<MaintenanceTicket>(`${admin}/${ticketId}/diagnosis-quality`, {
    method: 'PUT',
    body: JSON.stringify({ quality, note }),
  });

export const adminGetAssistantStatus = () =>
  featureRequest<AdminAssistantStatus>('/admin/maintenance-assistant/status');

export const adminSetAssistantKillSwitch = (killSwitchActive: boolean) =>
  featureRequest<{ killSwitchActive: boolean }>('/admin/maintenance-assistant/kill-switch', {
    method: 'PUT',
    body: JSON.stringify({ killSwitchActive }),
  });

export const adminGetAssistantMetrics = (from?: string, to?: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return featureRequest<AdminAssistantMetrics>(`/admin/maintenance-assistant/metrics${suffix}`);
};

export const getMaintenanceEmailPreference = () =>
  featureRequest<{ maintenanceEmailEnabled: boolean }>('/users/me/maintenance-email-preference');

export const updateMaintenanceEmailPreference = (enabled: boolean) =>
  featureRequest<{ maintenanceEmailEnabled: boolean }>('/users/me/maintenance-email-preference', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
