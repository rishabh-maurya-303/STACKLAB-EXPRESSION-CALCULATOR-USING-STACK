/**
 * StackLab — Algorithm Analysis Module
 * Records authentic runtime Stack operation counts from actual algorithm executions
 * and clearly contrasts empirical counts with theoretical Big-O complexity.
 */
(function (global) {
  'use strict';

  const COMPLEXITY_TABLE = Object.freeze([
    { algorithm: 'Infix to Postfix',   time: 'O(n)', space: 'O(n)', notes: 'Each token is pushed and popped from the operator stack at most once.' },
    { algorithm: 'Infix to Prefix',    time: 'O(n)', space: 'O(n)', notes: 'Two-stack left-to-right scan processes each token in linear stack steps.' },
    { algorithm: 'Postfix Evaluation', time: 'O(n)', space: 'O(n)', notes: 'Single left-to-right scan; operands pushed and combined in O(1) per operator.' },
    { algorithm: 'Prefix Evaluation',  time: 'O(n)', space: 'O(n)', notes: 'Single right-to-left scan; operands pushed and combined in O(1) per operator.' },
    { algorithm: 'Bracket Matching',   time: 'O(n)', space: 'O(n)', notes: 'Worst-case O(n) space when all opening brackets precede closing brackets.' },
    { algorithm: 'Stack Push',         time: 'O(1)', space: 'O(1)', notes: 'Constant-time insertion at top of stack.' },
    { algorithm: 'Stack Pop',          time: 'O(1)', space: 'O(1)', notes: 'Constant-time removal from top of stack.' },
    { algorithm: 'Stack Peek',         time: 'O(1)', space: 'O(1)', notes: 'Constant-time inspection of top element.' }
  ]);

  function lookupComplexity(algorithmName) {
    const found = COMPLEXITY_TABLE.find(
      (row) => row.algorithm.toLowerCase() === String(algorithmName || '').toLowerCase()
    );
    if (found) {
      return { time: found.time, space: found.space, notes: found.notes };
    }
    return { time: 'O(n)', space: 'O(n)', notes: 'Linear single-pass stack algorithm over n tokens.' };
  }

  class AlgorithmAnalyzer {
    constructor() {
      this.runs = [];
      this.maxStoredRuns = 30;
    }

    /**
     * Record a real algorithm execution report.
     * Never fabricates metrics; uses exact counters emitted by the custom Stack class.
     */
    recordRun({ algorithm, expression, tokensProcessed, stats }) {
      const safeStats = stats || { pushes: 0, pops: 0, peeks: 0, maxSize: 0 };
      const pushes = Number(safeStats.pushes) || 0;
      const pops = Number(safeStats.pops) || 0;
      const peeks = Number(safeStats.peeks) || 0;
      const maxStackSize = Number(safeStats.maxSize) || 0;
      const totalOperations = pushes + pops + peeks;
      const complexity = lookupComplexity(algorithm);

      const report = {
        id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        algorithm: algorithm || 'Stack Algorithm',
        expression: String(expression || ''),
        tokensProcessed: Number(tokensProcessed) || 0,
        pushes,
        pops,
        peeks,
        maxStackSize,
        totalOperations,
        timeComplexity: complexity.time,
        spaceComplexity: complexity.space,
        complexityNote: complexity.notes
      };

      this.runs.unshift(report);
      if (this.runs.length > this.maxStoredRuns) {
        this.runs.length = this.maxStoredRuns;
      }
      return report;
    }

    getLatestRun() {
      return this.runs.length > 0 ? this.runs[0] : null;
    }

    getAllRuns() {
      return [...this.runs];
    }

    getRunById(id) {
      return this.runs.find((r) => r.id === id) || null;
    }

    clearRuns() {
      this.runs = [];
    }

    getComplexityTable() {
      return COMPLEXITY_TABLE;
    }
  }

  global.StackLab = global.StackLab || {};
  global.StackLab.AlgorithmAnalyzer = AlgorithmAnalyzer;
  global.StackLab.COMPLEXITY_TABLE = COMPLEXITY_TABLE;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AlgorithmAnalyzer, COMPLEXITY_TABLE };
  }
})(typeof window !== 'undefined' ? window : globalThis);
