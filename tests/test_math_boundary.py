"""Regression tests for cursor navigation across noneditable math blocks.

Run: python tests/test_math_boundary.py
"""
from playwright.sync_api import sync_playwright
from test_browser import page_setup
import os


def editor_source(page):
    return page.evaluate('NEMADEO2.source')


def load(page, source):
    page.evaluate('(s) => NEMADEO2.setDocument(s)', source)
    page.wait_for_timeout(45)
    assert editor_source(page) == source


def caret_pos(page):
    return page.evaluate('NEMADEO2.view.selectionRegion()')


def check_tail_typing(page, source, expected):
    load(page, source)
    tail=page.locator('.nem-document-tail')
    assert tail.count()==1, 'Document ending with formula or newline must be editable'
    tail.click()
    region=caret_pos(page)
    assert region and region['start']==len(source) and region['end']==len(source), (source,region)
    page.keyboard.type('Hello')
    page.wait_for_timeout(75)
    assert editor_source(page)==expected,(repr(editor_source(page)),repr(expected))
    assert 'Hello' in page.locator('#editor').inner_text()
    # A second insertion must continue the same paragraph after rendering.
    page.keyboard.type('!')
    page.wait_for_timeout(70)
    assert editor_source(page)==expected+'!',(repr(editor_source(page)),repr(expected+'!'))
    page.keyboard.press('Control+z')
    page.wait_for_timeout(70)
    assert editor_source(page)==expected


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('NEMADEO_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1200,'height':750})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page_setup(page)
        check_tail_typing(page,'Intro\n\n\\[\nx^2\n\\]', 'Intro\n\n\\[\nx^2\n\\]\nHello')
        check_tail_typing(page,'Intro\n\n\\[\nx^2\n\\]\n', 'Intro\n\n\\[\nx^2\n\\]\nHello')
        check_tail_typing(page,'\\[x^2\\]','\\[x^2\\]\nHello')
        check_tail_typing(page,'\\[x^2\\]\r\n','\\[x^2\\]\r\nHello')
        check_tail_typing(page,'\\[x^2\\]\n\n','\\[x^2\\]\n\nHello')
        # A click on the blank line immediately after a formula is not redirected before it.
        load(page,'Intro\n\n\\[x^2\\]\n\nAfter')
        page.locator('.nem-blank').last.click()
        region=caret_pos(page)
        assert region and region['start']==len('Intro\n\n\\[x^2\\]\n'),region
        page.keyboard.type('ABCD')
        page.wait_for_timeout(70)
        assert editor_source(page)=='Intro\n\n\\[x^2\\]\nABCD\nAfter',repr(editor_source(page))
        # Closing the formula editor goes directly to the following text line.
        load(page,'Intro\n\n\\[x^2\\]\nNext')
        page.locator('.nem-math-block').click()
        page.locator('#mathDone').click()
        assert caret_pos(page)['start']==len('Intro\n\n\\[x^2\\]\n'),caret_pos(page)
        page.keyboard.type('Start: ')
        page.wait_for_timeout(100)
        assert editor_source(page)=='Intro\n\n\\[x^2\\]\nStart: Next',repr(editor_source(page))
        # Closing a trailing formula must give a cursor with which to continue.
        load(page,'Intro\n\n\\[x^2\\]')
        page.locator('.nem-math-block').click()
        page.locator('#mathDone').click()
        region=caret_pos(page)
        assert region and region['start']==len('Intro\n\n\\[x^2\\]'),region
        page.keyboard.type('After')
        page.wait_for_timeout(70)
        assert editor_source(page)=='Intro\n\n\\[x^2\\]\nAfter',repr(editor_source(page))
        # Paste into the after-formula line must not run into the closing delimiter.
        load(page,'\\[x^2\\]')
        page.locator('.nem-document-tail').click()
        page.evaluate('''() => {
            const e=new Event('paste',{bubbles:true,cancelable:true});
            Object.defineProperty(e,'clipboardData',{value:{getData:()=> 'Pasted text'}});
            document.querySelector('#editor').dispatchEvent(e);
        }''')
        page.wait_for_timeout(60)
        assert editor_source(page)=='\\[x^2\\]\nPasted text',repr(editor_source(page))
        # Inline formula navigation must land after the formula, not before it.
        for inline,expected in [
            ('\\(x^2\\)','\\(x^2\\)Z'),
            ('Before \\(x^2\\)','Before \\(x^2\\)Z'),
            ('Before \\(x^2\\) After','Before \\(x^2\\)Z After'),
        ]:
            load(page,inline)
            page.locator('.nem-math-inline').focus()
            page.keyboard.press('ArrowRight')
            assert caret_pos(page)['start']==inline.index('\\)')+2
            page.keyboard.type('Z')
            page.wait_for_timeout(40)
            assert editor_source(page)==expected,(repr(editor_source(page)),repr(expected))
        # Backspace on the phantom tail deletes the entire atomic formula,
        # never just its closing delimiter; undo restores the original source.
        load(page,'\\[x^2\\]')
        page.locator('.nem-document-tail').click()
        page.keyboard.press('Backspace')
        page.wait_for_timeout(45)
        assert editor_source(page)==''
        page.keyboard.press('Control+z')
        page.wait_for_timeout(45)
        assert editor_source(page)=='\\[x^2\\]'
        # Keyboard: move down from a focused formula (focusable tab stop).
        load(page,'\\[x^2\\]')
        page.locator('.nem-math-block').focus()
        page.keyboard.press('ArrowDown')
        assert caret_pos(page)['start']==len('\\[x^2\\]'),caret_pos(page)
        page.keyboard.type('Down')
        page.wait_for_timeout(70)
        assert editor_source(page)=='\\[x^2\\]\nDown',repr(editor_source(page))
        assert not errors,errors
        print('PASS: after-formula mouse/keyboard navigation, paste, inline math, backspace, CRLF, blank lines, formula close, undo')
        browser.close()


if __name__=='__main__':
    main()
