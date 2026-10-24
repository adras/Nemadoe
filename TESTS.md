# NEMADEO 2 — Test contract

## Run

```bash
python tests/test_browser.py
python tests/test_boundaries.py
python tests/test_math_boundary.py
python tests/test_math_lifecycle.py
```

Requirements: Python 3, Playwright (`pip install playwright`), Chromium, MathJax bundle already included. These tests intentionally inject the project scripts into a headless browser document, so the browser's sandbox can run them even when direct `file://` or `localhost` navigation is blocked.

## Editing after math blocks

The view provides a source-indexed but **non-serialized** caret line after a
terminal display formula, and exposes the last empty line of newline-terminated
documents. Formatted-editor typing, paste, toolbar insertion, navigation after
closing the formula panel, undo, CRLF, and inline-math boundaries are regression
tested in `tests/test_math_boundary.py`.

Backspace at the immediately following formula boundary now deletes the complete atomic formula rather than its closing delimiter; the previous behavior opened the formula editor. Undo restores it.

This does not add HTML, placeholder characters or formatting tokens to Markdown:
only actual user keystrokes create new source content.

## Current automatic checks

- Real 45,523-character Markdown research document (`examples/Mapper_Grundlagen_und_Verwendung.md`), including 45 block math formulas and many fenced code snippets.
- Parse + rendered view and no mutation of the original source.
- Raw/Formatted view transitions and unchanged source preservation.
- WYSIWYG text insertion, toolbar selection formatting and undo.
- Math formula click → LaTeX edit → close → SVG redraw; change limited to the formula's source region.
- Raw empty-document typing; CRLF preservation during an edit in a textarea that displays LF.
- Code fences suppress math syntax parsing.
- Markdown table display and bold content inside table cells.
- Fractions have distinct `numerator` and `denominator` CST nodes.
- Seven representative families of LLM-style mathematical LaTeX render locally to SVG.
- Embedded HTML injection is not run; raw source is preserved.
- Actual `.md` download bytes match source bytes.
- Deleting whole display and inline math formulas through the panel or keyboard, undo/redo, and source offsets after editing LaTeX.
- Empty formulas remain visibly selectable after Raw/Formatted toggles; no source mutation.
- All toolbar and formula mini-editor buttons have nonempty tooltips.
- Autosave/source keys (using a deterministic in-memory localStorage test double).
- No FPS indicator; 12 original/new neon color palettes; narrow-screen export button reachable.

## Performance reference

Observations on this test host (headless Chromium, changing run-to-run):

- NEMADEO v1: old `setDocument()` with the Mapper example around **79 ms**, though this path does not typeset formulas.
- NEMADEO 2: first structural parse + rebuild with the same long document roughly **80–190 ms** (depending on run); formula typesetting is viewport-driven.
- NEMADEO 2: repeated small edits plus regional render about **10–30 ms** per edit in initial probes; subsequent browser frames may be faster or slower on different hardware.

These figures are **not** proof of a performance win. For the quality gate, capture actual user input latency, repeated keystrokes, long-document scrolling and visual screenshot baselines on the intended Windows/Firefox hardware. Do not claim completion of the no-performance-regression constraint until those measurements pass.

## Visual reference

`legacy/v1-index.html` is retained as the authoritative NEMADEO 1 visual comparator. Do not modify the plasma shader/drawing, dynamic palette or original brightness without an explicit visual regression comparison.
