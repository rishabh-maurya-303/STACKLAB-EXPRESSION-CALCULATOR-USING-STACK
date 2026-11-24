/**
 * StackLab — Main Application Controller
 * Integrates all 9 required modules + About Project without page reloads:
 *   1. Dashboard            6. Algorithm Analysis
 *   2. Expression Calculator 7. Expression Validation
 *   3. Notation Converter   8. Calculation History
 *   4. Stack Visualizer     9. Undo / Redo (Two Custom Stacks)
 *   5. Stack Playground    +  About Project
 */
(function (global) {
  'use strict';

  const {
    Validator,
    Converter,
    Evaluator,
    AlgorithmAnalyzer,
    UndoRedoManager,
    Storage,
    StackPlaygroundController,
    StackVisualizerController
  } = global.StackLab;

  const CONVERTER_EXAMPLES = Object.freeze({
    infix: [
      { label: '(5+3)*2', value: '(5+3)*2' },
      { label: '5+3*2', value: '5+3*2' },
      { label: '2^3^2 (Right-Assoc)', value: '2^3^2' },
      { label: '-2^2 (Unary vs Power)', value: '-2^2' },
      { label: '(-2)^2', value: '(-2)^2' },
      { label: '3.5*2+10/5', value: '3.5*2+10/5' }
    ],
    postfix: [
      { label: '5 3 + 2 *', value: '5 3 + 2 *' },
      { label: '5 3 2 * +', value: '5 3 2 * +' },
      { label: '2 3 2 ^ ^', value: '2 3 2 ^ ^' },
      { label: '2 2 ^ u-', value: '2 2 ^ u-' },
      { label: '20 5 / 2 +', value: '20 5 / 2 +' }
    ],
    prefix: [
      { label: '* + 5 3 2', value: '* + 5 3 2' },
      { label: '+ 5 * 3 2', value: '+ 5 * 3 2' },
      { label: '^ 2 ^ 3 2', value: '^ 2 ^ 3 2' },
      { label: 'u- ^ 2 2', value: 'u- ^ 2 2' },
      { label: '+ / 20 5 2', value: '+ / 20 5 2' }
    ]
  });

  const VALIDATION_EXAMPLES = Object.freeze({
    infix: [
      { label: 'Valid: (5+3)*2', value: '(5+3)*2' },
      { label: 'Valid: 2^3^2', value: '2^3^2' },
      { label: 'Valid: -2^2', value: '-2^2' },
      { label: 'Invalid: 5+*3 (Consecutive ops)', value: '5+*3' },
      { label: 'Invalid: (5+3 (Unclosed bracket)', value: '(5+3' },
      { label: 'Invalid: 5+3) (Extra bracket)', value: '5+3)' },
      { label: 'Invalid: 10/0 (Division by zero)', value: '10/0' },
      { label: 'Invalid: 5+ (Missing operand)', value: '5+' },
      { label: 'Invalid: *5+3 (Leading operator)', value: '*5+3' },
      { label: 'Invalid: (5+3)(10-2) (Missing op)', value: '(5+3)(10-2)' }
    ],
    postfix: [
      { label: 'Valid: 5 3 + 2 *', value: '5 3 + 2 *' },
      { label: 'Invalid: 5 + 3 (Infix format)', value: '5 + 3' },
      { label: 'Invalid: 5 3 2 + (Extra operand)', value: '5 3 2 +' },
      { label: 'Invalid: 10 0 / (Div by zero)', value: '10 0 /' }
    ],
    prefix: [
      { label: 'Valid: * + 5 3 2', value: '* + 5 3 2' },
      { label: 'Invalid: + 5 (Missing operand)', value: '+ 5' },
      { label: 'Invalid: + 5 3 2 (Extra operand)', value: '+ 5 3 2' },
      { label: 'Invalid: / 10 0 (Div by zero)', value: '/ 10 0' }
    ]
  });

  const AppState = {
    activeSection: 'dashboard',
    analyzer: new AlgorithmAnalyzer(),
    undoRedo: new UndoRedoManager('', 100),
    playground: null,
    visualizer: null,
    lastCalcResult: null,
    lastConvertResult: null,
    lastValidationSuggestion: null,
    typingTimer: null
  };

  /* -------------------------------------------------------------------------
   * Utility Helpers (Toast, Clipboard, Safe Download, Formatting)
   * ----------------------------------------------------------------------- */
  function showToast(message, variant = 'primary') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-bg-${variant} border-0 show mb-2`;
    toastEl.setAttribute('role', 'status');

    const inner = document.createElement('div');
    inner.className = 'd-flex';

    const body = document.createElement('div');
    body.className = 'toast-body small';
    body.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => toastEl.remove());

    inner.append(body, closeBtn);
    toastEl.appendChild(inner);
    container.appendChild(toastEl);

    global.setTimeout(() => {
      if (toastEl.parentNode) toastEl.remove();
    }, 2800);
  }

  async function copyToClipboard(text, label = 'Value') {
    const val = String(text ?? '').trim();
    if (!val) {
      showToast(`Nothing to copy for ${label}.`, 'warning');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(val);
      } else {
        const ta = document.createElement('textarea');
        ta.value = val;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(`${label} copied to clipboard.`, 'success');
    } catch (_err) {
      showToast('Clipboard copy failed in this browser context.', 'danger');
    }
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function countStackOps(stats) {
    if (!stats) return 0;
    return (Number(stats.pushes) || 0) + (Number(stats.pops) || 0) + (Number(stats.peeks) || 0);
  }

  /* -------------------------------------------------------------------------
   * Theme Management (Dark / Light with localStorage)
   * ----------------------------------------------------------------------- */
  function applyTheme(theme) {
    const mode = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
    Storage.setTheme(mode);

    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      const icon = btn.querySelector('i');
      const label = btn.querySelector('.theme-label');
      if (icon) {
        icon.className = mode === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
      }
      if (label) {
        label.textContent = mode === 'dark' ? 'Light Mode' : 'Dark Mode';
      }
    });
  }

  function initTheme() {
    applyTheme(Storage.getTheme());
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    });
  }

  /* -------------------------------------------------------------------------
   * SPA Navigation (Desktop Sidebar + Mobile Offcanvas + Quick Action Cards)
   * ----------------------------------------------------------------------- */
  const SECTION_TITLES = Object.freeze({
    dashboard: 'Dashboard',
    calculator: 'Expression Calculator',
    converter: 'Notation Converter',
    visualizer: 'Interactive Stack Visualizer',
    playground: 'Stack Playground',
    analysis: 'Algorithm Analysis',
    validation: 'Expression Validation',
    history: 'Calculation History',
    undoredo: 'Undo / Redo (Two-Stack)',
    about: 'About Project'
  });

  function navigateTo(sectionId) {
    if (!SECTION_TITLES[sectionId]) return;

    // Pause visualizer playback cleanly when leaving visualizer section
    if (AppState.activeSection === 'visualizer' && sectionId !== 'visualizer' && AppState.visualizer) {
      AppState.visualizer.pause();
    }

    AppState.activeSection = sectionId;

    document.querySelectorAll('.app-section').forEach((sec) => {
      sec.classList.toggle('d-none', sec.id !== `section-${sectionId}`);
    });

    document.querySelectorAll('[data-nav-target]').forEach((el) => {
      const isMatch = el.getAttribute('data-nav-target') === sectionId;
      if (el.classList.contains('sidebar-link')) {
        el.classList.toggle('active', isMatch);
        el.setAttribute('aria-current', isMatch ? 'page' : 'false');
      }
    });

    const pageTitle = document.getElementById('topbar-page-title');
    if (pageTitle) pageTitle.textContent = SECTION_TITLES[sectionId];

    // Refresh section-specific views on entry
    if (sectionId === 'dashboard') renderDashboard();
    if (sectionId === 'analysis') renderAnalysis();
    if (sectionId === 'history') renderHistory();
    if (sectionId === 'undoredo') renderUndoRedoViews();

    // Close mobile offcanvas if open
    const offcanvasEl = document.getElementById('mobileSidebar');
    if (offcanvasEl && global.bootstrap && global.bootstrap.Offcanvas) {
      const inst = global.bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (inst) inst.hide();
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function initNavigation() {
    document.querySelectorAll('[data-nav-target]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.getAttribute('data-nav-target');
        navigateTo(target);
      });
    });
  }

  /* -------------------------------------------------------------------------
   * Module 1: Dashboard (Driven 100% by Real Metrics & Activity)
   * ----------------------------------------------------------------------- */
  function renderDashboard() {
    const metrics = Storage.getMetrics();
    const history = Storage.getHistory();
    const activities = Storage.getActivity();

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setEl('dash-total-calcs', metrics.totalCalculations);
    setEl('dash-total-convs', metrics.totalConversions);
    setEl('dash-total-ops', metrics.totalStackOperations);
    setEl('dash-history-count', history.length);

    const recoveryBanner = document.getElementById('dash-storage-recovery');
    if (recoveryBanner) {
      recoveryBanner.classList.toggle('d-none', !Storage.wasRecoveredFromCorruption());
    }

    const feed = document.getElementById('dash-activity-list');
    if (!feed) return;
    feed.textContent = '';

    if (activities.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent text-muted small py-3 text-center';
      li.textContent = 'No activity yet. Calculate an expression, convert notation, or push to the Stack Playground to record live stats.';
      feed.appendChild(li);
      return;
    }

    activities.slice(0, 8).forEach((act) => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent d-flex justify-content-between align-items-start gap-2 px-0';

      const left = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'badge bg-primary-subtle text-primary-emphasis me-2';
      badge.textContent = act.type;

      const summary = document.createElement('span');
      summary.className = 'small fw-medium';
      summary.textContent = act.summary;

      left.append(badge, summary);
      if (act.detail) {
        const sub = document.createElement('div');
        sub.className = 'text-muted xsmall font-monospace mt-1';
        sub.textContent = act.detail;
        left.appendChild(sub);
      }

      const time = document.createElement('span');
      time.className = 'text-muted xsmall text-nowrap';
      time.textContent = new Date(act.timestamp).toLocaleTimeString();

      li.append(left, time);
      feed.appendChild(li);
    });
  }

  /* -------------------------------------------------------------------------
   * Module 9 & Shared Synchronization: Undo / Redo (Two Custom Stacks)
   * ----------------------------------------------------------------------- */
  function commitExpressionState(newExpr, source = 'calculator') {
    AppState.undoRedo.setState(newExpr);
    syncExpressionInputs(AppState.undoRedo.currentState, source);
    renderUndoRedoViews();
  }

  function syncExpressionInputs(value, skipSource = null) {
    const calcInput = document.getElementById('calc-expr-input');
    const urInput = document.getElementById('ur-expr-input');
    if (calcInput && skipSource !== 'calc-input') calcInput.value = value;
    if (urInput && skipSource !== 'ur-input') urInput.value = value;
  }

  function performUndo() {
    const res = AppState.undoRedo.undo();
    if (!res.success) {
      showToast(res.error, 'warning');
      return;
    }
    Storage.incrementMetrics({ stackOperations: 2 }); // 1 pop + 1 push
    syncExpressionInputs(res.currentState);
    renderUndoRedoViews();
    renderDashboard();
  }

  function performRedo() {
    const res = AppState.undoRedo.redo();
    if (!res.success) {
      showToast(res.error, 'warning');
      return;
    }
    Storage.incrementMetrics({ stackOperations: 2 }); // 1 pop + 1 push
    syncExpressionInputs(res.currentState);
    renderUndoRedoViews();
    renderDashboard();
  }

  function performClearUndoRedo() {
    AppState.undoRedo.clearHistory();
    renderUndoRedoViews();
    showToast('Undo and Redo stacks cleared.', 'info');
  }

  function renderMiniStack(container, items, emptyText) {
    if (!container) return;
    container.textContent = '';
    if (!items || items.length === 0) {
      const div = document.createElement('div');
      div.className = 'stack-empty-placeholder';
      div.textContent = emptyText;
      container.appendChild(div);
      return;
    }
    const rev = [...items].reverse();
    rev.forEach((item, idx) => {
      const node = document.createElement('div');
      node.className = `stack-node ${idx === 0 ? 'is-top' : ''}`;

      const val = document.createElement('span');
      val.className = 'stack-node-value';
      val.textContent = item === '' ? '(empty)' : item;

      const tags = document.createElement('span');
      tags.className = 'stack-node-tags';
      if (idx === 0) {
        const b = document.createElement('span');
        b.className = 'badge bg-primary';
        b.textContent = 'TOP';
        tags.appendChild(b);
      }
      node.append(val, tags);
      container.appendChild(node);
    });
  }

  function renderUndoRedoViews() {
    const snap = AppState.undoRedo.getSnapshot();

    // Update Calculator integrated Undo/Redo controls
    const calcUndoBtn = document.getElementById('calc-undo-btn');
    const calcRedoBtn = document.getElementById('calc-redo-btn');
    const calcUndoCount = document.getElementById('calc-undo-count');
    const calcRedoCount = document.getElementById('calc-redo-count');
    if (calcUndoBtn) calcUndoBtn.disabled = !snap.canUndo;
    if (calcRedoBtn) calcRedoBtn.disabled = !snap.canRedo;
    if (calcUndoCount) calcUndoCount.textContent = String(snap.undoCount);
    if (calcRedoCount) calcRedoCount.textContent = String(snap.redoCount);

    // Update Dedicated Undo/Redo module view
    const urUndoBtn = document.getElementById('ur-undo-btn');
    const urRedoBtn = document.getElementById('ur-redo-btn');
    const urClearBtn = document.getElementById('ur-clear-btn');
    const urCurrent = document.getElementById('ur-current-expr');
    const urUndoCount = document.getElementById('ur-undo-count');
    const urRedoCount = document.getElementById('ur-redo-count');

    if (urUndoBtn) urUndoBtn.disabled = !snap.canUndo;
    if (urRedoBtn) urRedoBtn.disabled = !snap.canRedo;
    if (urClearBtn) urClearBtn.disabled = !snap.canUndo && !snap.canRedo;
    if (urCurrent) urCurrent.textContent = snap.currentState === '' ? '(empty)' : snap.currentState;
    if (urUndoCount) urUndoCount.textContent = String(snap.undoCount);
    if (urRedoCount) urRedoCount.textContent = String(snap.redoCount);

    renderMiniStack(document.getElementById('ur-undo-stack-visual'), snap.undoItems, 'Undo Stack is empty');
    renderMiniStack(document.getElementById('ur-redo-stack-visual'), snap.redoItems, 'Redo Stack is empty');
  }

  function initUndoRedoModule() {
    const urInput = document.getElementById('ur-expr-input');
    const urCommitBtn = document.getElementById('ur-commit-btn');
    const urUndoBtn = document.getElementById('ur-undo-btn');
    const urRedoBtn = document.getElementById('ur-redo-btn');
    const urClearBtn = document.getElementById('ur-clear-btn');

    if (urCommitBtn) {
      urCommitBtn.addEventListener('click', () => {
        const val = urInput.value;
        if (val === AppState.undoRedo.currentState) {
          showToast('State unchanged — edit the expression to push a new Undo snapshot.', 'info');
          return;
        }
        commitExpressionState(val, 'ur-btn');
        showToast('Saved expression state to Undo Stack (Redo Stack cleared).', 'success');
      });
    }

    if (urInput) {
      urInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          urCommitBtn.click();
        }
      });
    }

    if (urUndoBtn) urUndoBtn.addEventListener('click', performUndo);
    if (urRedoBtn) urRedoBtn.addEventListener('click', performRedo);
    if (urClearBtn) urClearBtn.addEventListener('click', performClearUndoRedo);

    document.querySelectorAll('.ur-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-expr') || '';
        commitExpressionState(val, 'preset');
      });
    });

    renderUndoRedoViews();
  }

  /* -------------------------------------------------------------------------
   * Module 2: Expression Calculator
   * ----------------------------------------------------------------------- */
  function renderCalcResult(res) {
    const alertBox = document.getElementById('calc-alert-box');
    const panel = document.getElementById('calc-results-panel');
    const origEl = document.getElementById('calc-res-original');
    const statusEl = document.getElementById('calc-res-status');
    const finalEl = document.getElementById('calc-res-final');
    const postfixEl = document.getElementById('calc-res-postfix');
    const prefixEl = document.getElementById('calc-res-prefix');
    const explainEl = document.getElementById('calc-res-explanation');
    const opsBody = document.getElementById('calc-res-ops-body');
    const vizBtn = document.getElementById('calc-visualize-btn');

    if (!res.success) {
      AppState.lastCalcResult = null;
      alertBox.className = 'alert alert-danger py-2 px-3 small mb-3';
      alertBox.textContent = res.suggestion
        ? `${res.error} Suggestion: ${res.suggestion}`
        : res.error;
      alertBox.classList.remove('d-none');

      statusEl.textContent = 'INVALID';
      statusEl.className = 'badge bg-danger';
      origEl.textContent = document.getElementById('calc-expr-input').value.trim() || '—';
      finalEl.textContent = 'Error';
      postfixEl.textContent = res.postfix || '—';
      prefixEl.textContent = res.prefix || '—';
      explainEl.textContent = res.error;
      opsBody.textContent = '';
      if (vizBtn) vizBtn.disabled = true;
      panel.classList.remove('opacity-50');
      return;
    }

    AppState.lastCalcResult = res;
    alertBox.classList.add('d-none');
    panel.classList.remove('opacity-50');

    origEl.textContent = res.original;
    statusEl.textContent = 'VALID';
    statusEl.className = 'badge bg-success';
    finalEl.textContent = String(res.result);
    postfixEl.textContent = res.postfix;
    prefixEl.textContent = res.prefix;
    explainEl.textContent = res.explanation;
    if (vizBtn) vizBtn.disabled = false;

    opsBody.textContent = '';
    if (res.operations.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'text-muted small text-center';
      td.textContent = 'Single numeric operand — no operator reduction needed.';
      tr.appendChild(td);
      opsBody.appendChild(tr);
    } else {
      res.operations.forEach((op, idx) => {
        const tr = document.createElement('tr');
        const c1 = document.createElement('td');
        c1.textContent = String(idx + 1);
        const c2 = document.createElement('td');
        c2.className = 'font-monospace';
        c2.textContent = op.operator;
        const c3 = document.createElement('td');
        c3.className = 'font-monospace';
        c3.textContent = op.expression;
        tr.append(c1, c2, c3);
        opsBody.appendChild(tr);
      });
    }
  }

  // function resolveCalculatorExpression(expression) {
  //   const varsRaw = document.getElementById('calc-variable-values')?.value || '';
  //   const values = {};
  //   varsRaw.split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
  //     const match = part.match(/^([a-zA-Z])\s*=\s*(-?(?:\d+(?:\.\d+)?|\.\d+))$/);
  //     if (!match) throw new Error(`Invalid variable assignment "${part}". Use a=5, b=3.`);
  //     values[match[1].toLowerCase()] = Number(match[2]);
  //   });
  //   const names = [...new Set((expression.match(/[a-zA-Z]/g) || []).map(ch => ch.toLowerCase()))];
  //   const missing = names.filter(name => !Object.prototype.hasOwnProperty.call(values, name));
  //   if (missing.length) throw new Error(`Missing value for variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Add ${missing.map(name => `${name}=value`).join(', ')}.`);
  //   const resolved = expression.replace(/[a-zA-Z]/g, ch => `(${values[ch.toLowerCase()]})`);
  //   return { resolved, values, names };
  // }

  function handleCalculate() {
  const input = document.getElementById('calc-expr-input');
  const expr = input.value.trim();

  commitExpressionState(expr, 'calc-submit');

  let res;

  if (/[a-zA-Z]/.test(expr)) {
    res = {
      success: false,
      error: 'Calculator supports numeric expressions only. Please use numbers instead of variables.'
    };
  } else {
    res = Evaluator.evaluateInfix(expr);
  }

  renderCalcResult(res);

  if (res.success) {
    const opsUsed = countStackOps(res.stats);

    Storage.addHistoryRecord({
      expression: res.original,
      result: res.result,
      postfix: res.postfix,
      prefix: res.prefix
    });

    Storage.incrementMetrics({
      calculations: 1,
      stackOperations: opsUsed
    });

    Storage.logActivity(
      'Calculate',
      `${res.original} = ${res.result}`,
      `Postfix: ${res.postfix}`
    );

    AppState.analyzer.recordRun({
      algorithm: 'Postfix Evaluation',
      expression: res.postfix,
      tokensProcessed: res.tokensProcessed,
      stats: res.evaluationStats
    });

    AppState.analyzer.recordRun({
      algorithm: 'Infix to Postfix',
      expression: res.original,
      tokensProcessed: res.tokensProcessed,
      stats: res.conversionStats
    });

    renderDashboard();
    renderHistory();
    renderAnalysis();
  }
}

  function handleCalcValidateOnly() {
  const input = document.getElementById('calc-expr-input');
  const expr = input.value.trim();

  const alertBox = document.getElementById('calc-alert-box');
  const statusEl = document.getElementById('calc-res-status');

  if (/[a-zA-Z]/.test(expr)) {
    alertBox.className = 'alert alert-danger py-2 px-3 small mb-3';
    alertBox.textContent =
      'Calculator supports numeric expressions only. Please remove variables.';
    alertBox.classList.remove('d-none');

    statusEl.textContent = 'INVALID';
    statusEl.className = 'badge bg-danger';
    return;
  }

  const v = Validator.validateInfix(expr);

  if (!v.valid) {
    alertBox.className = 'alert alert-danger py-2 px-3 small mb-3';
    alertBox.textContent = v.suggestion
      ? `${v.message} Suggestion: ${v.suggestion}`
      : v.message;

    alertBox.classList.remove('d-none');

    statusEl.textContent = 'INVALID';
    statusEl.className = 'badge bg-danger';
    return;
  }

  // Check mathematical safety, including division/modulus by zero.
  const evalCheck = Evaluator.evaluateInfix(expr);

  if (!evalCheck.success) {
    alertBox.className = 'alert alert-warning py-2 px-3 small mb-3';
    alertBox.textContent =
      `Syntax is valid, but evaluation fails: ${evalCheck.error}`;

    alertBox.classList.remove('d-none');

    statusEl.textContent = 'RUNTIME ERROR';
    statusEl.className = 'badge bg-warning text-dark';
    return;
  }

  alertBox.className = 'alert alert-success py-2 px-3 small mb-3';
  alertBox.textContent =
    `Valid numeric expression (${v.tokens.length} tokens). Ready to calculate.`;

  alertBox.classList.remove('d-none');

  statusEl.textContent = 'VALID';
  statusEl.className = 'badge bg-success';
}

  function initCalculator() {
    const input = document.getElementById('calc-expr-input');
    if (!input) return;

    // Keypad buttons
    document.querySelectorAll('.calc-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        const token = btn.getAttribute('data-key');
        const nextVal = input.value + token;
        commitExpressionState(nextVal, 'keypad');
        input.focus();
      });
    });

    document.getElementById('calc-backspace-btn').addEventListener('click', () => {
      if (input.value.length > 0) {
        commitExpressionState(input.value.slice(0, -1), 'backspace');
      }
      input.focus();
    });

    document.getElementById('calc-clear-btn').addEventListener('click', () => {
      if (input.value !== '') {
        commitExpressionState('', 'clear');
      }
      document.getElementById('calc-alert-box').classList.add('d-none');
      input.focus();
    });

    document.getElementById('calc-calculate-btn').addEventListener('click', handleCalculate);
    document.getElementById('calc-validate-btn').addEventListener('click', handleCalcValidateOnly);

    document.getElementById('calc-undo-btn').addEventListener('click', performUndo);
    document.getElementById('calc-redo-btn').addEventListener('click', performRedo);
    document.getElementById('calc-clear-ur-btn').addEventListener('click', performClearUndoRedo);

    document.getElementById('calc-example-select').addEventListener('change', (e) => {
      if (e.target.value) {
        commitExpressionState(e.target.value, 'example');
        handleCalculate();
        e.target.value = '';
      }
    });

    document.getElementById('calc-copy-btn').addEventListener('click', () => {
      if (AppState.lastCalcResult) {
        copyToClipboard(AppState.lastCalcResult.result, 'Calculation result');
      } else {
        showToast('Calculate an expression first to copy its result.', 'warning');
      }
    });

    document.getElementById('calc-visualize-btn').addEventListener('click', () => {
      if (AppState.lastCalcResult) {
        navigateTo('visualizer');
        AppState.visualizer.loadExternal('infix-to-postfix', AppState.lastCalcResult.original);
      }
    });

    // Keyboard shortcuts inside calculator input
    input.addEventListener('input', () => {
      global.clearTimeout(AppState.typingTimer);
      AppState.typingTimer = global.setTimeout(() => {
        commitExpressionState(input.value, 'calc-input');
      }, 350);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCalculate();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        performRedo();
      }
    });
  }

  /* -------------------------------------------------------------------------
   * Module 3: Notation Converter (All 6 Conversions)
   * ----------------------------------------------------------------------- */
  function populateConverterExamples(sourceNotation) {
    const sel = document.getElementById('conv-example-select');
    if (!sel) return;
    sel.textContent = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = `Load ${sourceNotation.toUpperCase()} example...`;
    sel.appendChild(def);

    (CONVERTER_EXAMPLES[sourceNotation] || []).forEach((ex) => {
      const opt = document.createElement('option');
      opt.value = ex.value;
      opt.textContent = ex.label;
      sel.appendChild(opt);
    });
  }

  function handleConvert() {
    const src = document.getElementById('conv-source-select').value;
    const tgt = document.getElementById('conv-target-select').value;
    const expr = document.getElementById('conv-expr-input').value.trim();
    const alertBox = document.getElementById('conv-alert-box');
    const outputEl = document.getElementById('conv-result-output');
    const algoBadge = document.getElementById('conv-algo-badge');
    const stepsBody = document.getElementById('conv-steps-body');
    const vizBtn = document.getElementById('conv-visualize-btn');

    const res = Converter.convert(expr, src, tgt, { recordTrace: true });

    if (!res.success) {
      AppState.lastConvertResult = null;
      alertBox.className = 'alert alert-danger py-2 px-3 small mb-3';
      alertBox.textContent = res.suggestion ? `${res.error} Suggestion: ${res.suggestion}` : res.error;
      alertBox.classList.remove('d-none');
      outputEl.textContent = 'Conversion failed';
      algoBadge.textContent = 'ERROR';
      algoBadge.className = 'badge bg-danger';
      stepsBody.textContent = '';
      if (vizBtn) vizBtn.disabled = true;
      return;
    }

    AppState.lastConvertResult = res;
    alertBox.classList.add('d-none');
    outputEl.textContent = res.result;
    algoBadge.textContent = res.algorithm;
    algoBadge.className = 'badge bg-primary';

    const canVisualize = (src === 'infix' && (tgt === 'postfix' || tgt === 'prefix'));
    if (vizBtn) vizBtn.disabled = !canVisualize;

    stepsBody.textContent = '';
    (res.trace || []).forEach((st) => {
      const tr = document.createElement('tr');
      const cols = [
        String(st.step),
        st.token,
        st.operation,
        st.stackState.length ? `[ ${st.stackState.join(', ')} ]` : '[ empty ]',
        st.output || '—',
        st.description
      ];
      cols.forEach((txt, idx) => {
        const td = document.createElement('td');
        td.textContent = txt;
        if (idx === 1 || idx === 3 || idx === 4) td.className = 'font-monospace small';
        if (idx === 5) td.className = 'small';
        tr.appendChild(td);
      });
      stepsBody.appendChild(tr);
    });

    const ops = countStackOps(res.stats);
    Storage.incrementMetrics({ conversions: 1, stackOperations: ops });
    Storage.logActivity('Convert', `${src.toUpperCase()} -> ${tgt.toUpperCase()}`, `${expr}  ==>  ${res.result}`);
    AppState.analyzer.recordRun({
      algorithm: res.algorithm,
      expression: expr,
      tokensProcessed: res.tokensProcessed,
      stats: res.stats
    });
    renderDashboard();
    renderAnalysis();
  }

  function initConverter() {
    const srcSel = document.getElementById('conv-source-select');
    const tgtSel = document.getElementById('conv-target-select');
    const exprInput = document.getElementById('conv-expr-input');
    if (!srcSel) return;

    populateConverterExamples(srcSel.value);

    srcSel.addEventListener('change', () => {
      if (srcSel.value === tgtSel.value) {
        tgtSel.value = srcSel.value === 'infix' ? 'postfix' : 'infix';
      }
      populateConverterExamples(srcSel.value);
    });

    document.getElementById('conv-swap-btn').addEventListener('click', () => {
      const oldSrc = srcSel.value;
      const oldTgt = tgtSel.value;
      srcSel.value = oldTgt;
      tgtSel.value = oldSrc;
      populateConverterExamples(srcSel.value);
      if (AppState.lastConvertResult && AppState.lastConvertResult.result) {
        exprInput.value = AppState.lastConvertResult.result;
      }
    });

    document.getElementById('conv-example-select').addEventListener('change', (e) => {
      if (e.target.value) {
        exprInput.value = e.target.value;
        handleConvert();
        e.target.value = '';
      }
    });

    document.getElementById('conv-convert-btn').addEventListener('click', handleConvert);
    exprInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConvert();
      }
    });

    document.getElementById('conv-clear-btn').addEventListener('click', () => {
      exprInput.value = '';
      AppState.lastConvertResult = null;
      document.getElementById('conv-result-output').textContent = 'Result will appear here';
      document.getElementById('conv-steps-body').textContent = '';
      document.getElementById('conv-alert-box').classList.add('d-none');
      document.getElementById('conv-visualize-btn').disabled = true;
    });

    document.getElementById('conv-copy-btn').addEventListener('click', () => {
      if (AppState.lastConvertResult) {
        copyToClipboard(AppState.lastConvertResult.result, 'Converted expression');
      } else {
        showToast('Convert an expression first to copy.', 'warning');
      }
    });

    document.getElementById('conv-visualize-btn').addEventListener('click', () => {
      if (!AppState.lastConvertResult) return;
      const mode = AppState.lastConvertResult.target === 'prefix' ? 'infix-to-prefix' : 'infix-to-postfix';
      navigateTo('visualizer');
      AppState.visualizer.loadExternal(mode, AppState.lastConvertResult.input);
    });
  }

  /* -------------------------------------------------------------------------
   * Module 6: Algorithm Analysis (Real Metrics + Big-O Reference Table)
   * ----------------------------------------------------------------------- */
  function renderAnalysis(selectedRunId = null) {
    // Populate static Big-O Complexity Reference Table once
    const tableBody = document.getElementById('analysis-complexity-body');
    if (tableBody && tableBody.childElementCount === 0) {
      AppState.analyzer.getComplexityTable().forEach((row) => {
        const tr = document.createElement('tr');
        const tdAlgo = document.createElement('td');
        tdAlgo.className = 'fw-medium';
        tdAlgo.textContent = row.algorithm;

        const tdTime = document.createElement('td');
        const timeBadge = document.createElement('span');
        timeBadge.className = `badge font-monospace ${row.time === 'O(1)' ? 'bg-success-subtle text-success-emphasis' : 'bg-primary-subtle text-primary-emphasis'}`;
        timeBadge.textContent = row.time;
        tdTime.appendChild(timeBadge);

        const tdSpace = document.createElement('td');
        const spaceBadge = document.createElement('span');
        spaceBadge.className = `badge font-monospace ${row.space === 'O(1)' ? 'bg-success-subtle text-success-emphasis' : 'bg-info-subtle text-info-emphasis'}`;
        spaceBadge.textContent = row.space;
        tdSpace.appendChild(spaceBadge);

        const tdNotes = document.createElement('td');
        tdNotes.className = 'small text-muted';
        tdNotes.textContent = row.notes;

        tr.append(tdAlgo, tdTime, tdSpace, tdNotes);
        tableBody.appendChild(tr);
      });
    }

    const runs = AppState.analyzer.getAllRuns();
    const selector = document.getElementById('analysis-run-select');
    if (selector) {
      selector.textContent = '';
      if (runs.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No executions recorded yet — run Calculator, Converter, or Visualizer';
        selector.appendChild(opt);
      } else {
        runs.forEach((r) => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = `${r.algorithm} — "${r.expression}" (${r.totalOperations} ops)`;
          selector.appendChild(opt);
        });
        if (selectedRunId) selector.value = selectedRunId;
      }
    }

    const run = selectedRunId ? AppState.analyzer.getRunById(selectedRunId) : AppState.analyzer.getLatestRun();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    if (!run) {
      set('an-algo-name', 'No run recorded yet');
      set('an-expr-val', 'Run any algorithm to inspect real Stack counts');
      set('an-tokens', '0');
      set('an-pushes', '0');
      set('an-pops', '0');
      set('an-peeks', '0');
      set('an-maxsize', '0');
      set('an-total-ops', '0');
      set('an-time-comp', '—');
      set('an-space-comp', '—');
      updateAnalysisBars(0, 0, 0);
      return;
    }

    set('an-algo-name', run.algorithm);
    set('an-expr-val', run.expression);
    set('an-tokens', run.tokensProcessed);
    set('an-pushes', run.pushes);
    set('an-pops', run.pops);
    set('an-peeks', run.peeks);
    set('an-maxsize', run.maxStackSize);
    set('an-total-ops', run.totalOperations);
    set('an-time-comp', run.timeComplexity);
    set('an-space-comp', run.spaceComplexity);
    updateAnalysisBars(run.pushes, run.pops, run.peeks);
  }

  function updateAnalysisBars(pushes, pops, peeks) {
    const maxVal = Math.max(1, pushes, pops, peeks);
    const setBar = (barId, labelId, count) => {
      const bar = document.getElementById(barId);
      const lbl = document.getElementById(labelId);
      if (bar) bar.style.width = `${Math.round((count / maxVal) * 100)}%`;
      if (lbl) lbl.textContent = String(count);
    };
    setBar('an-bar-push', 'an-bar-push-lbl', pushes);
    setBar('an-bar-pop', 'an-bar-pop-lbl', pops);
    setBar('an-bar-peek', 'an-bar-peek-lbl', peeks);
  }

  function initAnalysis() {
    const sel = document.getElementById('analysis-run-select');
    if (sel) {
      sel.addEventListener('change', () => {
        if (sel.value) renderAnalysis(sel.value);
      });
    }
    const clearBtn = document.getElementById('analysis-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        AppState.analyzer.clearRuns();
        renderAnalysis();
        showToast('Cleared recorded execution runs.', 'info');
      });
    }
    renderAnalysis();
  }

  /* -------------------------------------------------------------------------
   * Module 7: Expression Validation (Independent Multi-Stage Validator)
   * ----------------------------------------------------------------------- */
  function populateValidationExamples(notation) {
    const sel = document.getElementById('val-example-select');
    if (!sel) return;
    sel.textContent = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Load validation test case...';
    sel.appendChild(def);

    (VALIDATION_EXAMPLES[notation] || []).forEach((ex) => {
      const opt = document.createElement('option');
      opt.value = ex.value;
      opt.textContent = ex.label;
      sel.appendChild(opt);
    });
  }

  function runValidationCheck() {
    const notation = document.getElementById('val-notation-select').value;
    const rawExpr = document.getElementById('val-expr-input').value;

    const statusBadge = document.getElementById('val-status-badge');
    const msgEl = document.getElementById('val-message');
    const posWrap = document.getElementById('val-position-wrap');
    const posCode = document.getElementById('val-position-code');
    const sugWrap = document.getElementById('val-suggestion-wrap');
    const sugText = document.getElementById('val-suggestion-text');
    const applyBtn = document.getElementById('val-apply-suggestion-btn');
    const checksList = document.getElementById('val-checks-list');

    const v = Validator.validate(rawExpr, notation);
    let runtimeCheck = { passed: false, detail: 'Skipped because syntax validation failed.' };
    let finalValid = v.valid;
    let finalMessage = v.message;
    let finalPosition = v.position;
    let finalSuggestion = v.suggestion;

    // If syntax passed, also check mathematical safety (Division/Modulus by zero)
    if (v.valid) {
      let evalRes;
      if (notation === 'infix') evalRes = Evaluator.evaluateInfix(rawExpr);
      else if (notation === 'postfix') evalRes = Evaluator.evaluatePostfix(rawExpr);
      else evalRes = Evaluator.evaluatePrefix(rawExpr);

      if (evalRes.success) {
        runtimeCheck = { passed: true, detail: `Evaluates safely to ${evalRes.result} (no division/modulus by zero).` };
      } else {
        finalValid = false;
        finalMessage = evalRes.error;
        runtimeCheck = { passed: false, detail: evalRes.error };
        finalSuggestion = 'Ensure denominators in "/" and "%" operations are non-zero.';
      }
    }

    if (v.bracketStats) {
      Storage.incrementMetrics({ stackOperations: countStackOps(v.bracketStats) });
      AppState.analyzer.recordRun({
        algorithm: 'Bracket Matching',
        expression: rawExpr,
        tokensProcessed: rawExpr.replace(/\s+/g, '').length,
        stats: v.bracketStats
      });
      renderDashboard();
      renderAnalysis();
    }

    statusBadge.textContent = finalValid ? 'VALID' : 'INVALID';
    statusBadge.className = `badge fs-6 ${finalValid ? 'bg-success' : 'bg-danger'}`;
    msgEl.textContent = finalMessage;

    // Render exact error character pointer without modifying user input
    if (!finalValid && typeof finalPosition === 'number' && rawExpr.length > 0) {
      const clamped = Math.max(0, Math.min(finalPosition, rawExpr.length));
      const pointerLine = `${' '.repeat(clamped)}^ (position ${finalPosition})`;
      posCode.textContent = `${rawExpr}\n${pointerLine}`;
      posWrap.classList.remove('d-none');
    } else {
      posWrap.classList.add('d-none');
    }

    // Show suggestion; allow user to explicitly apply it if it looks like a corrected expression
    AppState.lastValidationSuggestion = null;
    if (!finalValid && finalSuggestion) {
      sugText.textContent = finalSuggestion;
      sugWrap.classList.remove('d-none');
      const looksLikeExpr = /^[0-9+\-*/%^().\s]+$/.test(finalSuggestion);
      applyBtn.classList.toggle('d-none', !looksLikeExpr);
      if (looksLikeExpr) AppState.lastValidationSuggestion = finalSuggestion;
    } else {
      sugWrap.classList.add('d-none');
    }

    // Render 5-stage breakdown list
    checksList.textContent = '';
    const stages = [
      { label: '1. Non-Empty Input', data: v.checks.nonEmpty },
      { label: '2. Lexical Tokenization', data: v.checks.lexical },
      { label: '3. Stack Bracket Matching', data: v.checks.brackets },
      { label: '4. Token-State / Arity Grammar', data: v.checks.syntax },
      { label: '5. Evaluation Safety (Div/Mod by Zero)', data: runtimeCheck }
    ];

    stages.forEach((st) => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent d-flex justify-content-between align-items-start gap-2 px-0';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'small fw-semibold';
      title.textContent = st.label;
      const detail = document.createElement('div');
      detail.className = 'xsmall text-muted';
      detail.textContent = st.data.detail || 'Pending';
      left.append(title, detail);

      const badge = document.createElement('span');
      badge.className = `badge ${st.data.passed ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`;
      badge.textContent = st.data.passed ? 'PASS' : 'FAIL';

      li.append(left, badge);
      checksList.appendChild(li);
    });
  }

  function initValidation() {
    const notationSel = document.getElementById('val-notation-select');
    const exprInput = document.getElementById('val-expr-input');
    if (!notationSel) return;

    populateValidationExamples(notationSel.value);

    notationSel.addEventListener('change', () => {
      populateValidationExamples(notationSel.value);
    });

    document.getElementById('val-example-select').addEventListener('change', (e) => {
      if (e.target.value) {
        exprInput.value = e.target.value;
        runValidationCheck();
        e.target.value = '';
      }
    });

    document.getElementById('val-validate-btn').addEventListener('click', runValidationCheck);
    exprInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runValidationCheck();
      }
    });

    document.getElementById('val-clear-btn').addEventListener('click', () => {
      exprInput.value = '';
      document.getElementById('val-status-badge').textContent = 'READY';
      document.getElementById('val-status-badge').className = 'badge fs-6 bg-secondary';
      document.getElementById('val-message').textContent = 'Enter an expression and click Validate.';
      document.getElementById('val-position-wrap').classList.add('d-none');
      document.getElementById('val-suggestion-wrap').classList.add('d-none');
      document.getElementById('val-checks-list').textContent = '';
    });

    document.getElementById('val-apply-suggestion-btn').addEventListener('click', () => {
      if (AppState.lastValidationSuggestion) {
        exprInput.value = AppState.lastValidationSuggestion;
        runValidationCheck();
        showToast('Applied suggested correction.', 'info');
      }
    });
  }

  /* -------------------------------------------------------------------------
   * Module 8: Calculation History (localStorage + Reuse/Copy/Delete/Export)
   * ----------------------------------------------------------------------- */
  function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    const countBadge = document.getElementById('history-count-badge');
    const searchInput = document.getElementById('history-search-input');
    if (!tbody) return;

    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const all = Storage.getHistory();
    const filtered = query
      ? all.filter((r) =>
          r.expression.toLowerCase().includes(query) ||
          String(r.result).toLowerCase().includes(query) ||
          r.postfix.toLowerCase().includes(query)
        )
      : all;

    if (countBadge) countBadge.textContent = `${all.length} record${all.length === 1 ? '' : 's'}`;

    tbody.textContent = '';
    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'text-center text-muted py-4';
      td.textContent = all.length === 0
        ? 'No calculations saved yet. Valid results from Expression Calculator appear here automatically.'
        : 'No matching history records found.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((rec) => {
      const tr = document.createElement('tr');

      const tdExpr = document.createElement('td');
      tdExpr.className = 'font-monospace fw-medium';
      tdExpr.textContent = rec.expression;

      const tdRes = document.createElement('td');
      tdRes.className = 'font-monospace fw-bold text-primary';
      tdRes.textContent = String(rec.result);

      const tdPost = document.createElement('td');
      tdPost.className = 'font-monospace small';
      tdPost.textContent = rec.postfix;

      const tdPre = document.createElement('td');
      tdPre.className = 'font-monospace small';
      tdPre.textContent = rec.prefix;

      const tdTime = document.createElement('td');
      tdTime.className = 'small text-muted text-nowrap';
      tdTime.textContent = new Date(rec.timestamp).toLocaleString();

      const tdActions = document.createElement('td');
      tdActions.className = 'text-nowrap';

      const reuseBtn = document.createElement('button');
      reuseBtn.type = 'button';
      reuseBtn.className = 'btn btn-sm btn-outline-primary me-1';
      reuseBtn.title = 'Reuse in Calculator';
      reuseBtn.innerHTML = '<i class="bi bi-calculator"></i>';
      reuseBtn.addEventListener('click', () => {
        commitExpressionState(rec.expression, 'history-reuse');
        navigateTo('calculator');
        handleCalculate();
        showToast('Loaded expression from History.', 'info');
      });

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-sm btn-outline-secondary me-1';
      copyBtn.title = 'Copy Expression';
      copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
      copyBtn.addEventListener('click', () => copyToClipboard(rec.expression, 'Expression'));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-sm btn-outline-danger';
      delBtn.title = 'Delete Record';
      delBtn.innerHTML = '<i class="bi bi-trash"></i>';
      delBtn.addEventListener('click', () => {
        Storage.deleteHistoryRecord(rec.id);
        renderHistory();
        renderDashboard();
        showToast('History record deleted.', 'secondary');
      });

      tdActions.append(reuseBtn, copyBtn, delBtn);
      tr.append(tdExpr, tdRes, tdPost, tdPre, tdTime, tdActions);
      tbody.appendChild(tr);
    });
  }

  function initHistory() {
    const searchInput = document.getElementById('history-search-input');
    if (searchInput) searchInput.addEventListener('input', renderHistory);

    const exportCsvBtn = document.getElementById('history-export-csv-btn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        const records = Storage.getHistory();
        if (records.length === 0) {
          showToast('No calculation history to export.', 'warning');
          return;
        }
        const csv = Storage.exportHistoryAsCSV(records);
        downloadFile('stacklab-history.csv', csv, 'text/csv;charset=utf-8');
        showToast('Exported calculation history as CSV.', 'success');
      });
    }

    const exportTxtBtn = document.getElementById('history-export-txt-btn');
    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => {
        const records = Storage.getHistory();
        if (records.length === 0) {
          showToast('No calculation history to export.', 'warning');
          return;
        }
        const txt = Storage.exportHistoryAsText(records);
        downloadFile('stacklab-history.txt', txt, 'text/plain;charset=utf-8');
        showToast('Exported calculation history as TXT.', 'success');
      });
    }

    const clearBtn = document.getElementById('history-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (Storage.getHistory().length === 0) return;
        Storage.clearHistory();
        renderHistory();
        renderDashboard();
        showToast('All calculation history cleared.', 'info');
      });
    }

    renderHistory();
  }

  /* -------------------------------------------------------------------------
   * About Project (Editable Academic Placeholders — No Invented Details)
   * ----------------------------------------------------------------------- */
  function initAboutProject() {
    const fields = {
      studentName: document.getElementById('about-student-name'),
      rollNumber: document.getElementById('about-roll-number'),
      collegeName: document.getElementById('about-college-name'),
      facultyName: document.getElementById('about-faculty-name'),
      academicYear: document.getElementById('about-academic-year')
    };
    const saveBtn = document.getElementById('about-save-meta-btn');
    if (!saveBtn) return;

    const saved = Storage.getAboutMeta();
    Object.keys(fields).forEach((k) => {
      if (fields[k]) fields[k].value = saved[k] || '';
    });

    saveBtn.addEventListener('click', () => {
      Storage.saveAboutMeta({
        studentName: fields.studentName.value.trim(),
        rollNumber: fields.rollNumber.value.trim(),
        collegeName: fields.collegeName.value.trim(),
        facultyName: fields.facultyName.value.trim(),
        academicYear: fields.academicYear.value.trim()
      });
      showToast('Academic details saved locally.', 'success');
    });
  }

  /* -------------------------------------------------------------------------
   * Bootstrap All Modules on DOM Ready
   * ----------------------------------------------------------------------- */
  function bootstrapApp() {
    initTheme();
    initNavigation();
    initCalculator();
    initConverter();
    initValidation();
    initAnalysis();
    initHistory();
    initUndoRedoModule();
    initAboutProject();

    AppState.playground = new StackPlaygroundController({
      onOperation: (summary, opsCount) => {
        Storage.incrementMetrics({ stackOperations: opsCount });
        Storage.logActivity('Playground', summary);
        renderDashboard();
      }
    });
    AppState.playground.init();

    AppState.visualizer = new StackVisualizerController({
      onTraceLoaded: (report) => {
        const ops = countStackOps(report.stats);
        Storage.incrementMetrics({ stackOperations: ops });
        Storage.logActivity('Visualizer', `${report.algorithm}`, report.expression);
        AppState.analyzer.recordRun(report);
        renderDashboard();
        renderAnalysis();
      }
    });
    AppState.visualizer.init();

    renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', bootstrapApp);

  global.StackLab.App = {
    navigateTo,
    getState: () => AppState
  };
})(typeof window !== 'undefined' ? window : globalThis);
