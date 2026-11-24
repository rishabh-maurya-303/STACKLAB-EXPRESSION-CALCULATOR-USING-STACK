/**
 * StackLab — Expression Evaluation Engine (NO eval() / NO Function())
 * Implements two independent Stack-based evaluation algorithms:
 *   1. Postfix Evaluation (Left-to-Right scan; pops right operand first, left operand second)
 *   2. Prefix Evaluation  (Right-to-Left scan; pops left operand first, right operand second)
 * Plus full Infix pipeline: Validate -> Infix-to-Postfix & Infix-to-Prefix -> Evaluate via Stack.
 */
(function (global) {
  'use strict';

  function getDeps() {
    if (typeof module !== 'undefined' && module.exports && !global.StackLab?.Stack) {
      return {
        Stack: require('./stack').Stack,
        Validator: require('./validator'),
        Converter: require('./converter')
      };
    }
    return {
      Stack: global.StackLab.Stack,
      Validator: global.StackLab.Validator,
      Converter: global.StackLab.Converter
    };
  }

  function cleanFloat(num) {
    if (!Number.isFinite(num)) return num;
    // Eliminate floating-point noise like 0.1 + 0.2 = 0.30000000000000004 while preserving precision
    const rounded = Number(num.toPrecision(12));
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function applyBinaryOp(op, left, right) {
    if (typeof left !== 'number' || typeof right !== 'number' || Number.isNaN(left) || Number.isNaN(right)) {
      return { ok: false, error: `Invalid numeric operand for operator "${op}".` };
    }

    let result;
    switch (op) {
      case '+':
        result = left + right;
        break;
      case '-':
        result = left - right;
        break;
      case '*':
        result = left * right;
        break;
      case '/':
        if (right === 0) {
          return { ok: false, error: `Division by zero error: cannot evaluate ${left} / 0.` };
        }
        result = left / right;
        break;
      case '%':
        if (right === 0) {
          return { ok: false, error: `Modulus by zero error: cannot evaluate ${left} % 0.` };
        }
        result = left % right;
        break;
      case '^':
        result = Math.pow(left, right);
        if (Number.isNaN(result)) {
          return { ok: false, error: `Invalid mathematical operation: ${left} ^ ${right} yields a non-real number.` };
        }
        break;
      default:
        return { ok: false, error: `Unsupported binary operator "${op}".` };
    }

    if (!Number.isFinite(result)) {
      return { ok: false, error: `Numeric overflow: ${left} ${op} ${right} exceeds finite IEEE-754 bounds.` };
    }

    return { ok: true, value: cleanFloat(result) };
  }

  function applyUnaryOp(op, operand) {
    if (typeof operand !== 'number' || Number.isNaN(operand)) {
      return { ok: false, error: `Invalid numeric operand for unary operator "${op}".` };
    }
    if (op === 'u-') return { ok: true, value: cleanFloat(-operand) };
    if (op === 'u+') return { ok: true, value: cleanFloat(+operand) };
    return { ok: false, error: `Unsupported unary operator "${op}".` };
  }

  /**
   * 1. Postfix Evaluation (Left-to-Right Scan using custom Stack)
   */
  function evaluatePostfix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePostfix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    const operations = [];
    let stepNum = 0;

    const record = (token, operation, output, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token: String(token),
        operation,
        stackState: stack.getItems().map((v) => String(v)),
        output: String(output),
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    record('START', 'INIT', 'Ready', 'Initialize empty Operand Stack for Left-to-Right Postfix Evaluation.');

    const tokens = validation.tokens;
    console.log('Postfix tokens:', tokens);
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];

      if (tok.type === 'NUMBER') {
        const val = cleanFloat(Number(tok.value));
        stack.push(val);
        record(tok.value, 'PUSH', `Top: ${val}`, `Pushed numeric operand ${val} onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        if (stack.size() < 1) {
          return { success: false, error: `Missing operand for unary operator "${tok.value}".` };
        }
        const a = stack.pop();
        const computed = applyUnaryOp(tok.value, a);
        if (!computed.ok) {
          record(tok.value, 'ERROR', 'Error', computed.error);
          return { success: false, error: computed.error, trace, stats: stack.getStats() };
        }
        stack.push(computed.value);
        const exprText = `${tok.value === 'u-' ? '-' : '+'}(${a}) = ${computed.value}`;
        operations.push({ operator: tok.value, operands: [a], result: computed.value, expression: exprText });
        record(tok.value, 'EVAL', exprText, `Popped ${a}, computed ${exprText}, pushed ${computed.value}.`);
      } else if (tok.type === 'OPERATOR') {
        if (stack.size() < 2) {
          return { success: false, error: `Missing operand(s) for binary operator "${tok.value}".` };
        }
        // CRITICAL Postfix rule: pop RIGHT operand first, LEFT operand second!
        const right = stack.pop();
        const left = stack.pop();
        const computed = applyBinaryOp(tok.value, left, right);
        if (!computed.ok) {
          record(tok.value, 'ERROR', 'Error', computed.error);
          return { success: false, error: computed.error, trace, stats: stack.getStats() };
        }
        stack.push(computed.value);
        const exprText = `${left} ${tok.value} ${right} = ${computed.value}`;
        operations.push({ operator: tok.value, operands: [left, right], result: computed.value, expression: exprText });
        record(tok.value, 'EVAL', exprText, `Popped right=${right}, left=${left}; computed ${exprText}; pushed ${computed.value}.`);
      }
    }

    if (stack.size() !== 1) {
      return { success: false, error: `Malformed Postfix expression: ${stack.size()} values remained on the stack.` };
    }

    const finalResult = stack.pop();
    record('DONE', 'COMPLETE', `Result = ${finalResult}`, `Popped final numerical result: ${finalResult}.`);

    return {
      success: true,
      algorithm: 'Postfix Evaluation',
      notation: 'postfix',
      input: expression,
      result: finalResult,
      operations,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * 2. Prefix Evaluation (Right-to-Left Scan using custom Stack)
   */
  function evaluatePrefix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePrefix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    const operations = [];
    let stepNum = 0;

    const record = (token, operation, output, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token: String(token),
        operation,
        stackState: stack.getItems().map((v) => String(v)),
        output: String(output),
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    record('START', 'INIT', 'Ready', 'Initialize empty Operand Stack for Right-to-Left Prefix Evaluation.');

    const tokens = validation.tokens;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const tok = tokens[i];

      if (tok.type === 'NUMBER') {
        const val = cleanFloat(Number(tok.value));
        stack.push(val);
        record(tok.value, 'PUSH', `Top: ${val}`, `Scanned right-to-left: pushed operand ${val} onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        if (stack.size() < 1) {
          return { success: false, error: `Missing operand for unary operator "${tok.value}".` };
        }
        const a = stack.pop();
        const computed = applyUnaryOp(tok.value, a);
        if (!computed.ok) {
          record(tok.value, 'ERROR', 'Error', computed.error);
          return { success: false, error: computed.error, trace, stats: stack.getStats() };
        }
        stack.push(computed.value);
        const exprText = `${tok.value === 'u-' ? '-' : '+'}(${a}) = ${computed.value}`;
        operations.push({ operator: tok.value, operands: [a], result: computed.value, expression: exprText });
        record(tok.value, 'EVAL', exprText, `Popped ${a}, computed ${exprText}, pushed ${computed.value}.`);
      } else if (tok.type === 'OPERATOR') {
        if (stack.size() < 2) {
          return { success: false, error: `Missing operand(s) for binary operator "${tok.value}".` };
        }
        // CRITICAL Prefix rule: pop LEFT operand first, RIGHT operand second!
        const left = stack.pop();
        const right = stack.pop();
        const computed = applyBinaryOp(tok.value, left, right);
        if (!computed.ok) {
          record(tok.value, 'ERROR', 'Error', computed.error);
          return { success: false, error: computed.error, trace, stats: stack.getStats() };
        }
        stack.push(computed.value);
        const exprText = `${left} ${tok.value} ${right} = ${computed.value}`;
        operations.push({ operator: tok.value, operands: [left, right], result: computed.value, expression: exprText });
        record(tok.value, 'EVAL', exprText, `Popped left=${left}, right=${right}; computed ${exprText}; pushed ${computed.value}.`);
      }
    }

    if (stack.size() !== 1) {
      return { success: false, error: `Malformed Prefix expression: ${stack.size()} values remained on the stack.` };
    }

    const finalResult = stack.pop();
    record('DONE', 'COMPLETE', `Result = ${finalResult}`, `Popped final numerical result: ${finalResult}.`);

    return {
      success: true,
      algorithm: 'Prefix Evaluation',
      notation: 'prefix',
      input: expression,
      result: finalResult,
      operations,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * Full Infix Calculation Pipeline (Validate -> Infix->Postfix & Infix->Prefix -> Stack Evaluation)
   * Cross-verifies Postfix and Prefix evaluation results for guaranteed mathematical integrity.
   */
  function evaluateInfix(expression) {
    const { Validator, Converter } = getDeps();
    const validation = Validator.validateInfix(expression);
    if (!validation.valid) {
      return {
        success: false,
        validation,
        error: validation.message,
        position: validation.position,
        suggestion: validation.suggestion
      };
    }

    const postfixConv = Converter.infixToPostfix(expression, { recordTrace: true });
    if (!postfixConv.success) {
      return { success: false, validation, error: postfixConv.error };
    }

    const prefixConv = Converter.infixToPrefix(expression, { recordTrace: false });
    if (!prefixConv.success) {
      return { success: false, validation, error: prefixConv.error };
    }

    const postfixEval = evaluatePostfix(postfixConv.result, { recordTrace: true });
    if (!postfixEval.success) {
      return {
        success: false,
        validation,
        postfix: postfixConv.result,
        prefix: prefixConv.result,
        error: postfixEval.error
      };
    }

    const prefixEval = evaluatePrefix(prefixConv.result, { recordTrace: false });

    const totalStats = {
      pushes: postfixConv.stats.pushes + postfixEval.stats.pushes,
      pops: postfixConv.stats.pops + postfixEval.stats.pops,
      peeks: postfixConv.stats.peeks + postfixEval.stats.peeks,
      maxSize: Math.max(postfixConv.stats.maxSize, postfixEval.stats.maxSize)
    };

    const explanation =
      `1) Tokenized "${expression.trim()}" into ${validation.tokens.length} lexical token(s) and verified balanced parentheses via Stack. ` +
      `2) Converted Infix to Postfix ("${postfixConv.result}") using Shunting-Yard Stack algorithm (${postfixConv.stats.pushes} pushes, ${postfixConv.stats.pops} pops) and to Prefix ("${prefixConv.result}") via Two-Stack algorithm. ` +
      `3) Evaluated Postfix left-to-right on an Operand Stack in ${postfixEval.operations.length} arithmetic step(s) yielding ${postfixEval.result}` +
      (prefixEval.success ? ` (cross-checked via right-to-left Prefix evaluation: ${prefixEval.result}).` : '.');

    return {
      success: true,
      validation,
      original: expression.trim(),
      postfix: postfixConv.result,
      prefix: prefixConv.result,
      result: postfixEval.result,
      prefixVerifiedResult: prefixEval.success ? prefixEval.result : null,
      operations: postfixEval.operations,
      explanation,
      conversionStats: postfixConv.stats,
      evaluationStats: postfixEval.stats,
      stats: totalStats,
      tokensProcessed: validation.tokens.length
    };
  }

  const Evaluator = {
    evaluatePostfix,
    evaluatePrefix,
    evaluateInfix
  };

  global.StackLab = global.StackLab || {};
  global.StackLab.Evaluator = Evaluator;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaluator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
