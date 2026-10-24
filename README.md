# NEMADEO 2

**A source-first neon Markdown + math editor.**

This is a **working NEMADEO 2 development build**, not a claim that the full editor is production-complete. The visual shell is inherited from NEMADEO 1; the editing model is replaced by a source-indexed document and regional transactions. Locally bundled MathJax draws mathematical formulas as SVG, including the equations from the supplied Mapper research document.

## Run

Unzip the project, preserving the folder structure, and open **`index.html`** in a current browser. There is no build step, npm install, network dependency, or server dependency for the **editor**. (Hosting with a simple static server is also fine.)

The separate `weblaunch/` waitlist backend is carried over from v1 without new changes; it is not needed for the editor.

## Use

- Click **Import .md** and select a Markdown research document, e.g. `examples/Mapper_Grundlagen_und_Verwendung.md`.
- In **Formatted** mode edit normal text directly. Use the B/I/Hx/etc. and math toolbars. The changed source region is the only persisted edit.
- **Click a rendered equation** to change its LaTeX (with immediate SVG preview and mathematical templates), then Done.
- Click **Raw** to edit Markdown and LaTeX together as ordinary source text.
- **Export .md** downloads the exact canonical source. Your browser's autosave is only a recovery copy and does not overwrite the imported file.
- `Ctrl+S` exports. `Ctrl+B` / `Ctrl+I` apply formatting. `Ctrl+Z` / `Ctrl+Y` undo/redo.

## Architecture, contract and tests

- [ARCHITECTURE.md](ARCHITECTURE.md): single-source principle, CST region graph, source operations, rendering.
- [SPECIFICATION.md](SPECIFICATION.md): currently supported Markdown and mathematical LaTeX; explicitly known limits.
- [TESTS.md](TESTS.md): two real browser regression suites and measured performance observations.
- `src/model.js`, `src/parser.js`, `src/render.js`, `src/app.js` are individually replaceable components.
- `src/visuals.js` and the original portion of `src/appearance.css` preserve the 12-theme neon plasma appearance.
- `legacy/v1-index.html`: original comparator for visual and latency regression testing.

## Licensing

Project code is MIT as in `LICENSE`. The included MathJax library has its own copyright/license in `vendor/LICENSE.MathJax.txt`.

## Current release gate

This revision passes the included automated tests, but **is not yet guaranteed to meet the strict no-performance-regression and no-visual-regression constraints** on every machine/browser. Also, 2D glyph-level mathematical hit testing is not yet supported: click a formula to edit its LaTeX region in a compact source/preview panel. These are explicitly tracked in `SPECIFICATION.md`.
