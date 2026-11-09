import React from 'react';
import { MemberPage } from '../member/MemberPage';
import { sanitizeMemberName } from '../member/MemberCard';

export { sanitizeMemberName };

export interface MemberManagementProps {
  homeId: string;
  currentUserRole: 'OWNER' | 'MEMBER';
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ homeId, currentUserRole }) => {
  return (
    <MemberPage embeddedHomeId={homeId} embeddedUserRole={currentUserRole} />
  );
};
