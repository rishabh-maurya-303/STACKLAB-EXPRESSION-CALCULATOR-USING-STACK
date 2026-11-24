
/**
 * StackLab — Expression Tokenizer
 * Supports:
 * - Alphabetical operands: a, b, x, total, value1
 * - Integer and decimal numbers
 * - Operators: +, -, *, /, %, ^
 * - Unary + and -
 * - Parentheses
 * - Infix, Postfix and Prefix notation
 */

(function (global) {
    'use strict';

    const BINARY_CHARS = new Set(['+', '-', '*', '/', '%', '^']);

    function isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }

    function isWhitespace(ch) {
        return /\s/.test(ch);
    }

    // ---------------------------------------
    // INFIX TOKENIZER
    // ---------------------------------------

    function tokenizeInfix(input) {

        if (typeof input !== 'string') {
            return {
                success: false,
                tokens: [],
                error: {
                    message: 'Expression must be a string.',
                    position: 0
                }
            };
        }

        const tokens = [];
        let i = 0;

        while (i < input.length) {

            const ch = input[i];

            // Ignore whitespace
            if (isWhitespace(ch)) {
                i++;
                continue;
            }

            // Alphabetical operands / variables
            if (/[A-Za-z_]/.test(ch)) {

                const start = i;
                let name = '';

                while (
                    i < input.length &&
                    /[A-Za-z0-9_]/.test(input[i])
                ) {
                    name += input[i];
                    i++;
                }

                tokens.push({
                    type: 'IDENTIFIER',
                    value: name,
                    raw: name,
                    position: start,
                    length: name.length
                });

                continue;
            }

            // Numeric literals: 25, 3.14, .5
            if (isDigit(ch) || ch === '.') {

                const start = i;
                let number = '';
                let dotCount = 0;

                while (
                    i < input.length &&
                    (isDigit(input[i]) || input[i] === '.')
                ) {

                    if (input[i] === '.') {
                        dotCount++;
                    }

                    number += input[i];
                    i++;
                }

                if (dotCount > 1 || !/\d/.test(number)) {
                    return {
                        success: false,
                        tokens,
                        error: {
                            message: `Invalid number "${number}".`,
                            position: start,
                            suggestion: 'Enter a valid number.'
                        }
                    };
                }

                tokens.push({
                    type: 'NUMBER',
                    value: number,
                    raw: number,
                    position: start,
                    length: number.length
                });

                continue;
            }

            // Opening parenthesis
            if (ch === '(') {

                tokens.push({
                    type: 'LPAREN',
                    value: '(',
                    raw: '(',
                    position: i,
                    length: 1
                });

                i++;
                continue;
            }

            // Closing parenthesis
            if (ch === ')') {

                tokens.push({
                    type: 'RPAREN',
                    value: ')',
                    raw: ')',
                    position: i,
                    length: 1
                });

                i++;
                continue;
            }

            // Operators and unary operators
            if (BINARY_CHARS.has(ch)) {

                const prev = tokens.length
                    ? tokens[tokens.length - 1]
                    : null;

                const unaryContext =
                    !prev ||
                    prev.type === 'LPAREN' ||
                    prev.type === 'OPERATOR' ||
                    prev.type === 'UNARY_OP';

                if ((ch === '+' || ch === '-') && unaryContext) {

                    tokens.push({
                        type: 'UNARY_OP',
                        value: ch === '-' ? 'u-' : 'u+',
                        raw: ch,
                        position: i,
                        length: 1
                    });

                } else {

                    tokens.push({
                        type: 'OPERATOR',
                        value: ch,
                        raw: ch,
                        position: i,
                        length: 1
                    });
                }

                i++;
                continue;
            }

            // Invalid character
            return {
                success: false,
                tokens,
                error: {
                    message: `Invalid character "${ch}" at position ${i}.`,
                    position: i,
                    suggestion:
                        'Use letters, numbers, parentheses and valid operators.'
                }
            };
        }

        return {
            success: true,
            tokens
        };
    }

    // ---------------------------------------
    // POSTFIX / PREFIX TOKENIZER
    // ---------------------------------------

    function tokenizeSpaceDelimited(input) {

        if (typeof input !== 'string') {
            return {
                success: false,
                tokens: [],
                error: {
                    message: 'Expression must be a string.',
                    position: 0
                }
            };
        }

        const tokens = [];
        const regex = /\S+/g;
        let match;

        while ((match = regex.exec(input)) !== null) {

            const raw = match[0];
            const pos = match.index;

            // Parentheses are not allowed
            if (raw === '(' || raw === ')') {
                return {
                    success: false,
                    tokens,
                    error: {
                        message: 'Parentheses are not allowed in Prefix/Postfix notation.',
                        position: pos
                    }
                };
            }

            // Unary operators
            if (raw === 'u-' || raw === '~') {

                tokens.push({
                    type: 'UNARY_OP',
                    value: 'u-',
                    raw,
                    position: pos,
                    length: raw.length
                });

                continue;
            }

            if (raw === 'u+') {

                tokens.push({
                    type: 'UNARY_OP',
                    value: 'u+',
                    raw,
                    position: pos,
                    length: raw.length
                });

                continue;
            }

            // Binary operators
            if (raw.length === 1 && BINARY_CHARS.has(raw)) {

                tokens.push({
                    type: 'OPERATOR',
                    value: raw,
                    raw,
                    position: pos,
                    length: 1
                });

                continue;
            }

            // Numbers, including negative numbers
            if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {

                tokens.push({
                    type: 'NUMBER',
                    value: raw,
                    raw,
                    position: pos,
                    length: raw.length
                });

                continue;
            }

            // Alphabetical operands
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {

                tokens.push({
                    type: 'IDENTIFIER',
                    value: raw,
                    raw,
                    position: pos,
                    length: raw.length
                });

                continue;
            }

            return {
                success: false,
                tokens,
                error: {
                    message: `Invalid token "${raw}" at position ${pos}.`,
                    position: pos,
                    suggestion: 'Separate operands and operators with spaces.'
                }
            };
        }

        return {
            success: true,
            tokens
        };
    }

    // ---------------------------------------
    // TOKENIZER DISPATCHER
    // ---------------------------------------

    function tokenize(input, notation = 'infix') {

        const mode = String(notation || 'infix').toLowerCase();

        if (mode === 'postfix' || mode === 'prefix') {
            return tokenizeSpaceDelimited(input);
        }

        return tokenizeInfix(input);
    }

    // ---------------------------------------
    // EXPORT
    // ---------------------------------------

    const Tokenizer = {
        tokenize,
        tokenizeInfix,
        tokenizeSpaceDelimited
    };

    global.StackLab = global.StackLab || {};
    global.StackLab.Tokenizer = Tokenizer;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Tokenizer;
    }

})(typeof window !== 'undefined' ? window : globalThis);
