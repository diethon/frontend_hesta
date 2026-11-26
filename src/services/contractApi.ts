import { apiClient } from './apiClient';
import type {
  AdminContractProposalRequest,
  AdminContractStats,
  AdminSurveyUpdateRequest,
  ContractDetail,
  ContractProvisionOptions,
  ContractSummary,
  CreateContractRequest,
  HandoverContractRequest,
} from '../types/contract';

// =========================================================================
// User Portal APIs
// =========================================================================

export const listMyContracts = async (): Promise<ContractSummary[]> => {
  const res = await apiClient.get('/contracts/my');
  return res.data.result ?? [];
};

export const getMyContract = async (contractId: string): Promise<ContractDetail> => {
  const res = await apiClient.get(`/contracts/${contractId}`);
  return res.data.result;
};

export const createUserContractRequest = async (
  payload: CreateContractRequest
): Promise<ContractDetail> => {
  const res = await apiClient.post('/contracts', payload);
  return res.data.result;
};

export const claimContractByToken = async (claimToken: string): Promise<ContractDetail> => {
  const res = await apiClient.post('/contracts/claim', { claimToken });
  return res.data.result;
};

export const requestContractRevision = async (
  contractId: string,
  message: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/contracts/${contractId}/request-revision`, { message });
  return res.data.result;
};

export const addUserContractComment = async (
  contractId: string,
  message: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/contracts/${contractId}/comments`, { message });
  return res.data.result;
};

export const signContract = async (
  contractId: string,
  payload: { signerName: string; signatureData: string; acceptedTerms: boolean }
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/contracts/${contractId}/sign`, payload);
  return res.data.result;
};

export const uploadDepositProofImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/contracts/upload-deposit-proof', formData, {
    headers: { 'Content-Type': undefined },
  });
  return res.data.result;
};

export const submitDepositProof = async (
  contractId: string,
  payload: { referenceCode?: string; proofUrl?: string; note?: string }
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/contracts/${contractId}/deposit-proof`, payload);
  return res.data.result;
};

export const cancelContractByUser = async (
  contractId: string,
  reason?: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/contracts/${contractId}/cancel`, { reason });
  return res.data.result;
};

// =========================================================================
// Admin Portal APIs
// =========================================================================

export const listAdminContracts = async (params?: {
  status?: string;
  keyword?: string;
}): Promise<ContractSummary[]> => {
  const res = await apiClient.get('/admin/contracts', { params });
  return res.data.result ?? [];
};

export const getAdminContractStats = async (): Promise<AdminContractStats> => {
  const res = await apiClient.get('/admin/contracts/stats');
  return res.data.result;
};

export const getAdminContract = async (contractId: string): Promise<ContractDetail> => {
  const res = await apiClient.get(`/admin/contracts/${contractId}`);
  return res.data.result;
};

export const getAdminProvisionOptions = async (): Promise<ContractProvisionOptions> => {
  const res = await apiClient.get('/admin/contracts/provision-options');
  return res.data.result;
};

export const updateAdminContractSurvey = async (
  contractId: string,
  payload: AdminSurveyUpdateRequest
): Promise<ContractDetail> => {
  const res = await apiClient.put(`/admin/contracts/${contractId}/survey`, payload);
  return res.data.result;
};

export const saveAdminContractProposal = async (
  contractId: string,
  payload: AdminContractProposalRequest
): Promise<ContractDetail> => {
  const res = await apiClient.put(`/admin/contracts/${contractId}/proposal`, payload);
  return res.data.result;
};

export const addAdminContractComment = async (
  contractId: string,
  message: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/comments`, { message });
  return res.data.result;
};

export const confirmAdminDeposit = async (
  contractId: string,
  payload?: { verifiedAmount?: number; referenceCode?: string; note?: string }
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/deposit/confirm`, payload ?? {});
  return res.data.result;
};

export const rejectAdminDeposit = async (
  contractId: string,
  reason: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/deposit/reject`, { reason });
  return res.data.result;
};

export const startAdminInstallation = async (
  contractId: string,
  note?: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/start-installation`, { note });
  return res.data.result;
};

export const handoverAdminContract = async (
  contractId: string,
  payload: HandoverContractRequest
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/handover`, payload);
  return res.data.result;
};

export const cancelAdminContract = async (
  contractId: string,
  reason?: string
): Promise<ContractDetail> => {
  const res = await apiClient.post(`/admin/contracts/${contractId}/cancel`, { reason });
  return res.data.result;
};
