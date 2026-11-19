export interface UpdateProfileRequest {
  fullName: string;
  phoneNumber?: string;
}

export interface NotificationPreferences {
  securityEnabled: boolean;
  automationEnabled: boolean;
  systemEnabled: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
