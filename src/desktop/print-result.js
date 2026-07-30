'use strict';

const CANCELLATION_PATTERN = /\b(cancel(?:led|ed)?|user aborted|dialog closed|print job was canceled)\b/i;

function classifyPrintResult(success, failureReason = '') {
  if (success) {
    return Object.freeze({ success: true, canceled: false, reason: '' });
  }
  const reason = String(failureReason || '').trim();
  if (CANCELLATION_PATTERN.test(reason)) {
    return Object.freeze({
      success: false,
      canceled: true,
      reason: reason || 'Printing was cancelled.'
    });
  }
  return Object.freeze({
    success: false,
    canceled: false,
    reason: reason || 'Printing failed.'
  });
}

function completePrint(resolve, reject, success, failureReason) {
  const result = classifyPrintResult(success, failureReason);
  if (!result.success && !result.canceled) {
    reject(new Error(result.reason));
    return;
  }
  resolve(result);
}

module.exports = {
  CANCELLATION_PATTERN,
  classifyPrintResult,
  completePrint
};
