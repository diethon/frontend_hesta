import { apiClient } from './apiClient';
import { cachedFetch, invalidateCache } from './queryCache';

export const myHomesKey = (): string => 'homes:my';

export type AccessScope = 'ALL' | 'CUSTOM';
export type AccessLevel = 'NONE' | 'VIEW' | 'CONTROL';

export interface MemberRoomAccessDto {
  roomId: string;
  roomName?: string;
  level: AccessLevel;
}

export interface MemberDeviceAccessDto {
  deviceId: string;
  deviceName?: string;
  roomId?: string;
  roomName?: string;
  roomLevel?: AccessLevel;
  effectiveLevel?: AccessLevel;
  isOverride?: boolean;
  level?: AccessLevel;
}

export interface MemberAccessDetailResponse {
  memberUserId: string;
  memberId?: string;
  fullName: string;
  role: 'OWNER' | 'MEMBER';
  scope: AccessScope;
  version: string;
  readOnly: boolean;
  rooms: MemberRoomAccessDto[];
  devices: MemberDeviceAccessDto[];
}

export interface UpdateMemberAccessPayload {
  scope: AccessScope;
  version?: string;
  rooms: { roomId: string; level: AccessLevel }[];
  devices: { deviceId: string; level: AccessLevel }[];
}

export interface InvitationAccessPayload {
  scope: AccessScope;
  rooms: { roomId: string; level: AccessLevel }[];
  devices: { deviceId: string; level: AccessLevel }[];
}

export interface HomeMember {
  id: string;
  fullName: string;
  email?: string;
  avatarUrl: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
  accessScope?: AccessScope;
  accessRoomCount?: number;
  accessDeviceOverrideCount?: number;
  accessSummary?: {
    scope: AccessScope;
    allAccess: boolean;
    roomCount?: number;
    deviceCount?: number;
  };
}

export interface InvitationResponse {
  inviteCode: string;
  inviteToken: string;
  expiresAt: string;
  emailSent?: boolean;
}

export interface HomeSummary {
  homeId: string;
  homeName: string;
  role: 'OWNER' | 'MEMBER';
  accessScope?: AccessScope;
}

export const getHomeMembers = async (homeId: string): Promise<HomeMember[]> => {
  const response = await apiClient.get(`/homes/${homeId}/members`);
  return response.data.result;
};

export const getHomeRooms = async (homeId: string): Promise<{ id: string; name: string }[]> => {
  const response = await apiClient.get(`/homes/${homeId}/rooms`);
  return response.data.result;
};

export const generateInvitation = async (
  homeId: string,
  email?: string,
  access?: InvitationAccessPayload
): Promise<InvitationResponse> => {
  const url = email
    ? `/homes/${homeId}/invitations?email=${encodeURIComponent(email)}`
    : `/homes/${homeId}/invitations`;

  const payload = access ? { ...access, access } : undefined;
  const response = await apiClient.post(url, payload);
  return response.data.result;
};

export const updateMemberRole = async (homeId: string, memberId: string, role: 'OWNER' | 'MEMBER') => {
  const response = await apiClient.put(`/homes/${homeId}/members/${memberId}/role?role=${role}`);
  invalidateCache(myHomesKey());
  return response.data.result;
};

export const removeMember = async (homeId: string, memberId: string) => {
  const response = await apiClient.delete(`/homes/${homeId}/members/${memberId}`);
  invalidateCache(myHomesKey());
  return response.data.result;
};

export const getMemberAccess = async (
  homeId: string,
  userId: string
): Promise<MemberAccessDetailResponse> => {
  const response = await apiClient.get(`/homes/${homeId}/members/${userId}/access`);
  return response.data.result;
};

export const updateMemberAccess = async (
  homeId: string,
  userId: string,
  payload: UpdateMemberAccessPayload
): Promise<MemberAccessDetailResponse> => {
  const response = await apiClient.put(`/homes/${homeId}/members/${userId}/access`, payload);
  return response.data.result;
};

export const joinHome = async (codeOrToken: string) => {
  const response = await apiClient.post(`/homes/join?codeOrToken=${encodeURIComponent(codeOrToken)}`);
  invalidateCache(myHomesKey());
  return response.data.result;
};

export const getMyHomes = async (options?: { forceRefresh?: boolean }): Promise<HomeSummary[]> => {
  return cachedFetch(
    myHomesKey(),
    async () => {
      const response = await apiClient.get(`/homes/my-homes`);
      return response.data.result;
    },
    { ttlMs: 30_000, forceRefresh: options?.forceRefresh }
  );
};

export const createHome = async (name?: string) => {
  const response = await apiClient.post(`/homes`, { name: name || '' });
  invalidateCache(myHomesKey());
  return response.data.result;
};

export const updateHome = async (homeId: string, name: string): Promise<HomeSummary> => {
  const response = await apiClient.put(`/homes/${encodeURIComponent(homeId)}`, { name });
  invalidateCache(myHomesKey());
  return response.data.result;
};

export const createHomeRoom = async (homeId: string, name: string): Promise<void> => {
  await apiClient.post('/homes/' + encodeURIComponent(homeId) + '/rooms', { name });
  invalidateCache(`rooms:home:${homeId}`);
};
