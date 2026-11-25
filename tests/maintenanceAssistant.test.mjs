import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

function transpile(relPath, customRequire) {
  const filename = resolve(root, relPath);
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  const mod = { exports: {} };
  const fn = runInThisContext(
    `(function (exports, require, module) {\n${outputText}\n})`,
    { filename },
  );
  fn(mod.exports, customRequire, mod);
  return mod.exports;
}

function loadAssistantRenderer() {
  const formatMod = transpile('src/components/maintenance/maintenanceFormat.ts', (id) => require(id));
  const noopIcon = () => React.createElement('span');
  const lucideStub = new Proxy({}, { get: () => noopIcon });
  const ticketDetailStub = {
    PriorityPill: ({ priority }) => React.createElement('span', { 'data-priority': priority }, `Ưu tiên: ${priority}`),
    StatusPill: ({ status }) => React.createElement('span', { 'data-status': status }, status),
  };
  const modalStub = { btnGhost: 'btn-ghost', btnPrimary: 'btn-primary', fieldClass: 'field' };
  const authImageStub = { AuthenticatedImage: ({ src, alt }) => React.createElement('img', { src, alt }) };
  const slotEditorStub = { SlotEditor: () => React.createElement('div', { 'data-testid': 'slot-editor' }) };
  const apiStub = {};
  const notifyStub = { notify: { success: () => {}, error: () => {}, info: () => {} } };
  const errorsStub = { getErrorMessage: (e, fallback) => fallback };

  const drawerMod = transpile('src/components/maintenance/MaintenanceAssistantDrawer.tsx', (id) => {
    if (id === 'lucide-react') return lucideStub;
    if (id === '../../services/maintenanceApi') return apiStub;
    if (id === '../../utils/errors') return errorsStub;
    if (id === '../ui/notify') return notifyStub;
    if (id === './MaintenanceModal') return modalStub;
    if (id === './AuthenticatedImage') return authImageStub;
    if (id === './SlotEditor') return slotEditorStub;
    if (id === './TicketDetailView') return ticketDetailStub;
    if (id === './maintenanceFormat') return formatMod;
    if (id === './imageUploadUtils') return { convertWebpToJpegIfNeeded: async (f) => f };
    return require(id);
  });

  return { AssistantBlockRenderer: drawerMod.AssistantBlockRenderer, formatMod };
}

test('AssistantBlockRenderer renders device_card, safety danger warning, ticket_summary confirm state, and ticket_created', () => {
  const { AssistantBlockRenderer, formatMod } = loadAssistantRenderer();
  const baseProps = {
    isUser: false,
    interactive: true,
    slots: [formatMod.newSlotDraft(1)],
    onSlotsChange: () => {},
    slotError: null,
    contactPhone: '',
    onContactPhoneChange: () => {},
    attachments: [],
    uploadingImage: false,
    onTriggerUpload: () => {},
    onRemoveAttachment: () => {},
    confirming: false,
    onQuickReply: () => {},
    onConfirmTicket: () => {},
    onViewTicket: () => {},
  };

  // 1. Device card offline
  const deviceHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: {
        type: 'device_card',
        deviceId: 'dev-1',
        name: 'Đèn trần',
        roomName: 'Phòng khách',
        deviceType: 'LIGHT',
        status: 'OFFLINE',
        offlineDurationLabel: '3 giờ',
        healthPercent: 98.2,
        switchCycles: 1200,
      },
    }),
  );
  assert.match(deviceHtml, /Đèn trần/);
  assert.match(deviceHtml, /Mất kết nối/);
  assert.match(deviceHtml, /3 giờ/);

  // 2. Safety danger warning text block
  const dangerHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: { type: 'text', tone: 'danger', text: 'DỪNG THAO TÁC NGAY LẬP TỨC!' },
    }),
  );
  assert.match(dangerHtml, /CẢNH BÁO AN TOÀN/);
  assert.match(dangerHtml, /DỪNG THAO TÁC NGAY LẬP TỨC/);

  // 3. Ticket summary disables confirm when slotError is present
  const summaryDisabledHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      slotError: 'Khung giờ phải cách hiện tại ít nhất 2 giờ.',
      block: {
        type: 'ticket_summary',
        title: '[KHẨN CẤP] Kiểm tra an toàn Đèn trần',
        priority: 'URGENT',
        safetyFlag: true,
        deviceId: 'dev-1',
        deviceName: 'Đèn trần',
        diagnosisSummary: 'CỜ AN TOÀN: KHẨN CẤP',
      },
    }),
  );
  assert.match(summaryDisabledHtml, /disabled=""/);
  assert.match(summaryDisabledHtml, /URGENT/);

  // 4. Ticket created shows code & detail button
  const createdHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: {
        type: 'ticket_created',
        ticketId: 't-1',
        code: 'MT-261123-SAFE01',
        title: '[KHẨN CẤP] Kiểm tra an toàn Đèn trần',
        status: 'SUBMITTED',
      },
    }),
  );
  assert.match(createdHtml, /MT-261123-SAFE01/);
  assert.match(createdHtml, /Xem chi tiết ticket/);

  // 5. AI-generated badge on text block & editable AI summary on ticket_summary
  const aiTextHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: { type: 'text', tone: 'info', aiGenerated: true, text: 'Đèn có nhấp nháy hay tắt hẳn?' },
    }),
  );
  assert.match(aiTextHtml, /Trợ lý AI/);

  const editableSummaryHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      editedSummary: 'Đèn tắt hẳn từ tối qua',
      onEditedSummaryChange: () => {},
      block: {
        type: 'ticket_summary',
        title: 'Kiểm tra Đèn trần',
        priority: 'NORMAL',
        safetyFlag: false,
        deviceId: 'dev-1',
        deviceName: 'Đèn trần',
        diagnosisSummary: '- Thiết bị: Đèn trần',
        aiSummary: 'Đèn trần phòng khách mất kết nối sau khi thử các bước an toàn.',
      },
    }),
  );
  assert.match(editableSummaryHtml, /AI tóm tắt/);
  assert.match(editableSummaryHtml, /Đèn tắt hẳn từ tối qua/);

  // 6. Privacy notice & image_analysis blocks
  const privacyHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: {
        type: 'privacy_notice',
        attachmentId: 'att-1',
        text: 'Không chụp lộ người hoặc giấy tờ cá nhân.',
        acceptValue: 'IMAGE_CONSENT_ACCEPT',
        declineValue: 'IMAGE_CONSENT_DECLINE',
      },
    }),
  );
  assert.match(privacyHtml, /Thông báo quyền riêng tư hình ảnh/);
  assert.match(privacyHtml, /Đồng ý phân tích bằng AI/);

  const imgAnalysisHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: {
        type: 'image_analysis',
        attachmentId: 'att-1',
        decision: 'TELEMETRY_MISMATCH_OBSERVATIONS',
        imageQuality: 'GOOD',
        observations: ['Đèn báo nguồn đang tắt'],
        staticAdvice: 'Ảnh không thấy hư hại nhưng thiết bị vẫn đang mất kết nối.',
        telemetryMismatch: true,
        aiGenerated: true,
      },
    }),
  );
  assert.match(imgAnalysisHtml, /Trợ lý AI/);
  assert.match(imgAnalysisHtml, /chưa được kiểm chứng/);
  assert.match(imgAnalysisHtml, /Đèn báo nguồn đang tắt/);

  // 7. Device picker renders search input when > 6 devices
  const sevenDevices = Array.from({ length: 7 }, (_, i) => ({
    deviceId: `d-${i}`,
    name: `Thiết bị ${i + 1}`,
    deviceType: 'LIGHT',
    roomName: 'Phòng khách',
    status: 'ONLINE',
  }));
  const pickerHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      block: { type: 'device_picker', devices: sevenDevices },
    }),
  );
  assert.match(pickerHtml, /Tìm thiết bị theo tên, phòng, loại/);

  // 8. Hides AI badge when showAiBadge is false (home not in allowlist)
  const noAiBadgeHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      showAiBadge: false,
      block: { type: 'text', tone: 'info', aiGenerated: true, text: 'Vui lòng chọn triệu chứng.' },
    }),
  );
  assert.doesNotMatch(noAiBadgeHtml, /Trợ lý AI/);

  // 9. Renders user image block visually via AuthenticatedImage
  const userImgHtml = renderToStaticMarkup(
    React.createElement(AssistantBlockRenderer, {
      ...baseProps,
      isUser: true,
      block: {
        type: 'image',
        attachmentId: 'att-9',
        url: '/api/v1/homes/h1/maintenance-attachments/att-9/content',
        caption: 'Ảnh thiết bị',
      },
    }),
  );
  assert.match(userImgHtml, /<img/);
  assert.match(userImgHtml, /maintenance-attachments\/att-9\/content/);
});
