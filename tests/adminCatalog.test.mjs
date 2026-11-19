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
    if (name.endsWith('/services/deviceCatalogApi')) {
      return {
        createDeviceCatalog: async () => ({ id: 'new-id' }),
        updateDeviceCatalog: async () => ({ id: 'updated-id' }),
        uploadDeviceCatalogImage: async () => 'https://example.com/uploaded.png',
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

const { ProductCard } = loadSource('src/components/admin/ProductCard.tsx');
const { AdminCatalogModal } = loadSource('src/components/admin/AdminCatalogModal.tsx');
const { getFriendlyDeviceTypeName, CATALOG_DEVICE_TYPES, isCatalogFormDirty } = loadSource('src/components/admin/adminCatalogHelpers.ts');
const { ConfirmModal } = loadSource('src/components/ui/ConfirmModal.tsx');

// ──────────────────────────────────────────────────────────────────────────
// ProductCard Tests
// ──────────────────────────────────────────────────────────────────────────

test('ProductCard: renders placeholder fallback icon when image is missing or empty', () => {
  const catalogWithoutImage = {
    id: 'cat-1',
    name: 'Đèn LED RGB Căn Phòng',
    deviceType: 'LED_RGB',
    modelCode: 'HESTA-RGB-01',
    serialPrefix: 'HESTA-RGB-',
    description: 'Mô tả đèn',
    imageUrl: '',
    totalDeviceCount: 10,
    claimedCount: 7,
    unclaimedCount: 3,
    isActive: true,
    createdAt: '2026-01-01',
  };

  const html = renderToString(
    React.createElement(ProductCard, {
      catalog: catalogWithoutImage,
      onEdit: () => {},
      onDelete: () => {},
      onGenerateQr: () => {},
    })
  );

  assert.ok(html.includes('data-testid="product-placeholder"'), 'Expected placeholder container');
  assert.ok(!html.includes('<img'), 'Should not render img tag when imageUrl is empty');
  assert.ok(html.includes('HESTA-RGB-01'), 'Model code should be rendered');
  assert.ok(html.includes('Đèn LED RGB'), 'Friendly Vietnamese type label should be rendered');
});

test('ProductCard: renders long product name with title tooltip attribute', () => {
  const longName = 'Hệ thống cảm biến đo nồng độ bụi mịn PM2.5, nhiệt độ, độ ẩm cao cấp cho biệt thự thông minh HESTA Pro Max';
  const catalogWithLongName = {
    id: 'cat-2',
    name: longName,
    deviceType: 'TEMP_HUMID_SENSOR',
    modelCode: 'HESTA-TH-99',
    serialPrefix: 'HESTA-TH-',
    description: 'Cảm biến vi khí hậu',
    imageUrl: 'https://example.com/sensor.png',
    totalDeviceCount: 5,
    claimedCount: 1,
    unclaimedCount: 4,
    isActive: true,
    createdAt: '2026-01-01',
  };

  const html = renderToString(
    React.createElement(ProductCard, {
      catalog: catalogWithLongName,
      onEdit: () => {},
      onDelete: () => {},
      onGenerateQr: () => {},
    })
  );

  assert.ok(html.includes(`title="${longName}"`), 'Long name must have title attribute for tooltip');
  assert.ok(html.includes(longName), 'Long name must be present in markup');
  assert.ok(html.includes('Cảm biến nhiệt ẩm'), 'Friendly type label should match TEMP_HUMID_SENSOR');
});

test('ProductCard: renders "Chưa có mô tả" when description is missing or blank', () => {
  const catalogWithoutDesc = {
    id: 'cat-3',
    name: 'Công Tắc Thông Minh 2 Nút',
    deviceType: 'LIGHT',
    modelCode: 'HESTA-SW-02',
    serialPrefix: 'HESTA-SW-',
    description: '   ',
    imageUrl: 'https://example.com/sw.png',
    totalDeviceCount: 0,
    claimedCount: 0,
    unclaimedCount: 0,
    isActive: true,
    createdAt: '2026-01-01',
  };

  const html = renderToString(
    React.createElement(ProductCard, {
      catalog: catalogWithoutDesc,
      onEdit: () => {},
      onDelete: () => {},
      onGenerateQr: () => {},
    })
  );

  assert.ok(html.includes('Chưa có mô tả'), 'Expected fallback text "Chưa có mô tả"');
});

// ──────────────────────────────────────────────────────────────────────────
// AdminCatalogModal Tests
// ──────────────────────────────────────────────────────────────────────────

test('AdminCatalogModal: submit button is disabled when required fields are empty', () => {
  // When modal is open with an empty new product (name is empty)
  const html = renderToString(
    React.createElement(AdminCatalogModal, {
      isOpen: true,
      onClose: () => {},
      onSuccess: () => {},
      editingCatalog: null,
    })
  );

  assert.ok(html.includes('data-testid="admin-catalog-modal"'), 'Modal should be rendered');
  assert.ok(html.includes('data-testid="catalog-submit-btn"'), 'Submit button should be present');
  assert.ok(html.includes('disabled=""'), 'Submit button must be disabled when name is empty');
  assert.ok(html.includes('Vui lòng nhập tên dòng sản phẩm'), 'Validation hint should prompt for name');
});

test('AdminCatalogModal: submit button is enabled when required fields are populated', () => {
  const existingCatalog = {
    id: 'cat-valid',
    name: 'Quạt Trần HESTA Breeze',
    deviceType: 'FAN',
    modelCode: 'HESTA-FAN-01',
    serialPrefix: 'HESTA-FAN-',
    description: 'Quạt trần DC',
    imageUrl: 'https://example.com/fan.png',
    isActive: true,
    createdAt: '2026-01-01',
  };

  const html = renderToString(
    React.createElement(AdminCatalogModal, {
      isOpen: true,
      onClose: () => {},
      onSuccess: () => {},
      editingCatalog: existingCatalog,
    })
  );

  // In editing mode with valid existing catalog, submit button should not have validation hint
  assert.ok(html.includes('Lưu thay đổi'), 'Submit button text in editing mode');
  assert.ok(!html.includes('Vui lòng nhập tên dòng sản phẩm'), 'Should not show name validation error');
  assert.ok(html.includes('HESTA-FAN-01'), 'Model code should be present in input');
});

test('AdminCatalogModal: does not render anything when isOpen is false', () => {
  const html = renderToString(
    React.createElement(AdminCatalogModal, {
      isOpen: false,
      onClose: () => {},
      onSuccess: () => {},
      editingCatalog: null,
    })
  );

  assert.equal(html, '', 'Should render nothing when isOpen is false');
});

test('AdminCatalogModal: isCatalogFormDirty detects unsaved changes for dirty-close confirmation', () => {
  const initial = {
    name: 'Đèn LED Thông Minh',
    deviceType: 'LED_RGB',
    modelCode: 'HESTA-RGB-01',
    serialPrefix: 'HESTA-RGB-',
    description: 'Mô tả ban đầu',
    imageUrl: 'https://example.com/initial.png',
  };

  // Exactly identical -> not dirty
  assert.equal(isCatalogFormDirty(initial, { ...initial }), false, 'Identical form should not be dirty');

  // Modified name -> dirty
  assert.equal(isCatalogFormDirty({ ...initial, name: 'Đèn LED Mới' }, initial), true, 'Modified name should be dirty');

  // Modified modelCode -> dirty
  assert.equal(isCatalogFormDirty({ ...initial, modelCode: 'HESTA-RGB-02' }, initial), true, 'Modified modelCode should be dirty');

  // Modified serialPrefix -> dirty
  assert.equal(isCatalogFormDirty({ ...initial, serialPrefix: 'HESTA-RGB-V2-' }, initial), true, 'Modified prefix should be dirty');

  // Modified description -> dirty
  assert.equal(isCatalogFormDirty({ ...initial, description: 'Mô tả đã sửa' }, initial), true, 'Modified description should be dirty');

  // Modified imageUrl -> dirty
  assert.equal(isCatalogFormDirty({ ...initial, imageUrl: 'https://example.com/new.png' }, initial), true, 'Modified imageUrl should be dirty');
});

test('AdminCatalogModal: dirty-close confirmation modal renders with warning message and cancel actions', () => {
  const confirmHtml = renderToString(
    React.createElement(ConfirmModal, {
      isOpen: true,
      title: 'Thay đổi chưa lưu',
      description: 'Bạn có các thay đổi chưa được lưu vào dòng sản phẩm. Bạn có chắc chắn muốn thoát mà không lưu không?',
      confirmText: 'Thoát không lưu',
      cancelText: 'Tiếp tục chỉnh sửa',
      variant: 'primary',
      onConfirm: () => {},
      onCancel: () => {},
    })
  );

  assert.ok(confirmHtml.includes('Thay đổi chưa lưu'), 'Confirm modal should display title');
  assert.ok(confirmHtml.includes('Bạn có các thay đổi chưa được lưu'), 'Confirm modal should display warning text');
  assert.ok(confirmHtml.includes('Thoát không lưu'), 'Confirm modal should provide exit action');
  assert.ok(confirmHtml.includes('Tiếp tục chỉnh sửa'), 'Confirm modal should provide stay action');
});

