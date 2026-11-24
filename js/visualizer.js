/**
 * StackLab — Interactive Stack Visualizer Controller
 * Replays REAL operation traces emitted by StackLab's conversion, evaluation,
 * and bracket-matching algorithms. Never fakes or hardcodes step animations.
 * Supports: Previous Step, Next Step, Play, Pause, Restart, Speed Selector,
 * and direct click-to-jump on any Operation Log row.
 */
(function (global) {
  'use strict';

  const MODE_META = Object.freeze({
    'infix-to-postfix': {
      label: 'Infix to Postfix Conversion',
      placeholder: 'e.g., (5+3)*2',
      primaryStackTitle: 'Operator Stack',
      secondaryStackTitle: null,
      examples: ['(5+3)*2', '5+3*2', '2^3^2', '-2^2', '(-2)^2', '10+(20-5)*3/5']
    },
    'infix-to-prefix': {
      label: 'Infix to Prefix Conversion (Two-Stack)',
      placeholder: 'e.g., (5+3)*2',
      primaryStackTitle: 'Operator Stack',
      secondaryStackTitle: 'Expression Stack (Prefix)',
      examples: ['(5+3)*2', '2^3^2', '-2^2', '(-2)^2', '5+3*2']
    },
    'postfix-eval': {
      label: 'Postfix Evaluation (Left-to-Right)',
      placeholder: 'e.g., 5 3 + 2 *',
      primaryStackTitle: 'Operand Stack',
      secondaryStackTitle: null,
      examples: ['5 3 + 2 *', '5 3 2 * +', '2 3 2 ^ ^', '2 2 ^ u-', '20 5 / 2 +']
    },
    'prefix-eval': {
      label: 'Prefix Evaluation (Right-to-Left)',
      placeholder: 'e.g., * + 5 3 2',
      primaryStackTitle: 'Operand Stack',
      secondaryStackTitle: null,
      examples: ['* + 5 3 2', '+ 5 * 3 2', '^ 2 ^ 3 2', 'u- ^ 2 2', '+ / 20 5 2']
    },
    'bracket-match': {
      label: 'Bracket Matching (Parentheses Stack)',
      placeholder: 'e.g., ((5+3)*(10-2))',
      primaryStackTitle: 'Bracket Stack',
      secondaryStackTitle: null,
      examples: ['((5+3)*(10-2))', '(5+3)*2', '(5+3', '5+3)', '(((1+2)+3)+4)']
    }
  });

  class StackVisualizerController {
    constructor(options = {}) {
      this.onTraceLoaded = options.onTraceLoaded || null;
      this.mode = 'infix-to-postfix';
      this.trace = [];
      this.currentIndex = 0;
      this.isPlaying = false;
      this.timerId = null;
      this.speedMs = 900;
      this.dom = {};
    }

    init() {
      this.dom = {
        modeSelect: document.getElementById('viz-mode-select'),
        exprInput: document.getElementById('viz-expr-input'),
        exampleSelect: document.getElementById('viz-example-select'),
        loadBtn: document.getElementById('viz-load-btn'),
        alertBox: document.getElementById('viz-alert-box'),
        prevBtn: document.getElementById('viz-prev-btn'),
        playBtn: document.getElementById('viz-play-btn'),
        pauseBtn: document.getElementById('viz-pause-btn'),
        nextBtn: document.getElementById('viz-next-btn'),
        restartBtn: document.getElementById('viz-restart-btn'),
        speedSelect: document.getElementById('viz-speed-select'),
        stepCounter: document.getElementById('viz-step-counter'),
        progressBar: document.getElementById('viz-progress-bar'),
        primaryTitle: document.getElementById('viz-primary-stack-title'),
        primaryStack: document.getElementById('viz-primary-stack'),
        secondaryWrap: document.getElementById('viz-secondary-stack-wrap'),
        secondaryTitle: document.getElementById('viz-secondary-stack-title'),
        secondaryStack: document.getElementById('viz-secondary-stack'),
        curToken: document.getElementById('viz-cur-token'),
        curOp: document.getElementById('viz-cur-op'),
        curOutput: document.getElementById('viz-cur-output'),
        curSize: document.getElementById('viz-cur-size'),
        maxSize: document.getElementById('viz-max-size'),
        descBox: document.getElementById('viz-desc-box'),
        logBody: document.getElementById('viz-log-body')
      };

      if (!this.dom.loadBtn) return;

      this.dom.modeSelect.addEventListener('change', () => {
        this.pause();
        this.mode = this.dom.modeSelect.value;
        this.populateExamples();
        this.dom.exprInput.value = MODE_META[this.mode].examples[0];
        this.loadAndTrace();
      });

      this.dom.exampleSelect.addEventListener('change', () => {
        if (this.dom.exampleSelect.value) {
          this.dom.exprInput.value = this.dom.exampleSelect.value;
          this.loadAndTrace();
        }
      });

      this.dom.loadBtn.addEventListener('click', () => this.loadAndTrace());
      this.dom.exprInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.loadAndTrace();
        }
      });

      this.dom.prevBtn.addEventListener('click', () => { this.pause(); this.prevStep(); });
      this.dom.nextBtn.addEventListener('click', () => { this.pause(); this.nextStep(); });
      this.dom.playBtn.addEventListener('click', () => this.play());
      this.dom.pauseBtn.addEventListener('click', () => this.pause());
      this.dom.restartBtn.addEventListener('click', () => this.restart());
      this.dom.speedSelect.addEventListener('change', () => {
        this.speedMs = Number(this.dom.speedSelect.value) || 900;
        if (this.isPlaying) {
          this.pause();
          this.play();
        }
      });

      this.populateExamples();
      this.dom.exprInput.value = '(5+3)*2';
      this.loadAndTrace(false); // Silent initial trace so visualizer starts populated with real trace of (5+3)*2
    }

    populateExamples() {
      const meta = MODE_META[this.mode] || MODE_META['infix-to-postfix'];
      this.dom.exprInput.placeholder = meta.placeholder;
      this.dom.exampleSelect.textContent = '';

      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = 'Select example...';
      this.dom.exampleSelect.appendChild(defOpt);

      meta.examples.forEach((ex) => {
        const opt = document.createElement('option');
        opt.value = ex;
        opt.textContent = ex;
        this.dom.exampleSelect.appendChild(opt);
      });
    }

    /**
     * External helper so Calculator or Converter can send an expression straight into the Visualizer.
     */
    loadExternal(mode, expression) {
      if (!MODE_META[mode]) return;
      this.pause();
      this.mode = mode;
      this.dom.modeSelect.value = mode;
      this.populateExamples();
      this.dom.exprInput.value = expression;
      this.loadAndTrace(true);
    }

    showAlert(type, message) {
      if (!message) {
        this.dom.alertBox.classList.add('d-none');
        return;
      }
      this.dom.alertBox.className = `alert alert-${type} py-2 px-3 small mb-3`;
      this.dom.alertBox.textContent = message;
      this.dom.alertBox.classList.remove('d-none');
    }

    loadAndTrace(recordAnalysis = true) {
      this.pause();
      const expr = this.dom.exprInput.value.trim();
      if (!expr) {
        this.showAlert('warning', 'Please enter an expression to visualize.');
        return;
      }

      const { Converter, Evaluator, Validator } = global.StackLab;
      let result;

      if (this.mode === 'infix-to-postfix') {
        result = Converter.infixToPostfix(expr, { recordTrace: true });
      } else if (this.mode === 'infix-to-prefix') {
        result = Converter.infixToPrefix(expr, { recordTrace: true });
      } else if (this.mode === 'postfix-eval') {
        result = Evaluator.evaluatePostfix(expr, { recordTrace: true });
      } else if (this.mode === 'prefix-eval') {
        result = Evaluator.evaluatePrefix(expr, { recordTrace: true });
      } else if (this.mode === 'bracket-match') {
        const br = Validator.matchBrackets(expr, { recordTrace: true });
        result = {
          success: true, // Always allow visualizing mismatched brackets step-by-step!
          algorithm: 'Bracket Matching',
          trace: br.trace,
          stats: br.stats,
          tokensProcessed: br.tokensProcessed,
          bracketValid: br.valid,
          bracketMessage: br.message
        };
      }

      if (!result || (!result.success && (!result.trace || result.trace.length === 0))) {
        this.trace = [];
        this.currentIndex = 0;
        this.showAlert('danger', result?.error || 'Unable to generate trace for this expression.');
        this.renderStep();
        return;
      }

      if (this.mode === 'bracket-match' && result.bracketValid === false) {
        this.showAlert('warning', `Trace loaded (Mismatch detected): ${result.bracketMessage}`);
      } else if (!result.success && result.error) {
        this.showAlert('danger', `Runtime error during trace: ${result.error}`);
      } else {
        this.showAlert(null, '');
      }

      this.trace = result.trace || [];
      this.currentIndex = 0;

      if (recordAnalysis && typeof this.onTraceLoaded === 'function') {
        this.onTraceLoaded({
          algorithm: result.algorithm || MODE_META[this.mode].label,
          expression: expr,
          tokensProcessed: result.tokensProcessed || 0,
          stats: result.stats
        });
      }

      this.renderLogTable();
      this.renderStep();
    }

    prevStep() {
      if (this.currentIndex > 0) {
        this.currentIndex -= 1;
        this.renderStep();
      }
    }

    nextStep() {
      if (this.currentIndex < this.trace.length - 1) {
        this.currentIndex += 1;
        this.renderStep();
      } else {
        this.pause();
      }
    }

    play() {
      if (this.trace.length <= 1) return;
      if (this.currentIndex >= this.trace.length - 1) {
        this.currentIndex = 0;
        this.renderStep();
      }
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.updateControlStates();

      this.timerId = global.setInterval(() => {
        if (this.currentIndex < this.trace.length - 1) {
          this.currentIndex += 1;
          this.renderStep();
        } else {
          this.pause();
        }
      }, this.speedMs);
    }

    pause() {
      if (this.timerId !== null) {
        global.clearInterval(this.timerId);
        this.timerId = null;
      }
      this.isPlaying = false;
      this.updateControlStates();
    }

    restart() {
      this.pause();
      this.currentIndex = 0;
      this.renderStep();
    }

    jumpToStep(index) {
      if (index >= 0 && index < this.trace.length) {
        this.pause();
        this.currentIndex = index;
        this.renderStep();
      }
    }

    updateControlStates() {
      if (!this.dom.prevBtn) return;
      const hasTrace = this.trace.length > 0;
      this.dom.prevBtn.disabled = !hasTrace || this.currentIndex <= 0;
      this.dom.nextBtn.disabled = !hasTrace || this.currentIndex >= this.trace.length - 1;
      this.dom.playBtn.disabled = !hasTrace || this.isPlaying || this.trace.length <= 1;
      this.dom.pauseBtn.disabled = !this.isPlaying;
      this.dom.restartBtn.disabled = !hasTrace;
    }

    renderStackTower(container, items, animatePush) {
      container.textContent = '';
      if (!items || items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'stack-empty-placeholder';
        empty.textContent = 'Empty Stack';
        container.appendChild(empty);
        return;
      }

      const reversed = [...items].reverse();
      reversed.forEach((val, revIdx) => {
        const isTop = revIdx === 0;
        const isBottom = revIdx === reversed.length - 1;
        const origIdx = items.length - 1 - revIdx;

        const block = document.createElement('div');
        block.className = 'stack-node';
        if (isTop) block.classList.add('is-top');
        if (isTop && animatePush) block.classList.add('anim-push');

        const idxSpan = document.createElement('span');
        idxSpan.className = 'stack-node-index';
        idxSpan.textContent = `[${origIdx}]`;

        const valSpan = document.createElement('span');
        valSpan.className = 'stack-node-value';
        valSpan.textContent = String(val);

        const tags = document.createElement('span');
        tags.className = 'stack-node-tags';
        if (isTop) {
          const t = document.createElement('span');
          t.className = 'badge bg-primary ms-1';
          t.textContent = 'TOP';
          tags.appendChild(t);
        }
        if (isBottom) {
          const b = document.createElement('span');
          b.className = 'badge bg-secondary ms-1';
          b.textContent = 'BOTTOM';
          tags.appendChild(b);
        }

        block.append(idxSpan, valSpan, tags);
        container.appendChild(block);
      });
    }

    renderLogTable() {
      const tbody = this.dom.logBody;
      tbody.textContent = '';

      if (this.trace.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'text-center text-muted py-3';
        td.textContent = 'Load an expression to inspect recorded Stack operations.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      this.trace.forEach((stepObj, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.stepIndex = String(idx);
        tr.className = 'viz-log-row';
        tr.addEventListener('click', () => this.jumpToStep(idx));

        const stackStr = stepObj.stackState.length > 0 ? `[ ${stepObj.stackState.join(', ')} ]` : '[ empty ]';
        const cols = [
          String(stepObj.step),
          stepObj.token,
          stepObj.operation,
          stackStr,
          stepObj.output || '—'
        ];

        cols.forEach((txt, cIdx) => {
          const td = document.createElement('td');
          if (cIdx === 2) {
            const badge = document.createElement('span');
            badge.className = `badge ${this.getOpBadgeClass(stepObj.operation)}`;
            badge.textContent = txt;
            td.appendChild(badge);
          } else {
            td.textContent = txt;
            if (cIdx === 1 || cIdx === 3 || cIdx === 4) td.className = 'font-monospace';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    getOpBadgeClass(op) {
      switch (op) {
        case 'PUSH':
        case 'PUSH_EXPR': return 'bg-primary-subtle text-primary-emphasis';
        case 'POP': return 'bg-warning-subtle text-warning-emphasis';
        case 'EVAL':
        case 'COMBINE': return 'bg-info-subtle text-info-emphasis';
        case 'COMPLETE': return 'bg-success-subtle text-success-emphasis';
        case 'ERROR': return 'bg-danger-subtle text-danger-emphasis';
        default: return 'bg-secondary-subtle text-secondary-emphasis';
      }
    }

    renderStep() {
      const meta = MODE_META[this.mode] || MODE_META['infix-to-postfix'];
      this.dom.primaryTitle.textContent = meta.primaryStackTitle;

      if (meta.secondaryStackTitle) {
        this.dom.secondaryWrap.classList.remove('d-none');
        this.dom.secondaryTitle.textContent = meta.secondaryStackTitle;
      } else {
        this.dom.secondaryWrap.classList.add('d-none');
      }

      if (this.trace.length === 0) {
        this.dom.stepCounter.textContent = 'Step 0 / 0';
        this.dom.progressBar.style.width = '0%';
        this.dom.curToken.textContent = '—';
        this.dom.curOp.textContent = 'IDLE';
        this.dom.curOutput.textContent = '—';
        this.dom.curSize.textContent = '0';
        this.dom.maxSize.textContent = '0';
        this.dom.descBox.textContent = 'Enter a valid expression and click "Load & Trace".';
        this.renderStackTower(this.dom.primaryStack, [], false);
        this.updateControlStates();
        return;
      }

      const step = this.trace[this.currentIndex];
      const total = this.trace.length;
      const pct = Math.round(((this.currentIndex + 1) / total) * 100);

      this.dom.stepCounter.textContent = `Step ${step.step} / ${total}`;
      this.dom.progressBar.style.width = `${pct}%`;
      this.dom.curToken.textContent = step.token;
      this.dom.curOp.textContent = step.operation;
      this.dom.curOp.className = `badge fs-6 ${this.getOpBadgeClass(step.operation)}`;
      this.dom.curOutput.textContent = step.output || '—';
      this.dom.curSize.textContent = String(step.stackSize);
      this.dom.maxSize.textContent = String(step.maxStackSize);
      this.dom.descBox.textContent = step.description;

      this.renderStackTower(this.dom.primaryStack, step.stackState, step.operation === 'PUSH');
      if (meta.secondaryStackTitle) {
        this.renderStackTower(
          this.dom.secondaryStack,
          step.secondaryStackState || [],
          step.operation === 'PUSH_EXPR' || step.operation === 'COMBINE'
        );
      }

      // Highlight active row in log table and keep in view smoothly
      const rows = this.dom.logBody.querySelectorAll('tr.viz-log-row');
      rows.forEach((r, idx) => {
        if (idx === this.currentIndex) {
          r.classList.add('table-active', 'viz-row-active');
        } else {
          r.classList.remove('table-active', 'viz-row-active');
        }
      });

      this.updateControlStates();
    }
  }

  global.StackLab = global.StackLab || {};
  global.StackLab.StackVisualizerController = StackVisualizerController;
})(typeof window !== 'undefined' ? window : globalThis);
