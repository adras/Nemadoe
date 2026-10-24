# NEMADEO 2 — After-formula cursor fix

## Reproduction before this fix

1. Open a Markdown document ending in `\[ ... \]`.
2. In Formatted mode, try to place the cursor **below** the displayed formula.
3. There was no editable position after the noneditable formula. A click below it could move the cursor to the text **before** the formula.

There was a related boundary problem when a blank line followed a formula, and after inline math.

## Behavior now

- A formula at end of the document always exposes an editable line **after** it; clicking and typing inserts text after the formula in the original Markdown string.
- If the original source has no trailing newline, the first insertion on this virtual line adds the necessary source newline.
- If the original source already has a line break, no additional line break is silently inserted.
- Existing blank lines are editable and maintain a stable source-position mapping through re-rendering.
- Closing the math editor positions the cursor **after** the equation (in the following line when present).
- Right/Down from a focused formula moves to the appropriate source position.
- Inline math has an invisible source-indexed caret landing point after the rendered element.
- Backspace on the virtual end-of-formula caret removes the entire formula as one atomic source transaction (and Undo restores it). This supersedes the original cursor-fix behavior of opening the formula editor; see `FIX_FORMULA_LIFECYCLE.md`.
- Paste and toolbar insertions after an EOF formula honor the same line-separation rule.

None of the virtual caret elements are written to the source string or exported Markdown. The plasma/theme code is unchanged.

## Tests

```sh
python tests/test_math_boundary.py
python tests/test_browser.py
python tests/test_boundaries.py
```

This fix is scoped to the cursor and insertion-position defects. It does not claim to resolve all possible selection/navigation edge cases in a general-purpose rich-text editor.
