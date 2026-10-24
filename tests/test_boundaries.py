"""Second offline browser suite: source preservation, malformed input, boundaries."""
from pathlib import Path
from test_browser import ROOT, JS_FILES
from playwright.sync_api import sync_playwright
import re

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    p=b.new_page(viewport={'width':1366,'height':850})
    errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    html=re.sub(r'<script defer src="[^"]+"></script>','',(ROOT/'index.html').read_text())
    p.set_content(html)
    p.evaluate('''() => {
      const entries=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem(k){return entries.has(k)?entries.get(k):null},
        setItem(k,v){entries.set(k,String(v))},removeItem(k){entries.delete(k)}
      }});
    }''')
    p.add_style_tag(content=(ROOT/'src/appearance.css').read_text())
    for f in JS_FILES:p.add_script_tag(content=(ROOT/f).read_text())
    p.wait_for_function('typeof MathJax?.tex2svg==="function"')
    p.evaluate('NEMADEO2.setDocument("")')
    assert p.locator('#editor .md-leaf').count()==1
    p.locator('#editor').click()
    p.keyboard.type('X')
    p.wait_for_timeout(50)
    assert p.evaluate('NEMADEO2.source')=='X',p.evaluate('NEMADEO2.source')
    untouched='# Hello\r\n\r\n- item\r\n\\unknown{thing}\r\n'
    p.evaluate('(s)=>NEMADEO2.setDocument(s)',untouched)
    p.locator('#toggleViewBtn').click()
    assert p.locator('#rawEditor').input_value()==untouched.replace('\r\n','\n')
    # Edit a single word in the normalized textarea without rewriting CRLF.
    p.locator('#rawEditor').evaluate('''e => {const x=e.value.indexOf('item');e.focus();e.setSelectionRange(x,x+4);}''')
    p.keyboard.type('thing')
    expected_crlf=untouched.replace('item','thing')
    assert p.evaluate('NEMADEO2.source')==expected_crlf,repr(p.evaluate('NEMADEO2.source'))
    p.locator('#toggleViewBtn').click()
    assert p.evaluate('NEMADEO2.source')==expected_crlf
    tab='| A | B |\n|---|---|\n| 1 | **two** |\n\n```latex\n\\frac{x}{y}\n```\n\n\\(a^2\\)'
    p.evaluate('(s)=>NEMADEO2.setDocument(s)',tab)
    assert p.locator('.nem-table').count()==1
    assert p.locator('.nem-table th').count()==2
    assert p.locator('.nem-table strong').count()==1
    assert p.locator('.nem-math').count()==1
    assert p.evaluate('NEMADEO2.source')==tab
    struct=p.evaluate('''() => {
      const s=String.raw`\\frac{x^{2}}{\\sqrt{y_i}}`;
      return NEMParser.parseMath(s,0,s.length).map(n=>({type:n.type,children:n.children?.map(c=>c.type)}));
    }''')
    assert struct[0]['type']=='fraction' and struct[0]['children']==['numerator','denominator'],struct
    examples=[r'\frac{a+b}{c}',r'\sum_{i=1}^n i^2',r'\boxed{x=y\cdot C+i}',
              r'\left\lfloor\frac{x}{C}\right\rfloor',r'\begin{pmatrix}1&2\\3&4\end{pmatrix}',
              r'\begin{aligned}a&=b+c\\d&=e\end{aligned}',r'\alpha+\beta\in\mathbb{R}']
    for expression in examples:
        result=p.evaluate('''(s) => {try {return MathJax.tex2svg(s,{display:true}).querySelector("svg")!==null;}catch(e){return String(e.message);} }''',expression)
        assert result is True,(expression,result)
    malicious='<img src=x onerror="window.NEMADEO_PWNED=1">\n\n\\[ x^2 \\]'
    p.evaluate('(s)=>NEMADEO2.setDocument(s)',malicious)
    assert not p.evaluate('!!window.NEMADEO_PWNED')
    p.wait_for_timeout(330)
    assert p.evaluate('localStorage.getItem("nemadeo2_source_v1")')==malicious
    p.locator('#themeSelect').select_option('8')
    assert p.evaluate('localStorage.getItem("neon_writer_theme")')=='8'
    assert not errors,errors
    print('PASS: empty text, CRLF, table, math AST, AI math families, safe HTML, storage/theme persistence')
    b.close()
