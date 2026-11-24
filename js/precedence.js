/**
 * StackLab — Operator Precedence, Associativity & Metadata
 * Defines strict mathematical precedence rules:
 *   1: + , -        (Binary, Left-Associative)
 *   2: * , / , %    (Binary, Left-Associative)
 *   3: u- , u+      (Prefix Unary, Right-Associative; binds looser than ^ so -2^2 = -(2^2) = -4)
 *   4: ^            (Binary Exponentiation, Right-Associative; 2^3^2 = 2^(3^2) = 512)
 */
(function (global) {
  'use strict';

  const OPERATORS = Object.freeze({
    '+':  { symbol: '+',  precedence: 1, associativity: 'LEFT',  arity: 2, name: 'Addition' },
    '-':  { symbol: '-',  precedence: 1, associativity: 'LEFT',  arity: 2, name: 'Subtraction' },
    '*':  { symbol: '*',  precedence: 2, associativity: 'LEFT',  arity: 2, name: 'Multiplication' },
    '/':  { symbol: '/',  precedence: 2, associativity: 'LEFT',  arity: 2, name: 'Division' },
    '%':  { symbol: '%',  precedence: 2, associativity: 'LEFT',  arity: 2, name: 'Modulus' },
    'u-': { symbol: 'u-', precedence: 3, associativity: 'RIGHT', arity: 1, name: 'Unary Negation' },
    'u+': { symbol: 'u+', precedence: 3, associativity: 'RIGHT', arity: 1, name: 'Unary Plus' },
    '^':  { symbol: '^',  precedence: 4, associativity: 'RIGHT', arity: 2, name: 'Exponentiation' }
  });

  function isOperator(symbol) {
    return Object.prototype.hasOwnProperty.call(OPERATORS, symbol);
  }

  function isBinaryOperator(symbol) {
    return isOperator(symbol) && OPERATORS[symbol].arity === 2;
  }

  function isUnaryOperator(symbol) {
    return isOperator(symbol) && OPERATORS[symbol].arity === 1;
  }

  function getPrecedence(symbol) {
    return isOperator(symbol) ? OPERATORS[symbol].precedence : -1;
  }

  function getAssociativity(symbol) {
    return isOperator(symbol) ? OPERATORS[symbol].associativity : null;
  }

  function isRightAssociative(symbol) {
    return getAssociativity(symbol) === 'RIGHT';
  }

  function isLeftAssociative(symbol) {
    return getAssociativity(symbol) === 'LEFT';
  }

  function getArity(symbol) {
    return isOperator(symbol) ? OPERATORS[symbol].arity : 0;
  }

  function getOperatorName(symbol) {
    return isOperator(symbol) ? OPERATORS[symbol].name : 'Unknown';
  }

  /**
   * Determines whether the operator currently at the top of the operator stack
   * should be popped before pushing the incoming operator.
   *
   * Compiler-theory rule for prefix unary operators:
   * - An incoming prefix unary operator (u-, u+) NEVER pops any operator to its left
   *   because it binds directly to the operand expression that follows it (e.g., 2^-3, 5*-2, --5).
   * - For an incoming binary operator:
   *     * Left-associative:  pop while prec(stackTop) >= prec(incoming)
   *     * Right-associative: pop while prec(stackTop) >  prec(incoming)
   */
  function shouldPopStackTop(stackTop, incoming) {
    if (!isOperator(stackTop) || !isOperator(incoming)) {
      return false;
    }
    if (isUnaryOperator(incoming)) {
      return false;
    }
    const topPrec = getPrecedence(stackTop);
    const inPrec = getPrecedence(incoming);

    if (isLeftAssociative(incoming)) {
      return topPrec >= inPrec;
    }
    return topPrec > inPrec;
  }

  const Precedence = {
    OPERATORS,
    isOperator,
    isBinaryOperator,
    isUnaryOperator,
    getPrecedence,
    getAssociativity,
    isRightAssociative,
    isLeftAssociative,
    getArity,
    getOperatorName,
    shouldPopStackTop
  };

  global.StackLab = global.StackLab || {};
  global.StackLab.Precedence = Precedence;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Precedence;
  }
})(typeof window !== 'undefined' ? window : globalThis);
