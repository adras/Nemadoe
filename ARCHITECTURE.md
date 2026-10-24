# NEMADEO 2 — Architecture contract

## Canonical invariant

**Exactly one source:** a Markdown string, optionally containing mathematical LaTeX. The current in-memory `SourceDocument.source` is authoritative while editing; exports and local snapshots are copies of that string. No HTML, SVG, textarea, or syntax tree is an alternative document format.

```
                         SourceDocument.source
                        (one canonical string)
                                |
                    lossless source-region parse
                                v
                     Document/CST region graph
                          /             \
                     raw view        formatted view
                          \             /
                     source transactions
                                |
                         SourceDocument
                                |
                        snapshot / export
```

## Components

- `src/model.js`: `SourceDocument` is the only mutable source. `replace(start,end,text)` is a regional transaction with bounds validation. Undo and redo use inverse transactions. Offsets are **UTF-16** indices, matching browser selections; they are not Unicode code point indexes or disk byte positions.
- `src/parser.js`: **source-indexed concrete region graph**, with complete source ranges for each block and inline construct. Specialized `parseMath()` supplies regions for mathematical groups, fractions, numerator, denominator, roots, subscripts, and superscripts. The syntax graph is recomputable and is never serialized back to Markdown.
- `src/render.js`: builds the formatted projection. Unchanged blocks are reused. Their descendants retain source offsets with a lazily accumulated block displacement. Visible math is rendered as SVG on demand and is cached. DOM markup is never exported.
- `src/app.js`: user inputs and toolbar actions become transactions on canonical source. The Raw textarea is an editor of the same string, not another document. A temporary equation UI edits only the formula's source region; its preview has no authority.
- `src/visuals.js`: original NEMADEO plasma/theme renderer, kept isolated from document processing.
- `src/appearance.css`: original appearance plus structural editor and mathematical CSS.
- `vendor/mathjax-tex-svg.js`: locally bundled MathJax renderer, with its own license in `vendor/LICENSE.MathJax.txt`.

## Non-negotiable rules

1. The only operation that changes document content is a source transaction (`load()` for a new file, `replace()` for an edit, or history inversion).
2. A rendering operation changes no source bytes.
3. An unchanged source region is never needlessly reformatted, including unknown syntax, whitespace, mixed delimiters, and line endings.
4. An unparseable formula is still preserved in the source and remains editable.
5. Browser native `contenteditable` mutations are intercepted and converted to source operations; there is **no HTML→Markdown serializer**.
6. When a user types in an equation, the LaTeX source is updated directly and the preview is derived from it.
7. The plasma algorithm, color transitions, and high-contrast neon presentation are intentionally decoupled from typing and AST updates.
8. New features must add tests proving byte-level source preservation and regional editing.

## Large-file behavior

The parser currently reparses the full source when a change is committed. Rendering, however, replaces only changed block nodes and reuses the unchanged prefix/suffix. Lazy block offset shifts avoid touching every leaf after an insertion. MathJax rendering is viewport-driven by `IntersectionObserver`. Input is separated from repaint using an animation-frame queue. This is **not** yet a fully incremental parser.

## Design boundaries

`MathJax` is a renderer, not a freeform two-dimensional WYSIWYG equation model. Clicking a rendered equation opens the compact source/preview equation editor with structural template buttons. The mathematical CST gives us regional semantics for future direct numerator/denominator hit-testing, but pixel-to-subexpression selection is **not implemented** and must not be claimed as working.

The parser implements the explicitly listed supported subset in `SPECIFICATION.md`. Raw mode deliberately remains the escape hatch for unfamiliar Markdown/LaTeX.
