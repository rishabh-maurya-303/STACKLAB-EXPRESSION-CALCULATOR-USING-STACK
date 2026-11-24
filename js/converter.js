/**
 * StackLab — Complete Notation Converter (All 6 Stack-Based Conversions)
 * 1. Infix   -> Postfix  (Shunting-Yard with custom Stack)
 * 2. Infix   -> Prefix   (Two-Stack direct left-to-right builder — properly handles right-assoc ^ and unary ops)
 * 3. Postfix -> Infix    (Custom Stack operand assembler with safe parenthesization)
 * 4. Prefix  -> Infix    (Custom Stack right-to-left assembler with safe parenthesization)
 * 5. Postfix -> Prefix   (Custom Stack left-to-right assembler)
 * 6. Prefix  -> Postfix  (Custom Stack right-to-left assembler)
 */
(function (global) {
  'use strict';

  function getDeps() {
    if (typeof module !== 'undefined' && module.exports && !global.StackLab?.Stack) {
      return {
        Stack: require('./stack').Stack,
        Precedence: require('./precedence'),
        Validator: require('./validator')
      };
    }
    return {
      Stack: global.StackLab.Stack,
      Precedence: global.StackLab.Precedence,
      Validator: global.StackLab.Validator
    };
  }

  function mergeStats(s1, s2) {
    return {
      pushes: s1.pushes + s2.pushes,
      pops: s1.pops + s2.pops,
      peeks: s1.peeks + s2.peeks,
      maxSize: Math.max(s1.maxSize, s2.maxSize),
      combinedMaxSize: s1.maxSize + s2.maxSize
    };
  }

  /**
   * 1. Infix -> Postfix (Shunting-Yard Algorithm using custom Stack)
   */
  function infixToPostfix(expression, options = {}) {
    const { Stack, Precedence, Validator } = getDeps();
    const validation = Validator.validateInfix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const opStack = new Stack();
    const outputTokens = [];
    const trace = [];
    let stepNum = 0;

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: opStack.getItems(),
        output: outputTokens.join(' '),
        stackSize: opStack.size(),
        maxStackSize: opStack.getStats().maxSize,
        description
      });
    };

    record('START', 'INIT', 'Initialize empty Operator Stack and empty Postfix output list.');

    const tokens = validation.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];

      if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
        outputTokens.push(tok.value);
        record(tok.value, 'OUTPUT', `Operand "${tok.value}" appended directly to Postfix output.`);
      } else if (tok.type === 'LPAREN') {
        opStack.push('(');
        record('(', 'PUSH', 'Opening parenthesis "(" pushed onto Operator Stack.');
      } else if (tok.type === 'RPAREN') {
        while (!opStack.isEmpty() && opStack.peek() !== '(') {
          const popped = opStack.pop();
          outputTokens.push(popped);
          record(')', 'POP', `Popped "${popped}" from Operator Stack until "(" is reached.`);
        }
        if (!opStack.isEmpty() && opStack.peek() === '(') {
          opStack.pop();
          record(')', 'POP', 'Discarded matching opening parenthesis "(" from Operator Stack.');
        }
      } else if (tok.type === 'UNARY_OP' || tok.type === 'OPERATOR') {
        const incoming = tok.value;
        while (!opStack.isEmpty() && opStack.peek() !== '(' && Precedence.shouldPopStackTop(opStack.peek(), incoming)) {
          const popped = opStack.pop();
          outputTokens.push(popped);
          record(
            incoming,
            'POP',
            `Popped "${popped}" (prec ${Precedence.getPrecedence(popped)}) before pushing "${incoming}" (prec ${Precedence.getPrecedence(incoming)}, ${Precedence.getAssociativity(incoming)}-assoc).`
          );
        }
        opStack.push(incoming);
        record(
          incoming,
          'PUSH',
          `Pushed ${tok.type === 'UNARY_OP' ? 'unary operator' : 'operator'} "${incoming}" onto Operator Stack.`
        );
      }
    }

    while (!opStack.isEmpty()) {
      const popped = opStack.pop();
      outputTokens.push(popped);
      record('END', 'POP', `End of expression: popped remaining operator "${popped}" to output.`);
    }

    const result = outputTokens.join(' ');
    record('DONE', 'COMPLETE', `Conversion complete. Postfix: ${result}`);

    return {
      success: true,
      algorithm: 'Infix to Postfix',
      source: 'infix',
      target: 'postfix',
      input: expression,
      result,
      tokens: outputTokens,
      trace,
      stats: opStack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * 2. Infix -> Prefix (Direct Two-Stack Algorithm — NO broken string-reversal hack!)
   * Uses two independent custom Stack instances:
   *   - opStack   : stores operators and '('
   *   - exprStack : builds partial prefix sub-expressions
   * Accurately handles right-associative exponentiation (2^3^2 -> ^ 2 ^ 3 2)
   * and unary precedence (-2^2 -> u- ^ 2 2, (-2)^2 -> ^ u- 2 2).
   */
  function infixToPrefix(expression, options = {}) {
    const { Stack, Precedence, Validator } = getDeps();
    const validation = Validator.validateInfix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const opStack = new Stack();
    const exprStack = new Stack();
    const trace = [];
    let stepNum = 0;

    const currentOutput = () => exprStack.getItems().join(' | ');

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: opStack.getItems(),
        secondaryStackState: exprStack.getItems(),
        output: currentOutput(),
        stackSize: opStack.size(),
        maxStackSize: opStack.getStats().maxSize,
        description
      });
    };

    const applyTopOperator = (triggerToken) => {
      const op = opStack.pop();
      if (Precedence.isUnaryOperator(op)) {
        const operand = exprStack.pop();
        const combined = `${op} ${operand}`;
        exprStack.push(combined);
        record(
          triggerToken,
          'COMBINE',
          `Popped unary "${op}" and operand "${operand}" -> pushed prefix "${combined}" onto Expression Stack.`
        );
      } else {
        const right = exprStack.pop();
        const left = exprStack.pop();
        const combined = `${op} ${left} ${right}`;
        exprStack.push(combined);
        record(
          triggerToken,
          'COMBINE',
          `Popped binary "${op}", right="${right}", left="${left}" -> pushed prefix "${combined}" onto Expression Stack.`
        );
      }
    };

    record('START', 'INIT', 'Initialize Operator Stack and Expression Stack for direct Two-Stack Infix-to-Prefix.');

    const tokens = validation.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];

      if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
        exprStack.push(tok.value);
        record(tok.value, 'PUSH_EXPR', `Pushed operand "${tok.value}" onto Expression Stack.`);
      } else if (tok.type === 'LPAREN') {
        opStack.push('(');
        record('(', 'PUSH', 'Pushed "(" onto Operator Stack.');
      } else if (tok.type === 'RPAREN') {
        while (!opStack.isEmpty() && opStack.peek() !== '(') {
          applyTopOperator(')');
        }
        if (!opStack.isEmpty() && opStack.peek() === '(') {
          opStack.pop();
          record(')', 'POP', 'Discarded matching "(" from Operator Stack.');
        }
      } else if (tok.type === 'UNARY_OP' || tok.type === 'OPERATOR') {
        const incoming = tok.value;
        while (!opStack.isEmpty() && opStack.peek() !== '(' && Precedence.shouldPopStackTop(opStack.peek(), incoming)) {
          applyTopOperator(incoming);
        }
        opStack.push(incoming);
        record(
          incoming,
          'PUSH',
          `Pushed "${incoming}" (prec ${Precedence.getPrecedence(incoming)}, ${Precedence.getAssociativity(incoming)}-assoc) onto Operator Stack.`
        );
      }
    }

    while (!opStack.isEmpty()) {
      applyTopOperator('END');
    }

    const result = exprStack.pop();
    const combinedStats = mergeStats(opStack.getStats(), exprStack.getStats());
    record('DONE', 'COMPLETE', `Conversion complete. Prefix: ${result}`);

    return {
      success: true,
      algorithm: 'Infix to Prefix',
      source: 'infix',
      target: 'prefix',
      input: expression,
      result,
      tokens: result.split(/\s+/),
      trace,
      stats: combinedStats,
      tokensProcessed: tokens.length
    };
  }

  /**
   * 3. Postfix -> Infix (Left-to-Right Custom Stack Algorithm)
   */
  function postfixToInfix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePostfix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    let stepNum = 0;

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: stack.getItems(),
        output: stack.peek() || '',
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    const tokens = validation.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
        const val = tok.value.startsWith('-') ? `(${tok.value})` : tok.value;
        stack.push(val);
        record(tok.value, 'PUSH', `Pushed operand "${val}" onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        const operand = stack.pop();
        const sign = tok.value === 'u-' ? '-' : '+';
        const combined = `(${sign}${operand})`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped "${operand}", applied unary "${sign}", pushed "${combined}".`);
      } else if (tok.type === 'OPERATOR') {
        const right = stack.pop();
        const left = stack.pop();
        const combined = `(${left} ${tok.value} ${right})`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped right="${right}", left="${left}", pushed "${combined}".`);
      }
    }

    const result = stack.pop();
    record('DONE', 'COMPLETE', `Postfix to Infix complete: ${result}`);

    return {
      success: true,
      algorithm: 'Postfix to Infix',
      source: 'postfix',
      target: 'infix',
      input: expression,
      result,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * 4. Prefix -> Infix (Right-to-Left Custom Stack Algorithm)
   */
  function prefixToInfix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePrefix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    let stepNum = 0;

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: stack.getItems(),
        output: stack.peek() || '',
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    const tokens = validation.tokens;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const tok = tokens[i];
      if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
        const val = tok.value.startsWith('-') ? `(${tok.value})` : tok.value;
        stack.push(val);
        record(tok.value, 'PUSH', `Scanned right-to-left: pushed operand "${val}" onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        const operand = stack.pop();
        const sign = tok.value === 'u-' ? '-' : '+';
        const combined = `(${sign}${operand})`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped "${operand}", applied unary "${sign}", pushed "${combined}".`);
      } else if (tok.type === 'OPERATOR') {
        const left = stack.pop();
        const right = stack.pop();
        const combined = `(${left} ${tok.value} ${right})`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped left="${left}", right="${right}", pushed "${combined}".`);
      }
    }

    const result = stack.pop();
    record('DONE', 'COMPLETE', `Prefix to Infix complete: ${result}`);

    return {
      success: true,
      algorithm: 'Prefix to Infix',
      source: 'prefix',
      target: 'infix',
      input: expression,
      result,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * 5. Postfix -> Prefix (Left-to-Right Custom Stack Algorithm)
   */
  function postfixToPrefix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePostfix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    let stepNum = 0;

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: stack.getItems(),
        output: stack.peek() || '',
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    const tokens = validation.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
        stack.push(tok.value);
        record(tok.value, 'PUSH', `Pushed operand "${tok.value}" onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        const operand = stack.pop();
        const combined = `${tok.value} ${operand}`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped "${operand}", formed prefix "${combined}", pushed to Stack.`);
      } else if (tok.type === 'OPERATOR') {
        const right = stack.pop();
        const left = stack.pop();
        const combined = `${tok.value} ${left} ${right}`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped right="${right}", left="${left}", formed prefix "${combined}".`);
      }
    }

    const result = stack.pop();
    record('DONE', 'COMPLETE', `Postfix to Prefix complete: ${result}`);

    return {
      success: true,
      algorithm: 'Postfix to Prefix',
      source: 'postfix',
      target: 'prefix',
      input: expression,
      result,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * 6. Prefix -> Postfix (Right-to-Left Custom Stack Algorithm)
   */
  function prefixToPostfix(expression, options = {}) {
    const { Stack, Validator } = getDeps();
    const validation = Validator.validatePrefix(expression);
    if (!validation.valid) {
      return { success: false, error: validation.message, position: validation.position, suggestion: validation.suggestion };
    }

    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    let stepNum = 0;

    const record = (token, operation, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: stack.getItems(),
        output: stack.peek() || '',
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    const tokens = validation.tokens;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const tok = tokens[i];
if (tok.type === 'NUMBER' || tok.type === 'IDENTIFIER') {
          stack.push(tok.value);
        record(tok.value, 'PUSH', `Scanned right-to-left: pushed operand "${tok.value}" onto Stack.`);
      } else if (tok.type === 'UNARY_OP') {
        const operand = stack.pop();
        const combined = `${operand} ${tok.value}`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped "${operand}", formed postfix "${combined}", pushed to Stack.`);
      } else if (tok.type === 'OPERATOR') {
        const left = stack.pop();
        const right = stack.pop();
        const combined = `${left} ${right} ${tok.value}`;
        stack.push(combined);
        record(tok.value, 'COMBINE', `Popped left="${left}", right="${right}", formed postfix "${combined}".`);
      }
    }

    const result = stack.pop();
    record('DONE', 'COMPLETE', `Prefix to Postfix complete: ${result}`);

    return {
      success: true,
      algorithm: 'Prefix to Postfix',
      source: 'prefix',
      target: 'postfix',
      input: expression,
      result,
      trace,
      stats: stack.getStats(),
      tokensProcessed: tokens.length
    };
  }

  /**
   * Unified conversion dispatcher across all 6 notation pairs.
   */
  function convert(expression, sourceNotation, targetNotation, options = {}) {
    const src = String(sourceNotation).toLowerCase();
    const tgt = String(targetNotation).toLowerCase();

    if (src === tgt) {
      const { Validator } = getDeps();
      const v = Validator.validate(expression, src);
      if (!v.valid) {
        return { success: false, error: v.message, position: v.position, suggestion: v.suggestion };
      }
      return {
        success: true,
        algorithm: `${src.toUpperCase()} Identity`,
        source: src,
        target: tgt,
        input: expression,
        result: expression.trim(),
        trace: [{
          step: 1,
          token: 'IDENTITY',
          operation: 'COMPLETE',
          stackState: [],
          output: expression.trim(),
          stackSize: 0,
          maxStackSize: 0,
          description: 'Source and target notations are identical; validated expression returned unchanged.'
        }],
        stats: { pushes: 0, pops: 0, peeks: 0, maxSize: 0 },
        tokensProcessed: v.tokens ? v.tokens.length : 0
      };
    }

    const key = `${src}->${tgt}`;
    switch (key) {
      case 'infix->postfix': return infixToPostfix(expression, options);
      case 'infix->prefix':  return infixToPrefix(expression, options);
      case 'postfix->infix': return postfixToInfix(expression, options);
      case 'prefix->infix':  return prefixToInfix(expression, options);
      case 'postfix->prefix': return postfixToPrefix(expression, options);
      case 'prefix->postfix': return prefixToPostfix(expression, options);
      default:
        return { success: false, error: `Unsupported conversion from "${src}" to "${tgt}".` };
    }
  }

  const Converter = {
    infixToPostfix,
    infixToPrefix,
    postfixToInfix,
    prefixToInfix,
    postfixToPrefix,
    prefixToPostfix,
    convert
  };

  global.StackLab = global.StackLab || {};
  global.StackLab.Converter = Converter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Converter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
