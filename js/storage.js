/**
 * StackLab — Safe LocalStorage Manager
 * Persists calculation history, genuine application metrics, theme preference,
 * recent activity feed, and editable academic details.
 * Gracefully recovers from missing, disabled, quota-exceeded, or corrupted localStorage data.
 */
(function (global) {
  'use strict';

  const KEYS = Object.freeze({
    HISTORY: 'stacklab_calc_history_v1',
    METRICS: 'stacklab_app_metrics_v1',
    ACTIVITY: 'stacklab_recent_activity_v1',
    THEME: 'stacklab_theme_v1',
    ABOUT: 'stacklab_about_meta_v1'
  });

  const DEFAULT_METRICS = Object.freeze({
    totalCalculations: 0,
    totalConversions: 0,
    totalStackOperations: 0
  });

  let storageRecoveredFlag = false;

  function safeReadJSON(key, fallback, validatorFn) {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(key) : null;
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (validatorFn && !validatorFn(parsed)) {
        storageRecoveredFlag = true;
        safeWriteJSON(key, fallback);
        return fallback;
      }
      return parsed;
    } catch (_err) {
      storageRecoveredFlag = true;
      try {
        if (global.localStorage) global.localStorage.removeItem(key);
      } catch (_ignore) {}
      return fallback;
    }
  }

  function safeWriteJSON(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function isValidHistoryRecord(item) {
    return (
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.expression === 'string' &&
      (typeof item.result === 'number' || typeof item.result === 'string') &&
      typeof item.postfix === 'string' &&
      typeof item.prefix === 'string' &&
      typeof item.timestamp === 'string'
    );
  }

  function getHistory() {
    const data = safeReadJSON(KEYS.HISTORY, [], (arr) => Array.isArray(arr));
    const cleaned = data.filter(isValidHistoryRecord);
    if (cleaned.length !== data.length) {
      storageRecoveredFlag = true;
      safeWriteJSON(KEYS.HISTORY, cleaned);
    }
    return cleaned;
  }

  function addHistoryRecord({ expression, result, postfix, prefix }) {
    const history = getHistory();
    const record = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      expression: String(expression),
      result: Number(result),
      postfix: String(postfix),
      prefix: String(prefix),
      timestamp: new Date().toISOString()
    };
    history.unshift(record);
    if (history.length > 200) history.length = 200;
    safeWriteJSON(KEYS.HISTORY, history);
    return record;
  }

  function deleteHistoryRecord(id) {
    const history = getHistory().filter((item) => item.id !== id);
    safeWriteJSON(KEYS.HISTORY, history);
    return history;
  }

  function clearHistory() {
    safeWriteJSON(KEYS.HISTORY, []);
    return [];
  }

  function getMetrics() {
    const data = safeReadJSON(
      KEYS.METRICS,
      { ...DEFAULT_METRICS },
      (obj) =>
        obj &&
        typeof obj === 'object' &&
        typeof obj.totalCalculations === 'number' &&
        typeof obj.totalConversions === 'number' &&
        typeof obj.totalStackOperations === 'number'
    );
    return {
      totalCalculations: Math.max(0, Math.floor(data.totalCalculations || 0)),
      totalConversions: Math.max(0, Math.floor(data.totalConversions || 0)),
      totalStackOperations: Math.max(0, Math.floor(data.totalStackOperations || 0))
    };
  }

  function incrementMetrics({ calculations = 0, conversions = 0, stackOperations = 0 }) {
    const m = getMetrics();
    m.totalCalculations += Math.max(0, Number(calculations) || 0);
    m.totalConversions += Math.max(0, Number(conversions) || 0);
    m.totalStackOperations += Math.max(0, Number(stackOperations) || 0);
    safeWriteJSON(KEYS.METRICS, m);
    return m;
  }

  function getActivity() {
    const data = safeReadJSON(KEYS.ACTIVITY, [], (arr) => Array.isArray(arr));
    return data.filter(
      (item) => item && typeof item.type === 'string' && typeof item.summary === 'string' && typeof item.timestamp === 'string'
    );
  }

  function logActivity(type, summary, detail = '') {
    const list = getActivity();
    list.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: String(type),
      summary: String(summary),
      detail: String(detail),
      timestamp: new Date().toISOString()
    });
    if (list.length > 25) list.length = 25;
    safeWriteJSON(KEYS.ACTIVITY, list);
    return list;
  }

  function getTheme() {
    try {
      const saved = global.localStorage ? global.localStorage.getItem(KEYS.THEME) : null;
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch (_err) {
      return 'dark';
    }
  }

  function setTheme(theme) {
    const valid = theme === 'light' ? 'light' : 'dark';
    try {
      if (global.localStorage) global.localStorage.setItem(KEYS.THEME, valid);
    } catch (_err) {}
    return valid;
  }

  function getAboutMeta() {
    return safeReadJSON(
      KEYS.ABOUT,
      {
        studentName: '[Enter Student Name]',
        rollNumber: '[Enter Roll Number]',
        collegeName: '[Enter College / University Name]',
        facultyName: '[Enter Faculty / Guide Name]',
        academicYear: '[Enter Academic Year / Semester]'
      },
      (obj) => obj && typeof obj === 'object'
    );
  }

  function saveAboutMeta(meta) {
    safeWriteJSON(KEYS.ABOUT, {
      studentName: String(meta.studentName || '[Enter Student Name]'),
      rollNumber: String(meta.rollNumber || '[Enter Roll Number]'),
      collegeName: String(meta.collegeName || '[Enter College / University Name]'),
      facultyName: String(meta.facultyName || '[Enter Faculty / Guide Name]'),
      academicYear: String(meta.academicYear || '[Enter Academic Year / Semester]')
    });
  }

  function wasRecoveredFromCorruption() {
    return storageRecoveredFlag;
  }

  function resetRecoveryFlag() {
    storageRecoveredFlag = false;
  }

  /**
   * Build downloadable CSV string from history records (RFC-4180 escaped).
   */
  function exportHistoryAsCSV(records) {
    const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const header = ['Date & Time', 'Original Expression', 'Result', 'Postfix Notation', 'Prefix Notation'];
    const rows = (records || []).map((r) => [
      escapeCSV(new Date(r.timestamp).toLocaleString()),
      escapeCSV(r.expression),
      escapeCSV(r.result),
      escapeCSV(r.postfix),
      escapeCSV(r.prefix)
    ].join(','));
    return [header.join(','), ...rows].join('\n');
  }

  /**
   * Build downloadable plain-text report from history records.
   */
  function exportHistoryAsText(records) {
    const lines = [
      'StackLab — Calculation History Export',
      `Exported: ${new Date().toLocaleString()}`,
      `Total Records: ${(records || []).length}`,
      '='.repeat(68),
      ''
    ];
    (records || []).forEach((r, idx) => {
      lines.push(`#${idx + 1}  [${new Date(r.timestamp).toLocaleString()}]`);
      lines.push(`  Expression : ${r.expression}`);
      lines.push(`  Result     : ${r.result}`);
      lines.push(`  Postfix    : ${r.postfix}`);
      lines.push(`  Prefix     : ${r.prefix}`);
      lines.push('-'.repeat(68));
    });
    return lines.join('\n');
  }

  const Storage = {
    KEYS,
    getHistory,
    addHistoryRecord,
    deleteHistoryRecord,
    clearHistory,
    getMetrics,
    incrementMetrics,
    getActivity,
    logActivity,
    getTheme,
    setTheme,
    getAboutMeta,
    saveAboutMeta,
    wasRecoveredFromCorruption,
    resetRecoveryFlag,
    exportHistoryAsCSV,
    exportHistoryAsText
  };

  global.StackLab = global.StackLab || {};
  global.StackLab.Storage = Storage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
