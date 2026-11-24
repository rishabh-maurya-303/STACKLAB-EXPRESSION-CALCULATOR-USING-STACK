# StackLab — Advanced Expression Calculator

An academic **Data Structures and Algorithms (DSA)** web application demonstrating the practical power of the **Stack (LIFO)** Abstract Data Type across expression tokenization, six-way notation conversion, Postfix/Prefix evaluation, syntax validation, interactive step-by-step trace visualization, algorithm telemetry, and Dual-Stack Undo/Redo.

Built strictly with **HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap 5.3, and Bootstrap Icons** — zero frontend frameworks, zero backend, zero `eval()`, and zero third-party parsing libraries.

---

## Project Architecture

```text
stacklab/
├── index.html                  # Responsive Bootstrap 5.3 nine-module SPA + About Project
├── css/
│   ├── style.css               # Dark/Light theme tokens, typography & dashboard shell
│   ├── components.css          # Animated vertical Stack tower, keypad, telemetry bars
│   └── responsive.css          # Desktop, laptop, tablet & mobile breakpoints
├── js/
│   ├── stack.js                # Encapsulated custom Stack ADT (LIFO, capacity, stats)
│   ├── precedence.js           # Operator precedence, associativity & unary rules
│   ├── tokenizer.js            # Multi-digit, decimal & context-aware unary lexer
│   ├── validator.js            # Stack bracket matcher + token-state & arity validators
│   ├── converter.js            # All 6 stack-based notation conversion algorithms
│   ├── evaluator.js            # Independent Postfix (L->R) & Prefix (R->L) evaluators
│   ├── visualizer.js           # Interactive real-trace animated Stack Visualizer
│   ├── playground.js           # Interactive bounded-capacity Stack Playground
│   ├── analyzer.js             # Real execution metrics + theoretical Big-O table
│   ├── undoRedo.js             # Two-Stack Undo/Redo state manager
│   ├── storage.js              # Safe localStorage persistence, CSV/TXT export & recovery
│   └── app.js                  # Main UI orchestrator integrating all modules
├── tests/
│   └── verify-algorithms.js    # Automated Node.js verification suite
└── README.md
```

---

## Local Setup Instructions

1. **Direct Browser Launch (Zero Setup):**
   - Extract `stacklab.zip` and double-click `stacklab/index.html` to open directly in Chrome, Edge, Firefox, or Safari.
2. **VS Code Live Server (Recommended for Development):**
   - Open the `stacklab/` folder in VS Code.
   - Right-click `index.html` and select **Open with Live Server**.
3. **Run Automated Algorithm Test Suite (Optional, requires Node.js 16+):**
   ```bash
   cd stacklab
   node tests/verify-algorithms.js
   ```

---

## Nine Core Application Modules

1. **Dashboard**: Live activity metrics (`localStorage`-backed, zero fake counters), quick-action navigation cards, recent activity feed, and algorithm summary.
2. **Expression Calculator**: Interactive keypad + keyboard input, integrated Undo/Redo toolbar, Infix validation, Postfix & Prefix display, numerical result, step-by-step operations breakdown, copy result, and one-click Visualize handoff.
3. **Notation Converter**: Supports all six conversions (`Infix <-> Postfix`, `Infix <-> Prefix`, `Postfix <-> Prefix`) with source validation and step-by-step Stack traces.
4. **Stack Visualizer**: Replays **authentic algorithm traces** across 5 modes (*Infix-to-Postfix*, *Infix-to-Prefix*, *Postfix Evaluation*, *Prefix Evaluation*, *Bracket Matching*) with Prev/Next/Play/Pause/Restart, speed control, and click-to-jump operation log.
5. **Stack Playground**: Interactive custom `Stack` instance with Push, Pop, Peek, Clear, selectable max capacity, Overflow/Underflow detection, and operation log.
6. **Algorithm Analysis**: Contrasts real recorded Push/Pop/Peek counts and max stack depth against theoretical Big-O asymptotic bounds.
7. **Expression Validation**: Multi-stage validator combining a custom Stack bracket matcher, lexical scanner, token-state/arity grammar verifier, and division/modulus-by-zero checks with exact character position pointers and suggested fixes (never silently mutating input).
8. **Calculation History**: Persistent `localStorage` ledger with search filter, Reuse in Calculator, Copy, Delete, Clear All, and CSV/TXT export.
9. **Undo / Redo**: Driven by two independent custom `Stack` instances (`undoStack` and `redoStack`) synchronized with the Expression Calculator, complete with live dual-stack visual inspection.
- **About Project**: Complete academic documentation with editable local placeholders for student, roll number, college, and faculty details.

---

## Core DSA Algorithms & Mathematical Guarantees

- **Operator Precedence & Associativity**:
  - Level 4: `^` (Right-Associative — `2^3^2 = 2^(3^2) = 512`)
  - Level 3: `u-`, `u+` (Prefix Unary — binds looser than `^` so `-2^2 = -(2^2) = -4`, while `(-2)^2 = 4`; never pops preceding operators so `2^-3` and `5*-2` work accurately)
  - Level 2: `*`, `/`, `%` (Left-Associative)
  - Level 1: `+`, `-` (Left-Associative)
- **Direct Two-Stack Infix-to-Prefix**: Uses an Operator Stack and an Expression Stack scanning left-to-right, avoiding the broken naive string-reversal shortcut and preserving right-associative exponentiation and unary precedence.
- **Independent Evaluators**: Postfix scans left-to-right (popping `right`, then `left`); Prefix scans right-to-left (popping `left`, then `right`).

---

## Complexity Analysis

| Algorithm | Time Complexity | Auxiliary Space Complexity |
| :--- | :---: | :---: |
| Infix to Postfix | $O(n)$ | $O(n)$ |
| Infix to Prefix | $O(n)$ | $O(n)$ |
| Postfix Evaluation | $O(n)$ | $O(n)$ |
| Prefix Evaluation | $O(n)$ | $O(n)$ |
| Bracket Matching | $O(n)$ | $O(n)$ |
| Stack Push | $O(1)$ | $O(1)$ |
| Stack Pop | $O(1)$ | $O(1)$ |
| Stack Peek | $O(1)$ | $O(1)$ |
