import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationDigest } from '../scripts/verify_public.mjs';

test('publication comparison tolerates Windows checkout endings but detects content changes', () => {
  const linux = Buffer.from('<p>London</p>\n');
  assert.equal(publicationDigest('index.html', Buffer.from('<p>London</p>\r\n')), publicationDigest('index.html', linux));
  assert.notEqual(publicationDigest('index.html', Buffer.from('<p>Different edition</p>\r\n')), publicationDigest('index.html', linux));
});

test('binary publication data keeps exact bytes', () => {
  assert.notEqual(publicationDigest('icon.png', Buffer.from([13, 10])), publicationDigest('icon.png', Buffer.from([10])));
});
