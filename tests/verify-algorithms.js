/**
 * StackLab — Internal Algorithm Verification Suite (Node.js)
 * Run locally with:  node tests/verify-algorithms.js
 * Tests all core Stack ADT invariants, 10 valid expressions, 6 invalid expressions,
 * all 6 notation conversions with mathematical equivalence, Undo/Redo, and Storage recovery.
 */
'use strict';

const assert = require('assert');
const { Stack, StackError } = require('../js/stack');
const Precedence = require('../js/precedence');
const Tokenizer = require('../js/tokenizer');
const Validator = require('../js/validator');
const Converter = require('../js/converter');
const Evaluator = require('../js/evaluator');
const { UndoRedoManager } = require('../js/undoRedo');
const Storage = require('../js/storage');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name} -> ${err.message}`);
  }
}

console.log('\n=== 1. Custom Stack ADT (Overflow, Underflow, Empty, LIFO) ===');
test('LIFO Push / Peek / Pop / Size / Clear / Encapsulation', () => {
  const s = new Stack(3);
  assert.strictEqual(s.isEmpty(), true);
  assert.strictEqual(s.peek(), null);
  s.push(10);
  s.push(20);
  s.push(30);
  assert.strictEqual(s.size(), 3);
  assert.strictEqual(s.isFull(), true);
  assert.strictEqual(s.peek(), 30);

  // Verify getItems() returns a defensive copy
  const copy = s.getItems();
  copy.push(999);
  assert.strictEqual(s.size(), 3);

  assert.strictEqual(s.pop(), 30);
  assert.strictEqual(s.pop(), 20);
  s.clear();
  assert.strictEqual(s.isEmpty(), true);
});

test('Stack Overflow detection', () => {
  const s = new Stack(2);
  s.push('A');
  s.push('B');
  assert.throws(() => s.push('C'), (err) => err instanceof StackError && err.code === 'OVERFLOW');
});

test('Stack Underflow detection', () => {
  const s = new Stack(2);
  assert.throws(() => s.pop(), (err) => err instanceof StackError && err.code === 'UNDERFLOW');
});

console.log('\n=== 2. Valid Expression Evaluation (All 10 Mandatory Cases) ===');
const validCases = [
  ['5+3', 8],
  ['5+3*2', 11],
  ['(5+3)*2', 16],
  ['20/5+2', 6],
  ['2^3', 8],
  ['2^3^2', 512],
  ['-5+3', -2],
  ['3.5*2', 7],
  ['-2^2', -4],
  ['(-2)^2', 4]
];

validCases.forEach(([expr, expected]) => {
  test(`evaluateInfix("${expr}") === ${expected}`, () => {
    const res = Evaluator.evaluateInfix(expr);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(res.result, expected);
    assert.strictEqual(res.prefixVerifiedResult, expected);
  });
});

console.log('\n=== 3. Invalid Expression Detection (All 6 Mandatory Cases + Empty) ===');
const invalidCases = ['5+*3', '(5+3', '5+3)', '10/0', '5+', '*5+3', '', '   '];
invalidCases.forEach((expr) => {
  test(`Reject invalid expression "${expr}"`, () => {
    const res = Evaluator.evaluateInfix(expr);
    assert.strictEqual(res.success, false);
    assert.ok(typeof res.error === 'string' && res.error.length > 0);
  });
});

console.log('\n=== 4. All Six Notation Conversions & Mathematical Equivalence ===');
const convExpressions = ['(5+3)*2', '2^3^2', '-2^2', '(-2)^2', '20/5+2', '3.5*2'];
convExpressions.forEach((infix) => {
  test(`All 6 conversions preserve value for "${infix}"`, () => {
    const baseEval = Evaluator.evaluateInfix(infix);
    assert.strictEqual(baseEval.success, true);

    // 1. Infix -> Postfix
    const c1 = Converter.infixToPostfix(infix);
    assert.strictEqual(c1.success, true);
    assert.strictEqual(Evaluator.evaluatePostfix(c1.result).result, baseEval.result);

    // 2. Infix -> Prefix
    const c2 = Converter.infixToPrefix(infix);
    assert.strictEqual(c2.success, true);
    assert.strictEqual(Evaluator.evaluatePrefix(c2.result).result, baseEval.result);

    // 3. Postfix -> Infix
    const c3 = Converter.postfixToInfix(c1.result);
    assert.strictEqual(c3.success, true);
    assert.strictEqual(Evaluator.evaluateInfix(c3.result).result, baseEval.result);

    // 4. Prefix -> Infix
    const c4 = Converter.prefixToInfix(c2.result);
    assert.strictEqual(c4.success, true);
    assert.strictEqual(Evaluator.evaluateInfix(c4.result).result, baseEval.result);

    // 5. Postfix -> Prefix
    const c5 = Converter.postfixToPrefix(c1.result);
    assert.strictEqual(c5.success, true);
    assert.strictEqual(Evaluator.evaluatePrefix(c5.result).result, baseEval.result);

    // 6. Prefix -> Postfix
    const c6 = Converter.prefixToPostfix(c2.result);
    assert.strictEqual(c6.success, true);
    assert.strictEqual(Evaluator.evaluatePostfix(c6.result).result, baseEval.result);
  });
});

console.log('\n=== 5. Dual-Stack Undo / Redo Edge Cases ===');
test('Undo/Redo empty guards & redo invalidation on new edit', () => {
  const ur = new UndoRedoManager('');
  assert.strictEqual(ur.undo().success, false);
  assert.strictEqual(ur.redo().success, false);

  ur.setState('5+3');
  ur.setState('(5+3)*2');
  assert.strictEqual(ur.undo().currentState, '5+3');
  assert.strictEqual(ur.canRedo(), true);
  assert.strictEqual(ur.redo().currentState, '(5+3)*2');

  assert.strictEqual(ur.undo().currentState, '5+3');
  ur.setState('2^3^2'); // New edit after undo MUST clear Redo Stack
  assert.strictEqual(ur.canRedo(), false);
  assert.strictEqual(ur.redo().success, false);
});

console.log('\n=== 6. Corrupted localStorage Recovery ===');
test('Storage safely recovers from invalid JSON', () => {
  const mockStore = { [Storage.KEYS.HISTORY]: '{corrupted_json!!!' };
  global.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mockStore, k) ? mockStore[k] : null),
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };
  Storage.resetRecoveryFlag();
  const hist = Storage.getHistory();
  assert.deepStrictEqual(hist, []);
  assert.strictEqual(Storage.wasRecoveredFromCorruption(), true);
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
