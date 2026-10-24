# NEMADEO 2 — Formula lifecycle and tooltip fix

This release fixes the three reports that followed the after-formula cursor fix.

## 1. Formulas can be deleted in Formatted mode

- Open a rendered formula and click **Delete formula** in the mini-editor.
- Or focus a formula using the keyboard (Tab), then press **Delete** or **Backspace**.
- At a collapsed caret immediately after a display formula, Backspace removes the whole atomic formula instead of one closing delimiter. Undo/Redo restores/removes it.
- All paths perform one `SourceDocument.replace(start, end, '')` transaction on the canonical Markdown string. Generated MathJax HTML is never serialized or modified as document state.
- Deliberately retain existing surrounding Markdown whitespace; deleting a formula does **not** automatically normalize adjacent blank lines, since that would alter unrelated source.

## 2. Tooltips

All visible toolbar and formula-panel buttons have native tooltips. The mini-editor also exposes labels on icon buttons, including the new deletion command.

## 3. Empty formula preservation

- `\(\)` is recognized as an editable empty inline math node.
- Whitespace-only display formulas such as `\[\n\n\]` or `$$\n\n$$` render a *visible* placeholder instead of invisible MathJax output.
- Placeholder regions survive any number of Raw/Formatted switches, with their delimiter syntax, whitespace and line endings intact.
- An empty formula can be clicked to edit, filled, or deleted like a nonempty formula.
- The LaTeX mini-editor shows a helpful placeholder when the expression becomes empty, instead of an invisible preview.

## Regression tests

```
python tests/test_browser.py
python tests/test_boundaries.py
python tests/test_math_boundary.py
python tests/test_math_lifecycle.py
```

The plasma, theme selection, drawing geometry for nonempty formulas and all pre-existing document model abstractions are unchanged.
