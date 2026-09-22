import { apiClient } from './apiClient';

export interface HomeMember {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
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
}

export const getHomeMembers = async (homeId: string): Promise<HomeMember[]> => {
  const response = await apiClient.get(`/homes/${homeId}/members`);
  return response.data.result;
};

export const getHomeRooms = async (homeId: string): Promise<{ id: string, name: string }[]> => {
  const response = await apiClient.get(`/homes/${homeId}/rooms`);
  return response.data.result;
};

export const generateInvitation = async (homeId: string, email?: string): Promise<InvitationResponse> => {
  const url = email
    ? `/homes/${homeId}/invitations?email=${encodeURIComponent(email)}`
    : `/homes/${homeId}/invitations`;

  const response = await apiClient.post(url);
  return response.data.result;
};

export const updateMemberRole = async (homeId: string, memberId: string, role: 'OWNER' | 'MEMBER') => {
  const response = await apiClient.put(`/homes/${homeId}/members/${memberId}/role?role=${role}`);
  return response.data.result;
};

export const removeMember = async (homeId: string, memberId: string) => {
  const response = await apiClient.delete(`/homes/${homeId}/members/${memberId}`);
  return response.data.result;
};

export const joinHome = async (codeOrToken: string) => {
  const response = await apiClient.post(`/homes/join?codeOrToken=${encodeURIComponent(codeOrToken)}`);
  return response.data.result;
};

export const getMyHomes = async (): Promise<HomeSummary[]> => {
  const response = await apiClient.get(`/homes/my-homes`);
  return response.data.result;
};

export const createHome = async (name?: string) => {
  const response = await apiClient.post(`/homes`, { name: name || '' });
  return response.data.result;
};

export const createHomeRoom = async (homeId: string, name: string): Promise<void> => {
  await apiClient.post('/homes/' + encodeURIComponent(homeId) + '/rooms', { name });
};
