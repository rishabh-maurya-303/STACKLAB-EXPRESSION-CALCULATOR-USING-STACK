/**
 * StackLab — Interactive Stack Playground Module
 * Demonstrates LIFO operations (Push, Pop, Peek, Clear) with configurable max capacity,
 * genuine Stack Overflow & Stack Underflow detection, animations, and operation history.
 */
(function (global) {
  'use strict';

  class StackPlaygroundController {
    constructor(options = {}) {
      const Stack = global.StackLab.Stack;
      this.onOperationCallback = options.onOperation || null;
      this.stack = new Stack(5);
      this.history = [];
      this.lastAction = null; // { type: 'push'|'pop'|'peek'|'clear'|'overflow'|'underflow', value }
      this.sampleCounter = 1;
      this.dom = {};
    }

    init() {
      this.dom = {
        valueInput: document.getElementById('pg-value-input'),
        capacitySelect: document.getElementById('pg-capacity-select'),
        pushBtn: document.getElementById('pg-push-btn'),
        popBtn: document.getElementById('pg-pop-btn'),
        peekBtn: document.getElementById('pg-peek-btn'),
        clearBtn: document.getElementById('pg-clear-btn'),
        sampleBtn: document.getElementById('pg-sample-btn'),
        alertBox: document.getElementById('pg-alert-box'),
        sizeVal: document.getElementById('pg-size-val'),
        capacityVal: document.getElementById('pg-capacity-val'),
        topVal: document.getElementById('pg-top-val'),
        statusBadge: document.getElementById('pg-status-badge'),
        capacityBar: document.getElementById('pg-capacity-bar'),
        stackContainer: document.getElementById('pg-stack-visual'),
        historyBody: document.getElementById('pg-history-body')
      };

      if (!this.dom.pushBtn) return;

      this.dom.pushBtn.addEventListener('click', () => this.handlePush());
      this.dom.popBtn.addEventListener('click', () => this.handlePop());
      this.dom.peekBtn.addEventListener('click', () => this.handlePeek());
      this.dom.clearBtn.addEventListener('click', () => this.handleClear());
      this.dom.sampleBtn.addEventListener('click', () => this.handlePushSample());

      this.dom.valueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handlePush();
        }
      });

      this.dom.capacitySelect.addEventListener('change', () => this.handleCapacityChange());
      this.render();
    }

    showAlert(type, message) {
      const box = this.dom.alertBox;
      if (!box) return;
      box.className = `alert py-2 px-3 mb-3 small d-flex align-items-center gap-2 alert-${type}`;
      box.textContent = '';
      const icon = document.createElement('i');
      icon.className = type === 'danger'
        ? 'bi bi-exclamation-octagon-fill'
        : type === 'warning'
          ? 'bi bi-exclamation-triangle-fill'
          : type === 'success'
            ? 'bi bi-check-circle-fill'
            : 'bi bi-info-circle-fill';
      const span = document.createElement('span');
      span.textContent = message;
      box.append(icon, span);
      box.classList.remove('d-none');
    }

    log(op, value, outcome, statusClass) {
      this.history.unshift({
        time: new Date().toLocaleTimeString(),
        op,
        value: value === null || value === undefined ? '—' : String(value),
        outcome,
        sizeAfter: this.stack.size(),
        statusClass
      });
      if (this.history.length > 40) this.history.length = 40;
    }

    notifyApp(opSummary, opsCount = 1) {
      if (typeof this.onOperationCallback === 'function') {
        this.onOperationCallback(opSummary, opsCount);
      }
    }

    handlePush(customValue) {
      const raw = customValue !== undefined ? String(customValue) : this.dom.valueInput.value.trim();
      if (raw === '') {
        this.showAlert('warning', 'Enter a value before pushing onto the Stack.');
        this.dom.valueInput.focus();
        return;
      }

      try {
        this.stack.push(raw);
        this.lastAction = { type: 'push', value: raw };
        this.dom.valueInput.value = '';
        this.dom.valueInput.focus();
        this.showAlert('success', `PUSH("${raw}") succeeded. New TOP is "${raw}" (size: ${this.stack.size()}).`);
        this.log('PUSH', raw, 'Inserted at TOP', 'text-success');
        this.notifyApp(`Playground PUSH "${raw}"`, 1);
      } catch (err) {
        this.lastAction = { type: 'overflow', value: raw };
        this.showAlert('danger', err.message || 'Stack Overflow detected.');
        this.log('PUSH', raw, 'OVERFLOW (Rejected)', 'text-danger');
      }
      this.render();
    }

    handlePushSample() {
      const samples = ['10', '25', '42', 'A', 'B', '99', '3.14', 'X', '77', '128'];
      const val = samples[(this.sampleCounter - 1) % samples.length];
      this.sampleCounter += 1;
      this.handlePush(val);
    }

    handlePop() {
      try {
        const removed = this.stack.pop();
        this.lastAction = { type: 'pop', value: removed };
        this.showAlert('info', `POP() removed "${removed}" from TOP (size: ${this.stack.size()}).`);
        this.log('POP', removed, 'Removed from TOP', 'text-info');
        this.notifyApp(`Playground POP "${removed}"`, 1);
      } catch (err) {
        this.lastAction = { type: 'underflow', value: null };
        this.showAlert('danger', err.message || 'Stack Underflow detected.');
        this.log('POP', '—', 'UNDERFLOW (Empty Stack)', 'text-danger');
      }
      this.render();
    }

    handlePeek() {
      if (this.stack.isEmpty()) {
        this.stack.peek(); // Safely returns null & records peek telemetry
        this.lastAction = { type: 'underflow', value: null };
        this.showAlert('warning', 'PEEK() returned null — Stack is currently empty.');
        this.log('PEEK', 'null', 'Empty Stack', 'text-warning');
      } else {
        const top = this.stack.peek();
        this.lastAction = { type: 'peek', value: top };
        this.showAlert('primary', `PEEK() inspected TOP element: "${top}" (Stack unchanged).`);
        this.log('PEEK', top, 'Inspected TOP', 'text-primary');
      }
      this.notifyApp('Playground PEEK', 1);
      this.render();
    }

    handleClear() {
      const prevSize = this.stack.size();
      this.stack.clear();
      this.lastAction = { type: 'clear', value: null };
      this.showAlert('secondary', `CLEAR() emptied the Stack (${prevSize} element(s) removed).`);
      this.log('CLEAR', '—', `Removed ${prevSize} item(s)`, 'text-secondary');
      this.render();
    }

    handleCapacityChange() {
      const raw = this.dom.capacitySelect.value;
      const newCap = raw === 'Infinity' ? Infinity : Number(raw);
      try {
        this.stack.setCapacity(newCap);
        this.showAlert('info', `Stack maximum capacity updated to ${newCap === Infinity ? 'Unlimited' : newCap}.`);
        this.log('CAPACITY', newCap === Infinity ? '∞' : newCap, 'Updated limit', 'text-info');
      } catch (err) {
        this.showAlert('danger', err.message);
        // Revert select to actual capacity
        const curCap = this.stack.getCapacity();
        this.dom.capacitySelect.value = curCap === Infinity ? 'Infinity' : String(curCap);
      }
      this.render();
    }

    render() {
      const items = this.stack.getItems();
      const size = this.stack.size();
      const cap = this.stack.getCapacity();
      const top = size > 0 ? items[items.length - 1] : 'Empty';

      this.dom.sizeVal.textContent = String(size);
      this.dom.capacityVal.textContent = cap === Infinity ? '∞' : String(cap);
      this.dom.topVal.textContent = String(top);

      if (size === 0) {
        this.dom.statusBadge.textContent = 'EMPTY';
        this.dom.statusBadge.className = 'badge bg-secondary-subtle text-secondary-emphasis';
      } else if (this.stack.isFull()) {
        this.dom.statusBadge.textContent = 'FULL (MAX)';
        this.dom.statusBadge.className = 'badge bg-danger-subtle text-danger-emphasis';
      } else {
        this.dom.statusBadge.textContent = 'ACTIVE';
        this.dom.statusBadge.className = 'badge bg-success-subtle text-success-emphasis';
      }

      if (this.dom.capacityBar) {
        const pct = cap === Infinity ? Math.min(100, size * 10) : Math.round((size / cap) * 100);
        this.dom.capacityBar.style.width = `${pct}%`;
        this.dom.capacityBar.className = `progress-bar ${pct >= 100 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-primary'}`;
      }

      // Render vertical stack tower (TOP rendered visually at the top)
      const container = this.dom.stackContainer;
      container.textContent = '';

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'stack-empty-placeholder';
        empty.textContent = 'Stack is empty — push an item to begin';
        container.appendChild(empty);
      } else {
        const reversed = [...items].reverse();
        reversed.forEach((val, revIdx) => {
          const isTop = revIdx === 0;
          const isBottom = revIdx === reversed.length - 1;
          const origIdx = items.length - 1 - revIdx;

          const block = document.createElement('div');
          block.className = 'stack-node';
          if (isTop) block.classList.add('is-top');
          if (isTop && this.lastAction?.type === 'push') block.classList.add('anim-push');
          if (isTop && this.lastAction?.type === 'peek') block.classList.add('anim-peek');

          const idxSpan = document.createElement('span');
          idxSpan.className = 'stack-node-index';
          idxSpan.textContent = `[${origIdx}]`;

          const valSpan = document.createElement('span');
          valSpan.className = 'stack-node-value';
          valSpan.textContent = String(val);

          const tagWrap = document.createElement('span');
          tagWrap.className = 'stack-node-tags';
          if (isTop) {
            const topTag = document.createElement('span');
            topTag.className = 'badge bg-primary ms-1';
            topTag.textContent = 'TOP';
            tagWrap.appendChild(topTag);
          }
          if (isBottom) {
            const botTag = document.createElement('span');
            botTag.className = 'badge bg-secondary ms-1';
            botTag.textContent = 'BOTTOM';
            tagWrap.appendChild(botTag);
          }

          block.append(idxSpan, valSpan, tagWrap);
          container.appendChild(block);
        });
      }

      // Render operation history table safely using textContent
      const tbody = this.dom.historyBody;
      tbody.textContent = '';
      if (this.history.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'text-center text-muted py-3';
        td.textContent = 'No stack operations recorded yet.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        this.history.forEach((entry) => {
          const tr = document.createElement('tr');
          const cells = [entry.time, entry.op, entry.value, entry.outcome, String(entry.sizeAfter)];
          cells.forEach((txt, idx) => {
            const td = document.createElement('td');
            td.textContent = txt;
            if (idx === 1) td.className = 'fw-semibold font-monospace';
            if (idx === 2) td.className = 'font-monospace';
            if (idx === 3) td.className = entry.statusClass;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
    }
  }

  global.StackLab = global.StackLab || {};
  global.StackLab.StackPlaygroundController = StackPlaygroundController;
})(typeof window !== 'undefined' ? window : globalThis);
