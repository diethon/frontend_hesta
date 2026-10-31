import axios from 'axios';
import { apiClient } from './apiClient';

export type FallIncidentState =
  | 'DETECTED'
  | 'COUNTDOWN_ACTIVE'
  | 'FALSE_ALARM'
  | 'ACKNOWLEDGED'
  | 'ESCALATED_SOS'
  | 'RESOLVED'
  | 'CANCELLED';

export type FallIncidentType =
  | 'ACCIDENTAL_FALL'
  | 'SAFE_ZONE_IMPACT_FALL'
  | 'HEAD_SLUMP_SUSPECTED'
  | 'FAINT_SYNCOPE'
  | 'BED_ROLL_OFF'
  | 'CONTROLLED_REST';

export interface FallMetrics {
  v_norm?: number;
  accel_g?: number;
  jerk_g_per_sec?: number;
  spine_angle?: number;
  ptt_sec?: number;
  has_freefall?: boolean;
  has_impact?: boolean;
  motion_energy?: number;
}

export interface FallIncidentDTO {
  id: string;
  homeId?: string;
  deviceId?: string;
  roomName?: string;
  incidentType: FallIncidentType;
  state: FallIncidentState;
  confidenceScore: number;
  detectedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  countdownRemainingSec?: number;
  metrics?: FallMetrics;
  snapshotUrl?: string;
}

const AI_EDGE_BASE_URL = 'http://localhost:5000';

export const fallDetectionService = {
  // --- Backend Spring Boot APIs ---
  async getActiveIncidents(): Promise<FallIncidentDTO[]> {
    try {
      const response = await apiClient.get<FallIncidentDTO[]>('/emergency/fall/active');
      return response.data;
    } catch {
      return [];
    }
  },

  async dismissIncident(id: string, note = 'Người dùng bấm xác nhận an toàn (Tôi ổn)'): Promise<void> {
    try {
      await apiClient.post(`/emergency/fall/${id}/dismiss`, { note });
    } catch (e) {
      console.warn('Could not dismiss incident on backend:', e);
    }
    // Also notify local AI engine
    await this.dismissAiLocal();
  },

  async acknowledgeIncident(id: string): Promise<void> {
    try {
      await apiClient.post(`/emergency/fall/${id}/acknowledge`);
    } catch (e) {
      console.warn('Could not acknowledge incident on backend:', e);
    }
  },

  async resolveIncident(id: string, note = 'Đã cấp cứu an toàn'): Promise<void> {
    try {
      await apiClient.post(`/emergency/fall/${id}/resolve`, { note });
    } catch (e) {
      console.warn('Could not resolve incident on backend:', e);
    }
  },

  // --- Local AI Edge Engine APIs (Port 5000) ---
  async checkAiStatus(): Promise<{
    state: string;
    alert: boolean;
    incident_type: string;
    metrics: FallMetrics;
    safe_zone: string;
    fps: number;
  } | null> {
    try {
      const res = await axios.get(`${AI_EDGE_BASE_URL}/api/status`, { timeout: 1500 });
      return res.data;
    } catch {
      return null;
    }
  },

  async triggerDemoFall(): Promise<boolean> {
    try {
      const res = await axios.post(`${AI_EDGE_BASE_URL}/api/trigger_demo_fall`, {}, { timeout: 2000 });
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  },

  async dismissAiLocal(): Promise<boolean> {
    try {
      const res = await axios.post(`${AI_EDGE_BASE_URL}/api/dismiss`, {}, { timeout: 1500 });
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  },
};
