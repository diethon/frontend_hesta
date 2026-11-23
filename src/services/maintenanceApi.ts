import { featureRequest } from './featureApi';
import type {
  CompletePayload,
  CreateMaintenanceTicketPayload,
  MaintenancePage,
  MaintenanceStatus,
  MaintenanceTicket,
  MaintenanceTicketSummary,
  QuotePayload,
  TimeSlot,
} from '../types/maintenance';

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
