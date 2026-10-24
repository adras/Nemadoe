# NEMADEO 2 — Behavior and supported syntax

## Goal

A lightweight, source-first, visually polished editor for Markdown documents containing **mathematical LaTeX commonly written by ChatGPT, Gemini and similar assistants**. It is not a general LaTeX document processor.

## Supported source editing

- Direct Raw editing; preservation of imported source without reserialization.
- Formatted editing of text runs, headings, lists, links' visible text, bold/italic/strike text, inline code, fenced code, and table cell text where region mapping permits.
- Region-based toolbar actions: bold, italic, strike, headings, lists, code, fences, display/inline mathematics, fractions, roots, powers, indices, sums, and matrices.
- Undo/redo of source transactions.
- Click on formula → edit its LaTeX region, see an updating formula preview, use mathematical toolbar templates → close and continue editing formatted Markdown. Delete the whole formula through the mini-editor **Delete formula** command, or focus the formula and press Delete/Backspace. Undo restores the source span.
- Export/download exactly the current source string, without converting any DOM/HTML/SVG to Markdown.
- Autosave to a new `nemadeo2_source_v1` browser key; read old Markdown `neon_writer_markdown_v4` only on first load. Legacy v1 data is not modified.
- Import UTF-8 Markdown; preserve the imported string, including original CRLF line endings in the canonical model. (HTML textarea display normalizes line endings, so the edit layer explicitly maps visible offsets back to the source.)

## Markdown syntax interpreted for formatted display

ATX headings H1–H6; paragraphs and explicit blank lines; bold (`**`, `__`); italic (`*`, `_`); strike (`~~`); inline code; fenced code (backticks or tildes, including unclosed); simple ordered/unordered list lines; simple blockquotes; horizontal rules; links with safe URL schemes; tables with a delimiter row.

**Not complete CommonMark:** nested list indentation/continuations, complex inline precedence, footnotes, task lists, reference-style links, embedded HTML, and some table variants have limited or literal treatment. Unknown content is preserved byte-for-byte, not silently discarded. Raw editing remains available for every construct.

## LaTeX

Delimiters: `\(...\)`, `\[...\]`, `$...$`, `$$...$$` outside fenced code blocks. Mathematical expressions are rendered locally by MathJax SVG. Tested families include fractions, indices, powers, roots, summation, boxed formulas, align, matrices, Greek letters, set symbols, floor/ceiling delimiters, and `\text{}`.

The mathematical syntax graph recognizes fractions (`numerator` and `denominator`), roots, groups, superscripts, subscripts, and commands. The visual math view itself currently selects **whole formulas**, not individual rendered glyph regions. Within the compact formula editor, the source is directly editable and the toolbar inserts structured templates.

Empty delimited display formulas (`\[\]`, `$$ $$` with whitespace) and inline `\(\)` remain visible as clickable **Empty formula** placeholders in Formatted mode, including across Raw/Formatted toggles. The placeholders are purely visual and never serialized. Unknown commands and incomplete formulas must never be removed or modified by the renderer. Some invalid commands may render as red error text depending on MathJax configuration.

## Document states

- **Raw**: original Markdown/LaTeX, directly editable; all toolbar operations still translate to source transactions.
- **Formatted**: source-derived Markdown and mathematical SVG; normal text editing goes through regional source transactions, and math editing uses a compact inline source/preview panel.
- `localStorage` is a convenience recovery snapshot, **not** equivalent to saving the `.md` file to disk. Export downloads the currently authoritative Markdown string.

## Known limitations before a production-quality release

1. Full nested CommonMark parsing and complete rich selection semantics across arbitrarily nested constructs.
2. True 2D mathematical caret navigation / glyph-level hit testing in SVG. (Math is editable through its source/preview panel now.)
3. IME input/composition behavior needs additional cross-browser manual coverage.
4. Undo stacks presently store individual source operations; adjacent keystrokes are not yet grouped into words.
5. Responsive layout and layout fidelity need cross-browser visual approval in Firefox/Chrome at multiple font scaling levels.
6. Initial load for a long document is measurably heavier than the v1 serializer in some Chromium runs, although subsequent source transactions reuse unchanged DOM blocks. This is a release gate, not a solved issue.
7. File writes remain explicit `.md` downloads; no OS-level in-place save without a supported filesystem API.

No unsupported behavior is silently declared complete.
