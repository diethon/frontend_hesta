import assert from 'node:assert/strict';
import { test } from 'node:test';

// Helper functions that model the permissions and name sanitization logic
export function sanitizeMemberName(name) {
  if (!name) return '';
  return name.replace(/\s*\(Owner\)\s*$/i, '').trim();
}

export function canManageMember({ currentUserRole, currentUserId, targetMember }) {
  if (currentUserRole !== 'OWNER') return false;
  if (!targetMember) return false;
  // Cannot remove or change role of any owner
  if (targetMember.role === 'OWNER') return false;
  // Cannot remove or change role of yourself
  if (targetMember.id === currentUserId) return false;
  return true;
}

export function canInviteMembers(currentUserRole) {
  return currentUserRole === 'OWNER';
}

test('sanitizeMemberName removes legacy (Owner) test data suffix from full name', () => {
  assert.equal(sanitizeMemberName('Ta Tan Phong (Owner)'), 'Ta Tan Phong');
  assert.equal(sanitizeMemberName('Việt Đức'), 'Việt Đức');
  assert.equal(sanitizeMemberName('Nguyen Van A(Owner)'), 'Nguyen Van A');
  assert.equal(sanitizeMemberName(''), '');
});

test('owners can never be removed or have their role changed by anyone', () => {
  const currentUserId = 'user-owner-1';
  const otherOwner = {
    id: 'user-owner-2',
    fullName: 'Second Owner',
    role: 'OWNER',
  };

  const allowed = canManageMember({
    currentUserRole: 'OWNER',
    currentUserId,
    targetMember: otherOwner,
  });

  assert.equal(allowed, false, 'Other owner must not have delete or role change controls');
});

test('current user can never remove or change role of themselves', () => {
  const currentUserId = 'user-owner-1';
  const selfMember = {
    id: currentUserId,
    fullName: 'Current User',
    role: 'OWNER',
  };

  const allowed = canManageMember({
    currentUserRole: 'OWNER',
    currentUserId,
    targetMember: selfMember,
  });

  assert.equal(allowed, false, 'Self member must not have delete or role change controls');
});

test('normal members can be managed by an owner', () => {
  const currentUserId = 'user-owner-1';
  const normalMember = {
    id: 'user-member-3',
    fullName: 'Normal Member',
    role: 'MEMBER',
  };

  const allowed = canManageMember({
    currentUserRole: 'OWNER',
    currentUserId,
    targetMember: normalMember,
  });

  assert.equal(allowed, true, 'Normal member can be managed by owner');
});

test('non-owner members get no management controls and cannot invite', () => {
  const currentUserId = 'user-member-3';
  const targetMember = {
    id: 'user-member-4',
    fullName: 'Another Member',
    role: 'MEMBER',
  };

  const canManage = canManageMember({
    currentUserRole: 'MEMBER',
    currentUserId,
    targetMember,
  });
  const canInvite = canInviteMembers('MEMBER');

  assert.equal(canManage, false, 'Non-owner cannot manage any member');
  assert.equal(canInvite, false, 'Non-owner cannot invite members');
});
