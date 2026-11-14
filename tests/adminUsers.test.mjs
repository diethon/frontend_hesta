import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
globalThis.__viteEnv = { VITE_API_BASE_URL: 'http://backend.test/api/v1' };

function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', 'globalThis.__viteEnv');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });

  const sourceRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'react-hot-toast') {
      return { __esModule: true, default: Object.assign(() => '', { custom: () => '', dismiss() {} }), Toaster: () => null };
    }
    if (name.endsWith('/services/adminUserApi')) {
      return {
        getAdminUsers: async () => ({ content: [], totalPages: 0, totalElements: 0 }),
        getAdminUserStats: async () => ({
          totalUsers: 10,
          activeUsers: 8,
          lockedUsers: 1,
          disabledUsers: 1,
          googleUsers: 4,
          adminUsers: 2,
          registrationTrend: [],
        }),
        adminCreateUser: async () => ({ id: 'new-user-id' }),
        adminUpdateUser: async () => ({ id: 'updated-user-id' }),
        adminUpdateUserStatus: async () => {},
        adminResetPassword: async () => {},
        adminUnlockUser: async () => {},
      };
    }
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(filename), name);
    const dependencyPath = ['.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
    assert.ok(dependencyPath, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependencyPath);
  };

  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}

const {
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  PROVIDER_OPTIONS,
  PAGE_SIZE_OPTIONS,
  formatDateTimeVi,
  formatDateTimeFullVi,
} = loadSource('src/components/admin/adminUsersHelpers.ts');

const { AdminResetPasswordModal } = loadSource('src/components/admin/AdminResetPasswordModal.tsx');
const { AdminUserDetailModal } = loadSource('src/components/admin/AdminUserDetailModal.tsx');
const { AdminCreateUserModal } = loadSource('src/components/admin/AdminCreateUserModal.tsx');
const { AdminEditUserModal } = loadSource('src/components/admin/AdminEditUserModal.tsx');

test('adminUsersHelpers: filter options and page size definitions are complete', () => {
  assert.equal(ROLE_OPTIONS.length, 3);
  assert.deepEqual(ROLE_OPTIONS.map((o) => o.value), ['ALL', 'USER', 'ADMIN']);

  assert.equal(STATUS_OPTIONS.length, 4);
  assert.deepEqual(STATUS_OPTIONS.map((o) => o.value), ['ALL', 'ACTIVE', 'LOCKED', 'DISABLED']);

  assert.equal(PROVIDER_OPTIONS.length, 3);
  assert.deepEqual(PROVIDER_OPTIONS.map((o) => o.value), ['ALL', 'LOCAL', 'GOOGLE']);

  assert.equal(PAGE_SIZE_OPTIONS.length, 3);
  assert.deepEqual(PAGE_SIZE_OPTIONS.map((o) => o.value), [10, 20, 50]);
});

test('adminUsersHelpers: date formatters handle null, undefined, invalid, and ISO strings gracefully', () => {
  assert.equal(formatDateTimeVi(null), '—');
  assert.equal(formatDateTimeVi(undefined), '—');
  assert.equal(formatDateTimeVi('invalid-date'), 'invalid-date');

  const formattedDate = formatDateTimeVi('2026-10-25T14:30:00Z');
  assert.ok(formattedDate.includes('2026') || formattedDate.includes('25'));

  assert.equal(formatDateTimeFullVi(null), '—');
  assert.equal(formatDateTimeFullVi(undefined), '—');
  assert.equal(formatDateTimeFullVi('invalid-date'), 'invalid-date');

  const formattedFull = formatDateTimeFullVi('2026-10-25T14:30:00Z');
  assert.ok(formattedFull.includes('2026') || formattedFull.includes('25'));
});

test('AdminResetPasswordModal: does not render anything when closed', () => {
  const html = renderToString(
    React.createElement(AdminResetPasswordModal, {
      isOpen: false,
      user: {
        id: 'u1',
        email: 'test@example.com',
        fullName: 'Nguyễn Văn A',
        platformRole: 'USER',
        status: 'ACTIVE',
        provider: 'LOCAL',
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        homeCount: 1,
      },
      onClose: () => {},
      onSuccess: () => {},
    })
  );
  assert.equal(html, '');
});

test('AdminResetPasswordModal: renders when open with sentence case title and user details', () => {
  const html = renderToString(
    React.createElement(AdminResetPasswordModal, {
      isOpen: true,
      user: {
        id: 'u1',
        email: 'test@example.com',
        fullName: 'Nguyễn Văn A',
        platformRole: 'USER',
        status: 'ACTIVE',
        provider: 'LOCAL',
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        homeCount: 1,
      },
      onClose: () => {},
      onSuccess: () => {},
    })
  );
  assert.ok(html.includes('Đặt lại mật khẩu người dùng'));
  assert.ok(html.includes('test@example.com'));
  assert.ok(html.includes('Tạo ngẫu nhiên'));
  assert.ok(html.includes('Cập nhật mật khẩu'));
});

test('AdminUserDetailModal: renders when open with user identity, status, and role', () => {
  const html = renderToString(
    React.createElement(AdminUserDetailModal, {
      isOpen: true,
      user: {
        id: 'u1',
        email: 'admin@example.com',
        fullName: 'Trần Thị Admin',
        phoneNumber: '0901234567',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
        provider: 'GOOGLE',
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        homeCount: 2,
      },
      onClose: () => {},
      onEdit: () => {},
      onResetPassword: () => {},
      onToggleStatus: () => {},
      onUnlock: () => {},
    })
  );
  assert.ok(html.includes('Trần Thị Admin'));
  assert.ok(html.includes('admin@example.com'));
  assert.ok(html.includes('0901234567'));
  assert.ok(html.includes('Quản trị viên'));
  assert.ok(html.includes('Google OAuth 2.0'));
  assert.ok(html.includes('Đang hoạt động'));
  assert.ok(html.includes('Sửa thông tin'));
  assert.ok(html.includes('Đặt lại mật khẩu'));
});

test('AdminCreateUserModal: renders when open with sentence case title and inputs', () => {
  const html = renderToString(
    React.createElement(AdminCreateUserModal, {
      isOpen: true,
      onClose: () => {},
      onSuccess: () => {},
    })
  );
  assert.ok(html.includes('Tạo tài khoản người dùng mới'));
  assert.ok(html.includes('Họ và tên'));
  assert.ok(html.includes('Địa chỉ email'));
  assert.ok(html.includes('Mật khẩu khởi tạo'));
  assert.ok(html.includes('Tạo tài khoản'));
});

test('AdminEditUserModal: renders with pre-filled user information', () => {
  const html = renderToString(
    React.createElement(AdminEditUserModal, {
      isOpen: true,
      user: {
        id: 'u2',
        email: 'user2@example.com',
        fullName: 'Lê Văn B',
        phoneNumber: '0988776655',
        platformRole: 'USER',
        status: 'ACTIVE',
        provider: 'LOCAL',
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        homeCount: 0,
      },
      onClose: () => {},
      onSuccess: () => {},
    })
  );
  assert.ok(html.includes('Chỉnh sửa thông tin người dùng'));
  assert.ok(html.includes('user2@example.com'));
  assert.ok(html.includes('Lưu thay đổi'));
});
