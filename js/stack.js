/**
 * StackLab — Custom Stack Data Structure (LIFO)
 * Implements the Stack Abstract Data Type (ADT) manually with encapsulated
 * internal storage, configurable capacity, Overflow/Underflow detection,
 * and real operation telemetry for Algorithm Analysis.
 */
(function (global) {
  'use strict';

  class StackError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'StackError';
      this.code = code; // 'OVERFLOW' | 'UNDERFLOW' | 'INVALID_CAPACITY'
    }
  }

  class Stack {
    // Private fields guarantee external algorithms cannot directly mutate the internal array.
    #items = [];
    #capacity = Infinity;
    #stats = {
      pushes: 0,
      pops: 0,
      peeks: 0,
      maxSize: 0
    };

    /**
     * Create a new independent Stack instance.
     * @param {number} [capacity=Infinity] Maximum number of elements allowed.
     */
    constructor(capacity = Infinity) {
      this.setCapacity(capacity);
    }

    /**
     * Push a value onto the TOP of the stack (O(1) time).
     * Throws StackError('OVERFLOW') if capacity is exceeded.
     * @param {*} value
     * @returns {number} New stack size
     */
    push(value) {
      if (this.#items.length >= this.#capacity) {
        throw new StackError(
          'OVERFLOW',
          `Stack Overflow: Cannot push "${value}" because stack reached capacity (${this.#capacity}).`
        );
      }
      this.#items.push(value);
      this.#stats.pushes += 1;
      if (this.#items.length > this.#stats.maxSize) {
        this.#stats.maxSize = this.#items.length;
      }
      return this.#items.length;
    }

    /**
     * Pop and return the TOP element of the stack (O(1) time).
     * Throws StackError('UNDERFLOW') if stack is empty.
     * @returns {*} Top element
     */
    pop() {
      if (this.isEmpty()) {
        throw new StackError(
          'UNDERFLOW',
          'Stack Underflow: Cannot pop from an empty stack.'
        );
      }
      this.#stats.pops += 1;
      return this.#items.pop();
    }

    /**
     * Safely inspect the TOP element without removing it (O(1) time).
     * Returns null when empty instead of crashing.
     * @returns {*} Top element or null
     */
    peek() {
      this.#stats.peeks += 1;
      if (this.isEmpty()) {
        return null;
      }
      return this.#items[this.#items.length - 1];
    }

    /**
     * Check whether the stack contains zero elements (O(1) time).
     * @returns {boolean}
     */
    isEmpty() {
      return this.#items.length === 0;
    }

    /**
     * Check whether the stack has reached its configured capacity (O(1) time).
     * @returns {boolean}
     */
    isFull() {
      return this.#items.length >= this.#capacity;
    }

    /**
     * Return current number of elements in the stack (O(1) time).
     * @returns {number}
     */
    size() {
      return this.#items.length;
    }

    /**
     * Remove all elements from the stack.
     */
    clear() {
      this.#items = [];
    }

    /**
     * Return a shallow copy of stack items ordered from BOTTOM (index 0) to TOP (last index).
     * Returning a copy prevents external mutation of internal stack state.
     * @returns {Array<*>}
     */
    getItems() {
      return [...this.#items];
    }

    /**
     * Return configured capacity.
     * @returns {number}
     */
    getCapacity() {
      return this.#capacity;
    }

    /**
     * Update stack capacity safely.
     * @param {number} capacity
     */
    setCapacity(capacity) {
      if (capacity === Infinity) {
        this.#capacity = Infinity;
        return;
      }
      const parsed = Number(capacity);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new StackError(
          'INVALID_CAPACITY',
          'Stack capacity must be a positive integer or Infinity.'
        );
      }
      if (parsed < this.#items.length) {
        throw new StackError(
          'INVALID_CAPACITY',
          `Cannot reduce capacity to ${parsed} while stack holds ${this.#items.length} elements.`
        );
      }
      this.#capacity = parsed;
    }

    /**
     * Return real recorded Stack operation telemetry.
     * @returns {{pushes: number, pops: number, peeks: number, maxSize: number, currentSize: number}}
     */
    getStats() {
      return {
        pushes: this.#stats.pushes,
        pops: this.#stats.pops,
        peeks: this.#stats.peeks,
        maxSize: this.#stats.maxSize,
        currentSize: this.#items.length
      };
    }

    /**
     * Reset operation telemetry counters.
     */
    resetStats() {
      this.#stats = {
        pushes: 0,
        pops: 0,
        peeks: 0,
        maxSize: this.#items.length
      };
    }
  }

  const exportsObj = { Stack, StackError };
  global.StackLab = global.StackLab || {};
  global.StackLab.Stack = Stack;
  global.StackLab.StackError = StackError;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }
})(typeof window !== 'undefined' ? window : globalThis);
