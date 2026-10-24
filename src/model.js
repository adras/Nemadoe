/* NEMADEO 2 – canonical source, regional transactions, and undo/redo.
   The only authoritative document representation is the source string. */
(function(global) {
    'use strict';
    class SourceDocument {
        constructor(text = '') {
            this.source = String(text);
            this.revision = 0;
            this.undoStack = [];
            this.redoStack = [];
            this.listeners = new Set();
        }
        subscribe(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
        notify(change) { for (const listener of this.listeners) listener(change); }
        load(text) {
            this.source = String(text);
            this.revision++;
            this.undoStack.length = 0;
            this.redoStack.length = 0;
            this.notify({ type: 'load', start: 0, end: this.source.length });
        }
        replace(start, end, inserted, options = {}) {
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > this.source.length)
                throw new RangeError('Invalid source region');
            const next = String(inserted);
            const old = this.source.slice(start, end);
            if (old === next) return false;
            if (options.history !== false) {
                this.undoStack.push({ start, removed: old, inserted: next });
                if (this.undoStack.length > 300) this.undoStack.shift();
                this.redoStack.length = 0;
            }
            this.source = this.source.slice(0, start) + next + this.source.slice(end);
            this.revision++;
            this.notify({ type: 'replace', start, end, inserted: next, previous: old, revision: this.revision });
            return true;
        }
        undo() {
            const action = this.undoStack.pop();
            if (!action) return null;
            this.replace(action.start, action.start + action.inserted.length, action.removed, { history: false });
            this.redoStack.push(action);
            return action.start + action.removed.length;
        }
        redo() {
            const action = this.redoStack.pop();
            if (!action) return null;
            this.replace(action.start, action.start + action.removed.length, action.inserted, { history: false });
            this.undoStack.push(action);
            return action.start + action.inserted.length;
        }
    }
    function minimalDifference(before, after) {
        let start = 0;
        while (start < before.length && start < after.length && before.charCodeAt(start) === after.charCodeAt(start)) start++;
        let left = before.length, right = after.length;
        while (left > start && right > start && before.charCodeAt(left-1) === after.charCodeAt(right-1)) { left--; right--; }
        return { start, end: left, inserted: after.slice(start, right) };
    }
    global.NEMModel = { SourceDocument, minimalDifference };
})(window);
