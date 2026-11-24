/**
 * StackLab — Stack-Based Undo / Redo Manager
 * Uses TWO independent custom Stack instances:
 *   - undoStack : stores previous expression states (LIFO)
 *   - redoStack : stores undone expression states (LIFO)
 * Every meaningful edit pushes the previous state onto undoStack and clears redoStack.
 */
(function (global) {
  'use strict';

  function getStackClass() {
    if (typeof module !== 'undefined' && module.exports && !global.StackLab?.Stack) {
      return require('./stack').Stack;
    }
    return global.StackLab.Stack;
  }

  class UndoRedoManager {
    constructor(initialState = '', capacity = 100) {
      const Stack = getStackClass();
      this.undoStack = new Stack(capacity);
      this.redoStack = new Stack(capacity);
      this.currentState = String(initialState);
      this.capacity = capacity;
    }

    /**
     * Commit a new expression state.
     * Ignores no-op edits where newState === currentState.
     * Clears redoStack whenever a new branch of edits begins.
     */
    setState(newState) {
      const normalized = String(newState ?? '');
      if (normalized === this.currentState) {
        return { changed: false, currentState: this.currentState };
      }

      // If undoStack reached capacity, rebuild preserving newest entries via temporary Stack (LIFO safe)
      if (this.undoStack.isFull()) {
        const Stack = getStackClass();
        const temp = new Stack(this.capacity);
        while (!this.undoStack.isEmpty()) {
          temp.push(this.undoStack.pop());
        }
        // Discard oldest state at top of temp
        if (!temp.isEmpty()) temp.pop();
        while (!temp.isEmpty()) {
          this.undoStack.push(temp.pop());
        }
      }

      this.undoStack.push(this.currentState);
      this.currentState = normalized;
      this.redoStack.clear();

      return { changed: true, currentState: this.currentState };
    }

    canUndo() {
      return !this.undoStack.isEmpty();
    }

    canRedo() {
      return !this.redoStack.isEmpty();
    }

    /**
     * Pop the previous state from undoStack and push currentState onto redoStack.
     */
    undo() {
      if (!this.canUndo()) {
        return {
          success: false,
          error: 'Nothing to undo: Undo Stack is empty.',
          currentState: this.currentState
        };
      }
      this.redoStack.push(this.currentState);
      this.currentState = this.undoStack.pop();
      return {
        success: true,
        currentState: this.currentState
      };
    }

    /**
     * Pop the most recently undone state from redoStack and push currentState onto undoStack.
     */
    redo() {
      if (!this.canRedo()) {
        return {
          success: false,
          error: 'Nothing to redo: Redo Stack is empty.',
          currentState: this.currentState
        };
      }
      this.undoStack.push(this.currentState);
      this.currentState = this.redoStack.pop();
      return {
        success: true,
        currentState: this.currentState
      };
    }

    clearHistory() {
      this.undoStack.clear();
      this.redoStack.clear();
      return { currentState: this.currentState };
    }

    getSnapshot() {
      return {
        currentState: this.currentState,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.size(),
        redoCount: this.redoStack.size(),
        undoItems: this.undoStack.getItems(),
        redoItems: this.redoStack.getItems()
      };
    }
  }

  global.StackLab = global.StackLab || {};
  global.StackLab.UndoRedoManager = UndoRedoManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UndoRedoManager };
  }
})(typeof window !== 'undefined' ? window : globalThis);
