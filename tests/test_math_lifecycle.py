"""Tests: formulas are visible when empty, deletable, and source remains canonical.
Run: python tests/test_math_lifecycle.py
"""
from playwright.sync_api import sync_playwright
from test_browser import page_setup
import os


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('NEMADEO_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1280,'height':820})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page_setup(page)
        source=lambda:page.evaluate('NEMADEO2.source')
        load=lambda s:page.evaluate('(s)=>NEMADEO2.setDocument(s)',s)
        switch=lambda:page.locator('#toggleViewBtn').click()

        # Empty formula persists after switching views; it is not a blank invisible SVG.
        for value in ['\\[\n\n\\]', '$$\n\n$$', '\\(\\)', 'Before \\(\\) after', '\\[\r\n\r\n\\]']:
            load(value)
            assert page.locator('.nem-math').count()==1,repr(value)
            empty=page.locator('.nem-math-empty')
            assert empty.count()==1,repr(value)
            assert empty.is_visible(),repr(value)
            assert empty.bounding_box()['height']>10,repr(value)
            assert 'Empty formula' in empty.inner_text(),repr(value)
            switch()
            assert source()==value,repr(source())
            switch()
            assert page.locator('.nem-math-empty').count()==1,repr(value)
            page.locator('.nem-math-empty').click()
            assert page.locator('#mathPanel').is_visible()
            assert page.locator('#mathInput').input_value().strip()==''
            page.locator('#mathDone').click()
            assert source()==value,repr((value,source()))

        # A valid empty formula stays editable after removing content in the dialog.
        load('A\n\n\\[x^2\\]\n\nB')
        page.locator('.nem-math-block').click()
        page.locator('#mathInput').fill('')
        assert source()=='A\n\n\\[\\]\n\nB',repr(source())
        page.locator('#mathDone').click()
        assert page.locator('.nem-math-empty').count()==1
        switch();switch()
        assert page.locator('.nem-math-empty').count()==1
        assert source()=='A\n\n\\[\\]\n\nB'

        # Clicking a formula and pressing the explicit delete button removes its entire syntax.
        load('Intro\n\n\\[\nx^2\n\\]\n\nOutro')
        page.locator('.nem-math-block').click()
        page.locator('#mathDelete').click()
        page.wait_for_timeout(70)
        assert source()=='Intro\n\n\n\nOutro',repr(source())
        assert page.locator('.nem-math').count()==0
        page.locator('#editor').focus()
        page.keyboard.press('Control+z')
        page.wait_for_timeout(45)
        assert source()=='Intro\n\n\\[\nx^2\n\\]\n\nOutro',repr(source())
        assert page.locator('.nem-math').count()==1

        # Deletion after editing the formula tracks its changing source region.
        load('Text \\(x\\) stays')
        page.locator('.nem-math-inline').click()
        page.locator('#mathInput').fill(r'\frac{a}{b}')
        assert source()==r'Text \(\frac{a}{b}\) stays',repr(source())
        page.locator('#mathDelete').click()
        assert source()=='Text  stays',repr(source())
        page.locator('#editor').focus()
        page.keyboard.press('Control+z')
        page.wait_for_timeout(50)
        assert source()==r'Text \(\frac{a}{b}\) stays',repr(source())

        # Keyboard deletion on a focused formula removes a single atomic source region.
        for key in ['Delete','Backspace']:
            load('Before\n\\[x+y\\]\nAfter')
            page.locator('.nem-math-block').focus()
            page.keyboard.press(key)
            page.wait_for_timeout(45)
            assert source()=='Before\n\nAfter',(key,repr(source()))
            assert page.locator('.nem-math').count()==0

        # Backspace immediately after an end-of-document formula is an atomic delete, not delimiter corruption.
        load('\\[x^2\\]')
        page.locator('.nem-document-tail').click()
        page.keyboard.press('Backspace')
        page.wait_for_timeout(45)
        assert source()=='',repr(source())
        assert page.locator('#mathPanel').is_hidden()
        page.keyboard.press('Control+z')
        page.wait_for_timeout(50)
        assert source()=='\\[x^2\\]'

        # Created formulas, including empty ones, can be removed without entering Raw.
        load('')
        page.locator('#editor').click()
        page.locator('[data-tool="blockMath"]').click()
        page.wait_for_timeout(70)
        assert '\\[' in source() and '\\]' in source(),repr(source())
        page.locator('.nem-math-block').click()
        page.locator('#mathInput').fill('')
        page.locator('#mathDelete').click()
        assert '\\[' not in source() and '\\]' not in source(),repr(source())

        # Every visible button has a helpful tooltip (including the mini formula editor).
        missing=page.evaluate('''() => [...document.querySelectorAll('button')]
            .filter(b => !b.hasAttribute('title') || !b.title.trim())
            .map(b => b.outerHTML.slice(0,150))''')
        assert not missing,missing
        page.locator('#toggleViewBtn').click()
        page.locator('#toggleViewBtn').click()
        assert not errors,errors
        print('PASS: empty math in both modes, explicit/keyboard deletion, undo, panel region edits, tooltips')
        browser.close()

if __name__=='__main__':main()
