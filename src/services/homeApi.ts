import { notifySessionExpired } from './session';
import { API_BASE_URL } from './apiConfig';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

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
  const response = await fetch(`${API_BASE_URL}/homes/${homeId}/members`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi lấy danh sách thành viên');
  return resData.result;
};

export const generateInvitation = async (homeId: string, email?: string): Promise<InvitationResponse> => {
  const url = email 
    ? `${API_BASE_URL}/homes/${homeId}/invitations?email=${encodeURIComponent(email)}`
    : `${API_BASE_URL}/homes/${homeId}/invitations`;
    
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi tạo lời mời');
  return resData.result;
};

export const updateMemberRole = async (homeId: string, memberId: string, role: 'OWNER' | 'MEMBER') => {
  const response = await fetch(`${API_BASE_URL}/homes/${homeId}/members/${memberId}/role?role=${role}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi cập nhật quyền');
  return resData.result;
};

export const removeMember = async (homeId: string, memberId: string) => {
  const response = await fetch(`${API_BASE_URL}/homes/${homeId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi xóa thành viên');
  return resData.result;
};

export const joinHome = async (codeOrToken: string) => {
  const response = await fetch(`${API_BASE_URL}/homes/join?codeOrToken=${encodeURIComponent(codeOrToken)}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi vào nhà');
  return resData.result;
};

export const getMyHomes = async (): Promise<HomeSummary[]> => {
  const response = await fetch(`${API_BASE_URL}/homes/my-homes`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi lấy danh sách nhà');
  return resData.result;
};

export const createHome = async (name?: string) => {
  const response = await fetch(`${API_BASE_URL}/homes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name: name || '' }),
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Lỗi tạo nhà');
  return resData.result;
};
