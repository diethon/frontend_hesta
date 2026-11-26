export type InstallationContractStatus =
  | 'SUBMITTED'
  | 'SURVEYING'
  | 'QUOTED'
  | 'REVISION_REQUESTED'
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_SUBMITTED'
  | 'DEPOSIT_CONFIRMED'
  | 'INSTALLING'
  | 'HANDED_OVER'
  | 'CANCELLED';

export type ContractActorRole = 'CUSTOMER' | 'ADMIN' | 'SYSTEM';

export type ContractEventType =
  | 'SUBMITTED'
  | 'CLAIMED'
  | 'SURVEY_UPDATED'
  | 'QUOTE_SENT'
  | 'REVISION_REQUESTED'
  | 'COMMENT'
  | 'SIGNED'
  | 'DEPOSIT_SUBMITTED'
  | 'DEPOSIT_CONFIRMED'
  | 'DEPOSIT_REJECTED'
  | 'INSTALLING'
  | 'HANDED_OVER'
  | 'CANCELLED';

export interface RequestedDeviceNeed {
  category: string;
  label: string;
  locations?: string[];
  estimatedQuantity?: string;
  purposes?: string[];
  needsConsultation?: boolean;
  note?: string;
}

export interface SurveyChecklistItem {
  id: string;
  label: string;
  category?: string;
  confirmed: boolean;
}

export interface SurveyFlags {
  quantityConfirmed?: boolean;
  locationConfirmed?: boolean;
  compatibilityConfirmed?: boolean;
  quoteReady?: boolean;
  [key: string]: boolean | undefined;
}

export interface AdminSurveyUpdateRequest {
  floorCount?: number;
  bedroomCount?: number;
  buildingCondition?: string;
  desiredTimeline?: string;
  requestedDevices?: RequestedDeviceNeed[];
  surveyChecklist?: SurveyChecklistItem[];
  surveyFlags?: SurveyFlags;
  surveyNotes?: string;
  markCompleted?: boolean;
}

export interface BankInfoSnapshot {
  providerCompanyName: string;
  providerTaxCode: string;
  providerAddress: string;
  providerRepresentative: string;
  providerHotline: string;
  providerEmail: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}

export interface ContractTemplateSpec {
  code: string;
  name: string;
  subtitle: string;
  termsTitle: string;
  defaultDepositPercent: number;
  defaultInstallationFee: number;
  termsContent: string;
}

export interface PublicCatalogItem {
  id: string;
  name: string;
  deviceType: string;
  modelCode: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  unitPrice: number;
  warrantyMonths: number;
}

export interface ContractItemDto {
  id: string;
  catalogId?: string | null;
  deviceName: string;
  modelCode?: string | null;
  deviceType?: string | null;
  roomLabel?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warrantyMonths: number;
  sortOrder: number;
}

export interface ProvisionedDeviceDto {
  id: string;
  contractItemId?: string | null;
  deviceId: string;
  roomId?: string | null;
  deviceName: string;
  serialNumber?: string | null;
  roomName?: string | null;
  warrantyMonths: number;
  warrantyExpiresAt?: string | null;
  provisionedAt: string;
}

export interface ContractEventDto {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole: ContractActorRole;
  eventType: ContractEventType;
  fromStatus?: InstallationContractStatus | null;
  toStatus?: InstallationContractStatus | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ContractSummary {
  id: string;
  code: string;
  status: InstallationContractStatus;
  contractVersion: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  homeName?: string | null;
  homeType: string;
  packageCode?: string | null;
  userId?: string | null;
  homeId?: string | null;
  totalAmount: number;
  depositPercent: number;
  depositAmount: number;
  scheduledInstallStart?: string | null;
  userSignedAt?: string | null;
  depositVerifiedAt?: string | null;
  handedOverAt?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetail {
  id: string;
  code: string;
  status: InstallationContractStatus;
  contractVersion: number;
  templateCode: string;
  userId?: string | null;
  homeId?: string | null;
  linkedHomeName?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  installAddress: string;
  homeName?: string | null;
  homeType: string;
  roomCount?: number | null;
  floorCount?: number | null;
  bedroomCount?: number | null;
  buildingCondition?: string | null;
  desiredTimeline?: string | null;
  requestedDevices: RequestedDeviceNeed[];
  surveyChecklist: SurveyChecklistItem[];
  surveyFlags: SurveyFlags;
  surveyNotes?: string | null;
  surveyCompletedAt?: string | null;
  packageCode?: string | null;
  customerNote?: string | null;
  subtotalAmount: number;
  installationFee: number;
  discountAmount: number;
  totalAmount: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  providerInfo: BankInfoSnapshot;
  depositTransferNote?: string | null;
  depositProofUrl?: string | null;
  depositReferenceCode?: string | null;
  depositNote?: string | null;
  depositSubmittedAt?: string | null;
  depositVerifiedAt?: string | null;
  depositVerifiedAmount?: number | null;
  preferredInstallDate?: string | null;
  scheduledInstallStart?: string | null;
  scheduledInstallEnd?: string | null;
  termsTitle: string;
  termsContent?: string | null;
  specialTerms?: string | null;
  adminNote?: string | null;
  cancelReason?: string | null;
  userSignatureName?: string | null;
  userSignatureData?: string | null;
  userSignedAt?: string | null;
  adminSignedName?: string | null;
  adminSignedAt?: string | null;
  handoverMode?: string | null;
  handedOverAt?: string | null;
  handoverNote?: string | null;
  items: ContractItemDto[];
  provisionedDevices: ProvisionedDeviceDto[];
  events: ContractEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface HomeOptionDto {
  id: string;
  name: string;
  address?: string | null;
  roomNames: string[];
}

export interface UnclaimedDeviceOptionDto {
  id: string;
  name: string;
  deviceType: string;
  model?: string | null;
  serialNumber?: string | null;
  nodeCode?: string | null;
  catalogId?: string | null;
}

export interface ContractProvisionOptions {
  templates: ContractTemplateSpec[];
  catalogs: PublicCatalogItem[];
  existingHomes: HomeOptionDto[];
  unclaimedDevices: UnclaimedDeviceOptionDto[];
  defaultProviderInfo: BankInfoSnapshot;
}

export interface AdminContractStats {
  total: number;
  submitted: number;
  surveying: number;
  quoted: number;
  revisionRequested: number;
  awaitingDeposit: number;
  depositSubmitted: number;
  depositConfirmed: number;
  installing: number;
  handedOver: number;
  cancelled: number;
}

export interface CreateContractRequest {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  installAddress: string;
  homeName?: string;
  homeType?: string;
  roomCount?: number;
  packageCode?: string;
  customerNote?: string;
  preferredInstallDate?: string;
}

export interface ProposalItemInput {
  catalogId?: string | null;
  deviceName: string;
  modelCode?: string | null;
  deviceType?: string | null;
  roomLabel?: string | null;
  quantity: number;
  unitPrice: number;
  warrantyMonths: number;
}

export interface AdminContractProposalRequest {
  templateCode: string;
  termsTitle: string;
  termsContent: string;
  specialTerms?: string;
  installationFee: number;
  discountAmount: number;
  depositPercent: number;
  scheduledInstallStart?: string | null;
  scheduledInstallEnd?: string | null;
  adminNote?: string;
  providerCompanyName?: string;
  providerTaxCode?: string;
  providerAddress?: string;
  providerRepresentative?: string;
  providerHotline?: string;
  providerEmail?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  items: ProposalItemInput[];
}

export interface HandoverDeviceInput {
  contractItemId?: string | null;
  existingDeviceId?: string | null;
  catalogId?: string | null;
  deviceName?: string;
  roomName: string;
  nodeCode?: string;
  localId?: string;
  warrantyMonths?: number;
}

export interface HandoverContractRequest {
  mode: 'CREATE_NEW_HOME' | 'LINK_EXISTING_HOME';
  existingHomeId?: string | null;
  homeName?: string;
  homeAddress?: string;
  handoverNote?: string;
  devices: HandoverDeviceInput[];
}
