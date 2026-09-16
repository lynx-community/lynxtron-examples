import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { PAGE_INFO_SCRIPT } from '../src/app/page-info.mjs';

test('metadata uses the public bridge without changing page history or URL', () => {
  const location = Object.freeze({ href: 'https://example.com/#section', hash: '#section' });
  const messages = [];
  runInNewContext(PAGE_INFO_SCRIPT, {
    document: { title: 'Test page' },
    window: { location, postMessage: value => messages.push(JSON.parse(value)), cefQuery: () => assert.fail('internal bridge must not be used') },
  });
  assert.deepEqual(messages, [{ type: 'page_info', page_title: 'Test page', page_url: location.href }]);
});

test('untitled pages report their URL as the tab title', () => {
  let payload;
  runInNewContext(PAGE_INFO_SCRIPT, {
    document: { title: '' },
    window: { location: { href: 'http://127.0.0.1:18743/' }, postMessage: value => { payload = JSON.parse(value); } },
  });
  assert.equal(payload.page_title, 'http://127.0.0.1:18743/');
});
