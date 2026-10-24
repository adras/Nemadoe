"""Offline Chromium tests. Requires `pip install playwright` and Chromium.
Run: python tests/test_browser.py
Uses set_content because Playwright navigation may be restricted in sandboxes.
"""
from pathlib import Path
import re
import os
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
JS_FILES = ('vendor/mathjax-tex-svg.js','src/model.js','src/parser.js','src/render.js','src/app.js','src/visuals.js')

def page_setup(p):
    html = (ROOT/'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<script defer src="[^"]+"></script>', '', html)
    p.set_content(html, wait_until='domcontentloaded')
    p.add_style_tag(content=(ROOT/'src/appearance.css').read_text(encoding='utf-8'))
    for name in JS_FILES:
        p.add_script_tag(content=(ROOT/name).read_text(encoding='utf-8'))
    p.wait_for_function('!!window.NEMADEO2 && !!window.MathJax?.tex2svg',timeout=15000)
    return p

def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path=os.environ.get('NEMADEO_CHROMIUM','/usr/bin/chromium'), args=['--no-sandbox'])
        p=b.new_page(viewport={'width':1440,'height':900})
        errors=[]
        p.on('pageerror', lambda e: errors.append(str(e)))
        page_setup(p)
        source=(ROOT/'examples/Mapper_Grundlagen_und_Verwendung.md').read_text(encoding='utf-8')
        begin=time.perf_counter()
        p.evaluate('(s) => NEMADEO2.setDocument(s)',source)
        render_ms=(time.perf_counter()-begin)*1000
        assert p.evaluate('NEMADEO2.source')==source,'Initial source must be unchanged'
        assert p.locator('.nem-math').count()>=35,'Math delimiters must be parsed'
        assert p.locator('pre.nem-code').count()>=20,'Fenced code must be kept out of math'
        p.locator('.nem-math').first.scroll_into_view_if_needed()
        p.wait_for_timeout(200)
        assert p.locator('mjx-container').count()>0,'Visible mathematics must render'
        print('Document:',len(source),'characters,',p.locator('[data-block-start]').count(),'blocks,',p.locator('.nem-math').count(),'math formulas')
        print('Full-document parse + structural render:',round(render_ms,1),'ms (includes IPC)')
        # Source is 100% identical, including syntax and newlines, after view switches.
        p.locator('#toggleViewBtn').click()
        assert p.locator('#rawEditor').input_value()==source
        p.locator('#toggleViewBtn').click()
        assert p.evaluate('NEMADEO2.source')==source
        # A deterministic edit in the very first heading changes only its region.
        p.evaluate('''() => {
            const leaf=document.querySelector('#editor .md-leaf');
            const r=document.createRange();r.selectNodeContents(leaf);r.collapse(false);
            const s=window.getSelection();s.removeAllRanges();s.addRange(r);
            document.getElementById('editor').focus();
        }''')
        p.keyboard.type(' NEW')
        p.wait_for_timeout(90)
        edited=p.evaluate('NEMADEO2.source')
        assert edited=='# First Identity Mapper und Permutation Mapper NEW'+source[len('# First Identity Mapper und Permutation Mapper'):],(edited[:140],source[:140])
        assert p.locator('#editor').inner_text().startswith('First Identity Mapper und Permutation Mapper NEW')
        p.keyboard.press('Control+z')
        p.wait_for_timeout(60)
        # Typing is deliberately one undo transaction per character.
        assert p.evaluate('NEMADEO2.source').startswith('# First Identity Mapper und Permutation Mapper NE')
        p.evaluate('NEMADEO2.setDocument("Hello world")')
        p.wait_for_timeout(50)
        p.evaluate('''() => {
            const el=document.querySelector('#editor .md-leaf'),r=document.createRange();
            r.setStart(el.firstChild,6);r.setEnd(el.firstChild,11);
            const s=window.getSelection();s.removeAllRanges();s.addRange(r);
        }''')
        p.locator('[data-tool="bold"]').click()
        p.wait_for_timeout(50)
        assert p.evaluate('NEMADEO2.source')=='Hello **world**',p.evaluate('NEMADEO2.source')
        assert p.locator('#editor strong').count()==1
        # Math editing only touches math body, retains other source bytes.
        formula='Intro\n\n\\[\n\\frac{x}{y}\n\\]\n\nOutro\n'
        p.evaluate('(s) => NEMADEO2.setDocument(s)',formula)
        p.locator('.nem-math').first.click()
        assert p.locator('#mathPanel').is_visible()
        p.locator('#mathInput').fill('\n\\frac{x+1}{y}\n')
        expected=formula.replace('\\frac{x}{y}','\\frac{x+1}{y}')
        assert p.evaluate('NEMADEO2.source')==expected
        p.locator('#mathDone').click()
        p.wait_for_timeout(90)
        assert p.locator('#editor mjx-container').count()==1
        assert p.evaluate('NEMADEO2.source')==expected
        # Clipboard and script injection: text must not become executable markup.
        payload='<script>window.NEMADEO_PWNED=true</script>\n\n\\[x^2\\]'
        p.evaluate('(s) => NEMADEO2.setDocument(s)',payload)
        assert not p.evaluate('!!window.NEMADEO_PWNED')
        assert p.evaluate('NEMADEO2.source')==payload
        # Filesystem-neutral export: blob is sourced from the document model.
        with p.expect_download() as download_info:
            p.locator('#exportBtn').click()
        download=download_info.value
        assert download.suggested_filename.endswith('.md')
        assert Path(download.path()).read_bytes()==payload.encode('utf-8')
        # FPS widget removed; all palettes retained.
        assert p.locator('#fps-overlay,#fpsBtn').count()==0
        assert p.locator('#themeSelect option').count()==13
        p.locator('#themeSelect').select_option('6')
        assert p.locator('#themeSelect').input_value()=='6'  # localStorage inaccessible in about:blank test harness
        # Mobile toolbar remains usable.
        p.set_viewport_size({'width':375,'height':800})
        bb=p.locator('#exportBtn').bounding_box()
        assert bb and bb['x']>=0 and bb['x']+bb['width']<=376,bb
        assert not errors, errors
        print('PASS: source preservation, math SVG, regional WYSIWYG edits, math editing, undo, export, safety, themes, mobile')
        b.close()

if __name__=='__main__': main()
