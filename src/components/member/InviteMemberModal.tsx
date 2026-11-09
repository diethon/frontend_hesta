import React from 'react';
import type { HomeMember } from '../../services/homeApi';

export interface InviteMemberModalProps {
  isOpen: boolean;
  homeId: string;
  existingMembers: HomeMember[];
  onClose: () => void;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen }) => {
  if (!isOpen) return null;
  return null;
};
