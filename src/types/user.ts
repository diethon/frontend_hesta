export interface UpdateProfileRequest {
  fullName: string;
  phoneNumber?: string;
}

export interface NotificationPreferences {
  securityEnabled: boolean;
  automationEnabled: boolean;
  systemEnabled: boolean;
  quietHoursEnabled: boolean;
  /** "HH:mm", giờ Việt Nam */
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
