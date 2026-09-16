// Run with: node --test tests/routing.test.mjs
// Uses the installed TypeScript compiler in memory; no extra test dependency.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { runInThisContext } from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import * as router from 'react-router';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
let redirects = [];
globalThis.__viteEnv = { VITE_API_BASE_URL: 'http://backend.test/api/v1' };

// Capture redirect destinations during server rendering, where navigation
// effects do not run. Routes, matching, outlets, and location hooks are real.
const routerForTests = {
  ...router,
  Navigate: (props) => { redirects.push(props); return null; },
};

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
    if (name === 'react-router') return routerForTests;
    if (!name.startsWith('.')) return require(name);
    const base = resolve(dirname(filename), name);
    const dependencyPath = ['.ts', '.tsx'].map((extension) => base + extension).find(existsSync);
    assert.ok(dependencyPath, `Cannot resolve ${name} from ${path}`);
    return loadSource(dependencyPath);
  };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(sourceRequire, module, module.exports);
  return module.exports;
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  removeItem: (key) => storage.delete(key),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
after(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
});

const { AppRoutes } = loadSource('src/routes/AppRoutes.tsx');
const { createAppStore } = loadSource('src/store/store.ts');
const navigation = loadSource('src/routes/navigation.ts');
const session = loadSource('src/services/session.ts');
const user = { id: 'test-user', fullName: 'Routing Test', email: 'routing@example.test',
  platformRole: 'USER', provider: 'LOCAL', status: 'ACTIVE', createdAt: '' };
const admin = { ...user, platformRole: 'ADMIN' };
const search = '?token=a%2Bb%26c&inviteToken=a%2Bb%26c&source=one&source=two';

function renderRoute(path, storedUser = null, state, routeSearch = search) {
  storage.clear();
  if (storedUser) {
    storage.set('userInfo', JSON.stringify(storedUser));
    storage.set('accessToken', 'test-access-token');
  }
  redirects = [];
  const appStore = createAppStore();
  return renderToString(React.createElement(Provider, { store: appStore },
    React.createElement(router.MemoryRouter, {
      initialEntries: [{ pathname: path, search: routeSearch, hash: '#flow', state }],
    }, React.createElement(AppRoutes))));
}

test('public pages render directly, even with an existing ADMIN session', () => {
  for (const [path, content] of [
    ['/login', 'Đăng nhập Email/Mật khẩu'],
    ['/register', 'Đăng ký tài khoản hệ thống local-first'],
    ['/forgot-password', 'Nhập email để nhận mã khôi phục'],
  ]) {
    assert.ok(renderRoute(path, admin).includes(content));
    assert.equal(redirects.length, 0);
  }
});

test('session restoration happens before protected routes render', () => {
  assert.ok(renderRoute('/home', user).includes('Routing Test'));
  assert.equal(redirects.length, 0);
  assert.ok(renderRoute('/admin', admin).includes('HESTA Admin Center'));
  assert.equal(redirects.length, 0);
  // ADMIN users can still visit /home explicitly.
  assert.ok(renderRoute('/home', admin).includes('HESTA Smart Home'));
  assert.equal(redirects.length, 0);
});

test('login exposes an accessible password visibility control', () => {
  const html = renderRoute('/login');
  assert.match(html, /type="password"/);
  assert.match(html, /aria-label="Hiện mật khẩu"/);
  assert.match(html, /aria-pressed="false"/);
});

test('protected routes preserve the URL context and return destination', () => {
  for (const path of ['/home', '/admin']) {
    renderRoute(path);
    assert.deepEqual(redirects[0].to, { pathname: '/login', search, hash: '#flow' });
    assert.equal(redirects[0].state.returnTo, path);
    assert.equal(redirects[0].replace, true);
  }
  renderRoute('/admin', user);
  assert.deepEqual(redirects[0].to, { pathname: '/home', search, hash: '#flow' });
});

test('join renders the correct public or authenticated invitation view', () => {
  assert.ok(renderRoute('/join').includes('Bạn đã có tài khoản trên HESTA chưa?'));
  assert.ok(renderRoute('/join', user).includes('Xác nhận tham gia'));
  assert.equal(redirects.length, 0);
});

test('a join URL without an invitation redirects guests and shows the existing error for users', () => {
  renderRoute('/join', null, undefined, '');
  assert.equal(redirects[0].to.pathname, '/login');
  assert.ok(renderRoute('/join', user, undefined, '').includes('Đường dẫn không hợp lệ hoặc đã thiếu mã token.'));
  assert.equal(redirects.length, 0);
});

test('password reset supports restored history state and a safe direct-entry fallback', () => {
  assert.ok(renderRoute('/reset-password', null, { resetEmail: 'routing@example.test' }).includes('routing@example.test'));
  assert.equal(redirects.length, 0);
  renderRoute('/reset-password');
  assert.deepEqual(redirects[0].to, { pathname: '/forgot-password', search, hash: '#flow' });
});

test('root and unknown paths redirect according to the restored platform role', () => {
  for (const path of ['/', '/unknown']) {
    for (const [account, destination] of [[null, '/login'], [user, '/home'], [admin, '/admin']]) {
      renderRoute(path, account);
      assert.deepEqual(redirects[0].to, { pathname: destination, search, hash: '#flow' });
    }
  }
});

test('invitation aliases preserve encoded tokens and repeated unrelated query keys', () => {
  const original = '?token=a%2Bb%26c&source=one&source=two';
  const result = new URLSearchParams(navigation.invitationSearch(original, 'inviteToken'));
  assert.equal(result.get('token'), 'a+b&c');
  assert.equal(result.get('inviteToken'), 'a+b&c');
  assert.deepEqual(result.getAll('source'), ['one', 'two']);
  assert.equal(navigation.invitationSearch(search, 'token'), search);
  assert.equal(new URLSearchParams(navigation.invitationSearch('?inviteToken=a%2Bb', 'token')).get('token'), 'a+b');
});

test('post-login destinations respect invitations, completed registration, roles, and safe return paths', () => {
  assert.equal(navigation.loginDestination(admin, search, { returnTo: '/admin' }), '/join');
  assert.equal(navigation.loginDestination(user, search, { handledInviteToken: 'a+b&c', returnTo: '/join' }), '/home');
  assert.equal(navigation.loginDestination(admin, '', { returnTo: '/home' }), '/home');
  assert.equal(navigation.loginDestination(user, '', { returnTo: '/admin' }), '/home');
  assert.equal(navigation.loginDestination(admin, '', {}), '/admin');
  assert.equal(navigation.readNavigationState({ returnTo: '//untrusted.example' }).returnTo, undefined);
});

test('invalid stored sessions are signed out and cleanup preserves unrelated storage', () => {
  storage.clear();
  storage.set('userInfo', '{broken');
  storage.set('accessToken', 'test-token');
  storage.set('refreshToken', 'test-refresh');
  storage.set('unrelated-preference', 'keep');
  assert.equal(session.readStoredUser(), null);
  session.clearSession();
  assert.deepEqual([...storage.entries()], [['unrelated-preference', 'keep']]);
  storage.set('userInfo', JSON.stringify(user));
  assert.equal(session.readStoredUser(), null);
});

test('service expiry notifications reach one centralized subscriber and unsubscribe cleanly', () => {
  let notifications = 0;
  const unsubscribe = session.subscribeSessionExpired(() => { notifications += 1; });
  session.notifySessionExpired();
  unsubscribe();
  session.notifySessionExpired();
  assert.equal(notifications, 1);
});

test('existing home API 401 paths report expiry without independent storage cleanup', async () => {
  const homeApi = loadSource('src/services/homeApi.ts');
  const { apiClient } = loadSource('src/services/apiClient.ts');
  const originalAdapter = apiClient.defaults.adapter;
  const requests = [];
  let notifications = 0;
  storage.set('accessToken', 'test-access-token');
  storage.set('unrelated-preference', 'keep');
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    const error = new Error('Request failed with status code 401');
    error.config = config;
    error.response = { status: 401, data: {}, headers: {}, config };
    throw error;
  };
  const unsubscribe = session.subscribeSessionExpired(() => { notifications += 1; });
  try {
    for (const request of [
      () => homeApi.getMyHomes(),
      () => homeApi.getHomeMembers('test-home'),
      () => homeApi.generateInvitation('test-home'),
      () => homeApi.joinHome('a+b&c'),
    ]) {
      await assert.rejects(request, /Phiên đăng nhập đã hết hạn/);
    }
    assert.equal(notifications, 4);
    assert.deepEqual(requests.map(({ method }) => method.toUpperCase()), ['GET', 'GET', 'POST', 'POST']);
    assert.equal(new URL(requests[3].url, 'http://backend.test').searchParams.get('codeOrToken'), 'a+b&c');
    assert.ok(requests.every(({ headers }) => headers.get('Authorization') === 'Bearer test-access-token'));
    assert.equal(storage.get('accessToken'), 'test-access-token');
    assert.equal(storage.get('unrelated-preference'), 'keep');
  } finally {
    apiClient.defaults.adapter = originalAdapter;
    unsubscribe();
  }
});
