import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// 1. Transpile devicePageHelpers
const helpersSource = readFileSync(
  new URL('../src/components/device/devicePageHelpers.ts', import.meta.url),
  'utf8'
);
const { outputText: helpersJs } = ts.transpileModule(helpersSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const helpersModule = { exports: {} };
new Function('module', 'exports', helpersJs)(helpersModule, helpersModule.exports);
const {
  formatWattage,
  SORT_OPTIONS,
  DEVICE_TYPE_FILTER_OPTIONS,
} = helpersModule.exports;

// 2. Transpile DevicesOverviewStrip
const stripSource = readFileSync(
  new URL('../src/components/device/DevicesOverviewStrip.tsx', import.meta.url),
  'utf8'
);
const { outputText: stripJs } = ts.transpileModule(stripSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2022,
  },
});
const stripModule = { exports: {} };
const stripRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'lucide-react') {
    const FakeIcon = (props) => React.createElement('svg', props);
    return {
      Wifi: FakeIcon,
      Power: FakeIcon,
      Zap: FakeIcon,
      ArrowUpRight: FakeIcon,
      ChevronRight: FakeIcon,
    };
  }
  if (id === './devicePageHelpers') {
    return helpersModule.exports;
  }
  throw new Error(`Unexpected require: ${id}`);
};
new Function('module', 'exports', 'require', stripJs)(
  stripModule,
  stripModule.exports,
  stripRequire
);
const DevicesOverviewStrip = stripModule.exports.DevicesOverviewStrip;

// 3. Transpile DeviceFilterDropdown
const dropdownSource = readFileSync(
  new URL('../src/components/device/DeviceFilterDropdown.tsx', import.meta.url),
  'utf8'
);
const { outputText: dropdownJs } = ts.transpileModule(dropdownSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.ES2022,
  },
});
const dropdownModule = { exports: {} };
const dropdownRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'lucide-react') {
    const FakeIcon = (props) => React.createElement('svg', props);
    return {
      ChevronDown: FakeIcon,
      Check: FakeIcon,
      X: FakeIcon,
      Filter: FakeIcon,
    };
  }
  throw new Error(`Unexpected require: ${id}`);
};
new Function('module', 'exports', 'require', dropdownJs)(
  dropdownModule,
  dropdownModule.exports,
  dropdownRequire
);
const { DeviceFilterDropdown, DeviceMobileFilterModal } = dropdownModule.exports;

test('Filter & Sort options contain all required values', () => {
  assert.deepEqual(DEVICE_TYPE_FILTER_OPTIONS, [
    'Tất cả',
    'Đèn',
    'Điều hòa',
    'Cảm biến',
    'Cổng',
    'Công tắc',
    'Camera',
  ]);

  assert.deepEqual(SORT_OPTIONS, [
    'Nhóm theo phòng',
    'Nhóm theo loại',
    'Tên A–Z',
    'Trạng thái (đang bật trước)',
    'Gần đây nhất',
  ]);
});

test('formatWattage formats watts and kilowatts with tabular formatting', () => {
  assert.equal(formatWattage(0), '0 W');
  assert.equal(formatWattage(85), '85 W');
  assert.equal(formatWattage(1200), '1.2 kW');
  assert.equal(formatWattage(10500), '10.5 kW');
});

test('DevicesOverviewStrip renders loaded values and captions correctly', () => {
  const html = renderToStaticMarkup(
    React.createElement(DevicesOverviewStrip, {
      onlineCount: 8,
      totalCount: 13,
      offlineCount: 5,
      activeCount: 2,
      estimatedWattage: 450,
      todayKwh: 3.5,
      todayCostVnd: 7500,
      onNavigateToEnergy: () => {},
    })
  );

  // Online count & total
  assert.match(html, />8<\/span>/);
  assert.match(html, /\/13/);
  // Offline caption
  assert.match(html, /5 ngoại tuyến/);
  // Active count & caption
  assert.match(html, />2<\/div>/);
  assert.match(html, /2 thiết bị đang mở/);
  // Wattage & caption
  assert.match(html, /450 W/);
  assert.match(html, /Công suất phụ tải/);
  // Today kWh, VND, and Chi tiết link
  assert.match(html, /3,5/);
  assert.match(html, /kWh/);
  assert.match(html, /Chi tiết/);
});

test('DevicesOverviewStrip renders zero/inactive captions accurately', () => {
  const html = renderToStaticMarkup(
    React.createElement(DevicesOverviewStrip, {
      onlineCount: 10,
      totalCount: 10,
      offlineCount: 0,
      activeCount: 0,
      estimatedWattage: 0,
      todayKwh: 0,
      todayCostVnd: 0,
    })
  );

  assert.match(html, /Tất cả trực tuyến/);
  assert.match(html, /Tất cả đang tắt/);
  assert.match(html, /0 W/);
  assert.match(html, /0,0/);
});

test('DevicesOverviewStrip displays "—" fallback when metrics are missing or null', () => {
  const html = renderToStaticMarkup(
    React.createElement(DevicesOverviewStrip, {
      onlineCount: undefined,
      totalCount: null,
      offlineCount: null,
      activeCount: null,
      estimatedWattage: null,
      todayKwh: null,
      todayCostVnd: null,
    })
  );

  // Must render "—" for all 4 cells without hiding any cell
  const dashOccurrences = (html.match(/—/g) || []).length;
  assert.ok(dashOccurrences >= 4, `Expected at least 4 dashes, found ${dashOccurrences}`);
  // Cell titles still present
  assert.match(html, /Trực tuyến/);
  assert.match(html, /Đang bật/);
  assert.match(html, /Tải tức thời/);
  assert.match(html, /Hôm nay/);
});

test('DevicesOverviewStrip renders pulse skeletons when loading', () => {
  const html = renderToStaticMarkup(
    React.createElement(DevicesOverviewStrip, {
      loading: true,
    })
  );

  assert.match(html, /animate-pulse/);
});

test('DeviceFilterDropdown renders labelPrefix and active value in button', () => {
  const html = renderToStaticMarkup(
    React.createElement(DeviceFilterDropdown, {
      labelPrefix: 'Loại',
      value: 'Đèn',
      options: DEVICE_TYPE_FILTER_OPTIONS,
      onChange: () => {},
    })
  );

  assert.match(html, /Loại:/);
  assert.match(html, /Đèn/);
  assert.match(html, /aria-haspopup="listbox"/);
});

test('DeviceMobileFilterModal renders all options when open', () => {
  const html = renderToStaticMarkup(
    React.createElement(DeviceMobileFilterModal, {
      isOpen: true,
      onClose: () => {},
      typeFilter: 'Tất cả',
      onTypeChange: () => {},
      sort: 'Nhóm theo phòng',
      onSortChange: () => {},
      typeOptions: DEVICE_TYPE_FILTER_OPTIONS,
      sortOptions: SORT_OPTIONS,
    })
  );

  // Must render all type options
  for (const opt of DEVICE_TYPE_FILTER_OPTIONS) {
    assert.ok(html.includes(opt), `Expected html to include type option ${opt}`);
  }
  // Must render all sort options
  for (const opt of SORT_OPTIONS) {
    assert.ok(html.includes(opt), `Expected html to include sort option ${opt}`);
  }
  // Must render apply button
  assert.match(html, /Áp dụng/);
});
