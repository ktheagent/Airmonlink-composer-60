'use strict';

const path = require('node:path');

function safeExternalUrl(value) {
  const input = String(value || '').trim();
  if (!input || input.length > 2048) throw new Error('External URL is empty or exceeds the safety limit.');
  let parsed;
  try { parsed = new URL(input); } catch (_) { throw new Error('External URL is malformed.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links may open externally.');
  if (parsed.username || parsed.password) throw new Error('External links containing credentials are blocked.');
  if (!parsed.hostname || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('Localhost links may not open externally.');
  }
  return parsed.href;
}

function safeUserFilePath(value, options = {}) {
  const input = String(value || '').trim();
  if (!input || input.length > 4096 || input.includes('\0')) throw new Error('File path is empty or invalid.');
  const resolved = path.resolve(input);
  const allowedExtensions = (options.extensions || []).map(extension => String(extension).toLowerCase().replace(/^\./, ''));
  if (allowedExtensions.length) {
    const extension = path.extname(resolved).slice(1).toLowerCase();
    if (!allowedExtensions.includes(extension)) throw new Error(`File type .${extension || '(none)'} is not allowed.`);
  }
  return resolved;
}

function enforceInputSize(bytesOrText, maximumBytes, label = 'Input') {
  const size = typeof bytesOrText === 'string' ? Buffer.byteLength(bytesOrText) : Number(bytesOrText?.byteLength ?? bytesOrText?.length) || 0;
  const maximum = Math.max(1, Number(maximumBytes) || 1);
  if (size > maximum) {
    const error = new Error(`${label} exceeds the ${maximum}-byte safety limit.`);
    error.code = 'OVERSIZED_INPUT';
    throw error;
  }
  return size;
}

module.exports = Object.freeze({ safeExternalUrl, safeUserFilePath, enforceInputSize });
