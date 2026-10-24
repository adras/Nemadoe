"""NEMADEO browser regression checks: pip install playwright; playwright install chromium.

Run from the repository root: python tests/test_frontend.py
Optional: NEMADEO_CHROMIUM=/path/to/chromium python tests/test_frontend.py
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = (Path(__file__).resolve().parents[1] / 'index.html').read_text(encoding='utf-8')
CASES = [
    'First\n\n\n\nSecond',
    '- **Strong** here\n- Plain',
    '```\n  a = 1\n    b = 2\n```',
    '```\nline 1\n\n\nline4\n```',
    'A  \nB',
    '1. **Bold** item\n2. `code` item',
]


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            executable_path=os.environ.get('NEMADEO_CHROMIUM') or None,
            args=['--no-sandbox'],
        )
        page = browser.new_page(viewport={'width': 1366, 'height': 850})
        failures = []
        page.on('pageerror', lambda e: failures.append(str(e)))
        page.set_content(HTML, wait_until='domcontentloaded')
        for source in CASES:
            result = page.evaluate('(value) => {setDocument(value); return editorToMarkdown();}', source)
            assert result == source, (source, result)

        # Unclosed code fences must preserve actual text.
        html = page.evaluate('(value) => {setDocument(value); return editor.innerHTML;}', '```\nunfinished')
        assert 'unfinished' in html
        assert page.evaluate('getCurrentMarkdown()') == '```\nunfinished'

        # <br> is a hard break, not a disappearance.
        converted = page.evaluate('() => {editor.innerHTML = "<div>A<br>B</div>"; return editorToMarkdown();}')
        assert converted == 'A  \nB', converted
        page.evaluate('setDocument("Original")')
        page.click('#toggleViewBtn')
        page.locator('#rawEditor').fill('Five words live in raw')
        assert page.locator('#wc').inner_text() == '5'
        assert page.evaluate('getCurrentMarkdown()') == 'Five words live in raw'
        assert page.locator('[data-rich-tool]:disabled').count() >= 10

        # FileReader must replace the raw textarea as well as formatted DOM.
        page.locator('#importInput').set_input_files({
            'name': 'fresh.md',
            'mimeType': 'text/markdown',
            'buffer': b'# NEW FILE\n\n- **Strong**',
        })
        page.wait_for_function('document.getElementById("rawEditor").value.startsWith("# NEW FILE")')
        assert page.locator('#rawEditor').input_value() == '# NEW FILE\n\n- **Strong**'
        page.click('#toggleViewBtn')
        assert 'NEW FILE' in page.locator('#editor').inner_text()
        assert page.evaluate('getCurrentMarkdown()') == '# NEW FILE\n\n- **Strong**'

        # Formatting changes must update saved Markdown (not just WYSIWYG HTML).
        page.locator('#editor').evaluate('''element => {
            element.innerHTML = '<div>Hello</div><div>world</div>';
            element.dispatchEvent(new Event('input', {bubbles: true}));
        }''')
        page.wait_for_timeout(350)
        assert page.evaluate('getCurrentMarkdown()') == 'Hello\nworld'
        assert page.locator('#wc').inner_text() == '2'

        # Toolbar must remain visible at phone viewport size.
        page.set_viewport_size({'width': 375, 'height': 800})
        bounds = page.get_by_role('button', name='Export .md').bounding_box()
        assert bounds is not None and bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= 375, bounds
        assert page.locator('#fps-overlay, #fpsBtn').count() == 0
        assert not failures, failures
        print('PASS: Markdown roundtrips, raw/import, counters, mobile toolbar, no FPS display')
        browser.close()


if __name__ == '__main__':
    main()
