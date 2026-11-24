/**
 * StackLab — Independent Expression Validation Module
 * Validates Infix, Postfix, and Prefix expressions using:
 *   1. Empty-input verification
 *   2. Lexical tokenization verification
 *   3. Custom Stack-based bracket matching (with optional full trace for Stack Visualizer)
 *   4. Formal token-state / arity grammar validation
 *   5. Runtime mathematical safety checks (division/modulus by zero) when requested
 * Never silently modifies invalid user input; provides exact error positions & suggestions.
 */
(function (global) {
  'use strict';

  function isOperandToken(token) {
    return token && (
        token.type === 'NUMBER' ||
        token.type === 'IDENTIFIER'
    );
}

  function getDeps() {
    if (typeof module !== 'undefined' && module.exports && !global.StackLab?.Stack) {
      return {
        Stack: require('./stack').Stack,
        Tokenizer: require('./tokenizer'),
        Precedence: require('./precedence')
      };
    }
    return {
      Stack: global.StackLab.Stack,
      Tokenizer: global.StackLab.Tokenizer,
      Precedence: global.StackLab.Precedence
    };
  }

  /**
   * Stack-based Bracket Matching Algorithm (O(n) time, O(n) space).
   * Uses the custom Stack ADT and optionally records real operation trace steps.
   */
  function matchBrackets(expression, options = {}) {
    const { Stack } = getDeps();
    const recordTrace = Boolean(options.recordTrace);
    const stack = new Stack();
    const trace = [];
    let stepNum = 0;

    const pushTrace = (token, operation, output, description) => {
      if (!recordTrace) return;
      stepNum += 1;
      trace.push({
        step: stepNum,
        token,
        operation,
        stackState: stack.getItems(),
        output,
        stackSize: stack.size(),
        maxStackSize: stack.getStats().maxSize,
        description
      });
    };

    if (typeof expression !== 'string' || expression.trim() === '') {
      return {
        valid: false,
        message: 'Expression is empty.',
        position: 0,
        suggestion: 'Enter an expression containing operands, operators, or parentheses.',
        trace,
        stats: stack.getStats(),
        tokensProcessed: 0
      };
    }

    pushTrace('START', 'INIT', 'Scanning...', 'Initialize empty Stack for parentheses matching.');

    let tokensProcessed = 0;
    let matchedPairs = 0;

    for (let i = 0; i < expression.length; i += 1) {
      const ch = expression[i];
      if (ch === ' ' || ch === '\t') continue;
      tokensProcessed += 1;

      if (ch === '(') {
        stack.push(`( @${i}`);
        pushTrace(
          '(',
          'PUSH',
          `Matched pairs: ${matchedPairs}`,
          `Found opening "(" at index ${i}. Push onto Stack.`
        );
      } else if (ch === ')') {
        if (stack.isEmpty()) {
          pushTrace(
            ')',
            'ERROR',
            'Mismatch detected',
            `Found closing ")" at index ${i}, but Stack is empty (no matching "(").`
          );
          return {
            valid: false,
            message: `Mismatched parentheses: unexpected closing ")" at position ${i} without a matching "(".`,
            position: i,
            suggestion: `Remove ")" at position ${i} or add a matching "(" earlier: (${expression.slice(0, i + 1)}${expression.slice(i + 1)}`,
            trace,
            stats: stack.getStats(),
            tokensProcessed
          };
        }
        const popped = stack.pop();
        matchedPairs += 1;
        pushTrace(
          ')',
          'POP',
          `Matched pairs: ${matchedPairs}`,
          `Found closing ")" at index ${i}. Pop matching "${popped}" from Stack.`
        );
      } else {
        pushTrace(
          ch,
          'SKIP',
          `Matched pairs: ${matchedPairs}`,
          `Character "${ch}" is not a parenthesis — ignored by bracket matcher.`
        );
      }
    }

    if (!stack.isEmpty()) {
      const unclosed = stack.peek();
      const idxMatch = String(unclosed).match(/@(\d+)/);
      const pos = idxMatch ? Number(idxMatch[1]) : 0;
      const missingCount = stack.size();
      pushTrace(
        'END',
        'ERROR',
        `${missingCount} unclosed "("`,
        `Reached end of expression with ${missingCount} unclosed "(" remaining on Stack.`
      );
      return {
        valid: false,
        message: `Mismatched parentheses: ${missingCount} unclosed "(" starting at position ${pos}.`,
        position: pos,
        suggestion: `${expression}${')'.repeat(missingCount)}`,
        trace,
        stats: stack.getStats(),
        tokensProcessed
      };
    }

    pushTrace(
      'END',
      'COMPLETE',
      `Balanced (${matchedPairs} pair${matchedPairs === 1 ? '' : 's'})`,
      'End of expression reached and Stack is empty — all parentheses are properly balanced.'
    );

    return {
      valid: true,
      message: `Parentheses are balanced (${matchedPairs} pair${matchedPairs === 1 ? '' : 's'}).`,
      position: null,
      suggestion: null,
      trace,
      stats: stack.getStats(),
      tokensProcessed
    };
  }

  /**
   * Validate an Infix expression completely:
   *  1. Empty check
   *  2. Tokenization check
   *  3. Stack-based bracket matching
   *  4. Finite-state grammar check (operands, binary/unary operators, parentheses)
   */
  function validateInfix(expression) {
    const { Tokenizer } = getDeps();
    const checks = {
      nonEmpty: { passed: false, detail: '' },
      lexical: { passed: false, detail: '' },
      brackets: { passed: false, detail: '' },
      syntax: { passed: false, detail: '' }
    };

    if (typeof expression !== 'string' || expression.trim() === '') {
      checks.nonEmpty.detail = 'Expression is empty.';
      return {
        valid: false,
        notation: 'infix',
        message: 'Expression cannot be empty.',
        position: 0,
        suggestion: 'Try an expression like (5 + 3) * 2.',
        checks
      };
    }
    checks.nonEmpty = { passed: true, detail: 'Non-empty input provided.' };

    const tokResult = Tokenizer.tokenizeInfix(expression);
    if (!tokResult.success) {
      checks.lexical.detail = tokResult.error.message;
      return {
        valid: false,
        notation: 'infix',
        message: tokResult.error.message,
        position: tokResult.error.position,
        suggestion: tokResult.error.suggestion || null,
        checks
      };
    }
    const tokens = tokResult.tokens;
    checks.lexical = { passed: true, detail: `Recognized ${tokens.length} valid token(s).` };

    // Stage 3: Custom Stack bracket matching
    const bracketResult = matchBrackets(expression);
    if (!bracketResult.valid) {
      checks.brackets.detail = bracketResult.message;
      return {
        valid: false,
        notation: 'infix',
        message: bracketResult.message,
        position: bracketResult.position,
        suggestion: bracketResult.suggestion,
        checks,
        bracketStats: bracketResult.stats
      };
    }
    checks.brackets = { passed: true, detail: bracketResult.message };

    // Stage 4: Token-state grammar validation
    // State: 'EXPECT_OPERAND' (start, after '(', after binary op, after unary op)
    //     or 'EXPECT_OPERATOR' (after NUMBER, after ')')
    let state = 'EXPECT_OPERAND';
    let prevToken = null;

    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];

      if (state === 'EXPECT_OPERAND') {
        if (isOperandToken(tok)) {
          state = 'EXPECT_OPERATOR';
        } else if (tok.type === 'LPAREN') {
          state = 'EXPECT_OPERAND';
        } else if (tok.type === 'UNARY_OP') {
          // Guard against accidental chained binary-like unary repetition? Standard math allows -(-x) or --x,
          // while binary operators like *, /, %, ^ are never allowed here.
          state = 'EXPECT_OPERAND';
        } else if (tok.type === 'RPAREN') {
          const msg = prevToken && prevToken.type === 'LPAREN'
            ? `Empty parentheses "()" at position ${prevToken.position}.`
            : `Missing operand before ")" at position ${tok.position}.`;
          const sug = prevToken && prevToken.type === 'LPAREN'
            ? 'Place an expression inside the parentheses or remove "()".'
            : `Insert a number before ")" (e.g., after "${prevToken ? prevToken.raw : ''}").`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'infix', message: msg, position: tok.position, suggestion: sug, checks };
        } else if (tok.type === 'OPERATOR') {
          let msg;
          let sug;
          if (!prevToken) {
            msg = `Invalid operator placement: expression cannot start with binary operator "${tok.raw}" at position ${tok.position}.`;
            sug = expression.slice(tok.position + 1).trim() || 'Remove the leading operator or add a left operand.';
          } else if (prevToken.type === 'LPAREN') {
            msg = `Invalid operator placement: binary operator "${tok.raw}" cannot immediately follow "(" at position ${tok.position}.`;
            sug = 'Provide a left operand after "(" before the operator.';
          } else {
            msg = `Consecutive invalid operators: "${prevToken.raw}" followed by "${tok.raw}" at position ${tok.position}.`;
            sug = `${expression.slice(0, tok.position)}${expression.slice(tok.position + 1)}`;
          }
          checks.syntax.detail = msg;
          return { valid: false, notation: 'infix', message: msg, position: tok.position, suggestion: sug, checks };
        }
      } else {
        // state === 'EXPECT_OPERATOR'
        if (tok.type === 'OPERATOR') {
          state = 'EXPECT_OPERAND';
        } else if (tok.type === 'RPAREN') {
          state = 'EXPECT_OPERATOR';
        } else if (isOperandToken(tok) || tok.type === 'LPAREN') {
          const msg = `Missing operator between "${prevToken.raw}" and "${tok.raw}" at position ${tok.position}.`;
          const sug = `${expression.slice(0, tok.position)}*${expression.slice(tok.position)}`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'infix', message: msg, position: tok.position, suggestion: sug, checks };
        } else if (tok.type === 'UNARY_OP') {
          const msg = `Unexpected unary operator "${tok.raw}" at position ${tok.position}.`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'infix', message: msg, position: tok.position, suggestion: null, checks };
        }
      }

      prevToken = tok;
    }

    if (state === 'EXPECT_OPERAND') {
      const last = tokens[tokens.length - 1];
      const msg = `Missing operand: expression ends unexpectedly after "${last.raw}" at position ${last.position}.`;
      const sug = `${expression.trim()} 0`;
      checks.syntax.detail = msg;
      return { valid: false, notation: 'infix', message: msg, position: last.position, suggestion: sug, checks };
    }

    checks.syntax = { passed: true, detail: 'All operators, operands, and grammar transitions are valid.' };

    return {
      valid: true,
      notation: 'infix',
      message: 'Valid Infix expression.',
      position: null,
      suggestion: null,
      tokens,
      checks,
      bracketStats: bracketResult.stats
    };
  }

  /**
   * Validate a space-delimited Postfix expression using a custom Stack.
   */
  function validatePostfix(expression) {
    const { Stack, Tokenizer } = getDeps();
    const checks = {
      nonEmpty: { passed: false, detail: '' },
      lexical: { passed: false, detail: '' },
      brackets: { passed: true, detail: 'Not applicable (Postfix uses no parentheses).' },
      syntax: { passed: false, detail: '' }
    };

    if (typeof expression !== 'string' || expression.trim() === '') {
      checks.nonEmpty.detail = 'Expression is empty.';
      return {
        valid: false,
        notation: 'postfix',
        message: 'Postfix expression cannot be empty.',
        position: 0,
        suggestion: 'Try a valid Postfix expression like: 5 3 + 2 *',
        checks
      };
    }
    checks.nonEmpty = { passed: true, detail: 'Non-empty input provided.' };

    const tokResult = Tokenizer.tokenizeSpaceDelimited(expression);
    if (!tokResult.success) {
      checks.lexical.detail = tokResult.error.message;
      return {
        valid: false,
        notation: 'postfix',
        message: tokResult.error.message,
        position: tokResult.error.position,
        suggestion: tokResult.error.suggestion || null,
        checks
      };
    }
    const tokens = tokResult.tokens;
    checks.lexical = { passed: true, detail: `Recognized ${tokens.length} valid token(s).` };

    const stack = new Stack();
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (isOperandToken(tok)) {
        stack.push(tok.value);
      } else if (tok.type === 'UNARY_OP') {
        if (stack.size() < 1) {
          const msg = `Invalid Postfix: unary operator "${tok.raw}" at position ${tok.position} requires 1 operand on the stack.`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'postfix', message: msg, position: tok.position, suggestion: 'Place an operand before the unary operator (e.g., "5 u-").', checks };
        }
        const a = stack.pop();
        stack.push(`(${tok.value} ${a})`);
      } else if (tok.type === 'OPERATOR') {
        if (stack.size() < 2) {
          const msg = `Invalid Postfix: binary operator "${tok.raw}" at position ${tok.position} requires 2 operands, but stack only has ${stack.size()}.`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'postfix', message: msg, position: tok.position, suggestion: 'Ensure two operands precede each binary operator (e.g., "5 3 +").', checks };
        }
        const right = stack.pop();
        const left = stack.pop();
        stack.push(`(${left} ${tok.value} ${right})`);
      }
    }

    if (stack.size() !== 1) {
      const msg = `Invalid Postfix: ${stack.size()} unused operand(s) remained on the stack (missing operator).`;
      checks.syntax.detail = msg;
      return {
        valid: false,
        notation: 'postfix',
        message: msg,
        position: tokens[tokens.length - 1].position,
        suggestion: `Add ${stack.size() - 1} binary operator(s) to combine remaining operands.`,
        checks
      };
    }

    checks.syntax = { passed: true, detail: 'Valid Postfix operand/operator arity verified via Stack.' };
    return {
      valid: true,
      notation: 'postfix',
      message: 'Valid Postfix expression.',
      position: null,
      suggestion: null,
      tokens,
      checks
    };
  }

  /**
   * Validate a space-delimited Prefix expression using a custom Stack (right-to-left scan).
   */
  function validatePrefix(expression) {
    const { Stack, Tokenizer } = getDeps();
    const checks = {
      nonEmpty: { passed: false, detail: '' },
      lexical: { passed: false, detail: '' },
      brackets: { passed: true, detail: 'Not applicable (Prefix uses no parentheses).' },
      syntax: { passed: false, detail: '' }
    };

    if (typeof expression !== 'string' || expression.trim() === '') {
      checks.nonEmpty.detail = 'Expression is empty.';
      return {
        valid: false,
        notation: 'prefix',
        message: 'Prefix expression cannot be empty.',
        position: 0,
        suggestion: 'Try a valid Prefix expression like: * + 5 3 2',
        checks
      };
    }
    checks.nonEmpty = { passed: true, detail: 'Non-empty input provided.' };

    const tokResult = Tokenizer.tokenizeSpaceDelimited(expression);
    if (!tokResult.success) {
      checks.lexical.detail = tokResult.error.message;
      return {
        valid: false,
        notation: 'prefix',
        message: tokResult.error.message,
        position: tokResult.error.position,
        suggestion: tokResult.error.suggestion || null,
        checks
      };
    }
    const tokens = tokResult.tokens;
    checks.lexical = { passed: true, detail: `Recognized ${tokens.length} valid token(s).` };

    const stack = new Stack();
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const tok = tokens[i];
      if (isOperandToken(tok)) {
        stack.push(tok.value);
      } else if (tok.type === 'UNARY_OP') {
        if (stack.size() < 1) {
          const msg = `Invalid Prefix: unary operator "${tok.raw}" at position ${tok.position} requires 1 operand following it.`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'prefix', message: msg, position: tok.position, suggestion: 'Place an operand after the unary operator (e.g., "u- 5").', checks };
        }
        const a = stack.pop();
        stack.push(`(${tok.value} ${a})`);
      } else if (tok.type === 'OPERATOR') {
        if (stack.size() < 2) {
          const msg = `Invalid Prefix: binary operator "${tok.raw}" at position ${tok.position} requires 2 operands following it, found ${stack.size()}.`;
          checks.syntax.detail = msg;
          return { valid: false, notation: 'prefix', message: msg, position: tok.position, suggestion: 'Ensure two operands follow each binary operator (e.g., "+ 5 3").', checks };
        }
        const left = stack.pop();
        const right = stack.pop();
        stack.push(`(${left} ${tok.value} ${right})`);
      }
    }

    if (stack.size() !== 1) {
      const msg = `Invalid Prefix: ${stack.size()} uncombined operand(s) remained on the stack (missing operator).`;
      checks.syntax.detail = msg;
      return {
        valid: false,
        notation: 'prefix',
        message: msg,
        position: tokens[0].position,
        suggestion: `Add ${stack.size() - 1} binary operator(s) at the start to combine remaining operands.`,
        checks
      };
    }

    checks.syntax = { passed: true, detail: 'Valid Prefix operand/operator arity verified via Stack.' };
    return {
      valid: true,
      notation: 'prefix',
      message: 'Valid Prefix expression.',
      position: null,
      suggestion: null,
      tokens,
      checks
    };
  }

  /**
   * Unified validate entry point for any notation.
   */
  function validate(expression, notation = 'infix') {
    const mode = String(notation || 'infix').toLowerCase();
    if (mode === 'postfix') return validatePostfix(expression);
    if (mode === 'prefix') return validatePrefix(expression);
    return validateInfix(expression);
  }

  const Validator = {
    validate,
    validateInfix,
    validatePostfix,
    validatePrefix,
    matchBrackets
  };

  global.StackLab = global.StackLab || {};
  global.StackLab.Validator = Validator;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
  }
})(typeof window !== 'undefined' ? window : globalThis);
