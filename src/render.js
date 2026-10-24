/* Region-based view. Never serializes the DOM into document content. */
(function(global){
'use strict';
const P=global.NEMParser;
function element(tag, cls) {const el=document.createElement(tag);if(cls)el.className=cls;return el;}
function safeHref(href) {return /^(https?:\/\/|mailto:|#|\/)/i.test(href) ? href : null;}
class SourceView {
    constructor(host, scroller, onMathEdit, onMathDelete) {
        this.host=host;this.scroller=scroller;this.onMathEdit=onMathEdit;this.onMathDelete=onMathDelete;
        this.blocks=[];this.nodes=[];this.mathCache=new Map();this.tail=null;
        this.observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
            for(const entry of entries) if(entry.isIntersecting) this.renderMath(entry.target);
        },{root:scroller,rootMargin:'450px'}) : null;
    }
    caretAnchor(pos, className) {
        const block=element('div',className);
        block.dataset.blockStart=String(pos);
        block.dataset.blockEnd=String(pos);
        block.dataset.blockType='caret-anchor';
        const leaf=element('span','md-leaf nem-empty-leaf');
        leaf.dataset.start=String(pos);
        leaf.dataset.end=String(pos);
        leaf.textContent='\u200b';
        block.appendChild(leaf);
        return block;
    }
    // Cursor just outside a displayed formula. Skipping exactly one physical
    // line break selects the beginning of the following visible line.
    afterMathPosition(mathEnd) {
        const source=this.lastSource ?? '';
        if(source.slice(mathEnd,mathEnd+2)==='\r\n')return mathEnd+2;
        if(source[mathEnd]==='\r'||source[mathEnd]==='\n')return mathEnd+1;
        return mathEnd;
    }
    inline(nodes, parent, source) {
        for(const n of nodes) {
            let el;
            if(n.type==='text' || n.type==='escape') {
                el=element('span','md-leaf');
                el.textContent=source.slice(n.contentStart ?? n.start,n.contentEnd ?? n.end);
                el.dataset.start=String(n.contentStart ?? n.start);el.dataset.end=String(n.contentEnd ?? n.end);
            } else if(n.type==='code') {
                el=element('code','md-leaf');
                el.textContent=source.slice(n.contentStart,n.contentEnd);
                el.dataset.start=String(n.contentStart);el.dataset.end=String(n.contentEnd);
            } else if(n.type==='math') {
                el=this.mathElement(n,source);
            } else if(n.type==='strong'||n.type==='em'||n.type==='strike'||n.type==='link') {
                const tag={strong:'strong',em:'em',strike:'del',link:'a'}[n.type];
                el=element(tag);
                el.dataset.start=String(n.start);el.dataset.end=String(n.end);
                if(n.type==='link') {
                    const href=safeHref(n.href);
                    if(href)el.setAttribute('href',href);
                    el.addEventListener('click',ev => ev.preventDefault());
                }
                this.inline(n.children,el,source);
            } else continue;
            parent.appendChild(el);
            if(n.type==='math' && !n.display){
                // A noneditable inline SVG still needs a zero-width editable
                // position immediately after the formula.
                const cursor=element('span','md-leaf nem-empty-leaf');
                cursor.dataset.start=String(n.end);cursor.dataset.end=String(n.end);
                cursor.textContent='\u200b';parent.appendChild(cursor);
            }
        }
    }
    mathElement(n,source) {
        const el=element(n.display?'div':'span',n.display?'nem-math nem-math-block':'nem-math nem-math-inline');
        el.dataset.start=String(n.start);el.dataset.end=String(n.end);
        el.dataset.tex=source.slice(n.texStart,n.texEnd);
        el.dataset.display=n.display?'1':'0';
        el.contentEditable='false';el.tabIndex=0;
        const isEmpty=!el.dataset.tex.trim();
        if(isEmpty)el.classList.add('nem-math-empty');
        el.title=isEmpty?'Empty formula — click to edit, or focus and press Delete':
            'Click to edit formula; press Delete or Backspace when focused to remove it';
        el.setAttribute('aria-label',isEmpty?'Empty formula, editable':'Mathematical formula, editable');
        el.textContent=isEmpty?'Empty formula — click to edit':el.dataset.tex;
        el.addEventListener('click',ev=>{ev.preventDefault();this.onMathEdit(el);});
        el.addEventListener('keydown',ev=>{
            if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();this.onMathEdit(el);}
            else if(ev.key==='Delete'||ev.key==='Backspace'){
                ev.preventDefault();this.onMathDelete(el);
            }
            else if(ev.key==='ArrowDown'||ev.key==='ArrowRight'){
                ev.preventDefault();this.caret(this.afterMathPosition(this.effective(el,'end')));
            }
        });
        if(this.observer)this.observer.observe(el);
        else this.renderMath(el);
        return el;
    }
    renderMath(el) {
        if(!el.isConnected || el.dataset.rendered==='yes')return;
        const tex=el.dataset.tex, display=el.dataset.display==='1';
        const mj=global.MathJax;
        if(!mj || typeof mj.tex2svg!=='function') return;
        if(!tex.trim()) {
            // A valid empty LaTeX region must remain visible and interactive.
            // This placeholder is a pure view; its text never reaches Markdown.
            el.textContent='Empty formula — click to edit';
            el.dataset.rendered='yes';
            if(this.observer)this.observer.unobserve(el);
            return;
        }
        try {
            const key=(display?'block:':'inline:')+tex;
            let html=this.mathCache.get(key);
            if(!html) {
                const rendered=mj.tex2svg(tex,{display});
                html=rendered.outerHTML;
                if(this.mathCache.size>250)this.mathCache.delete(this.mathCache.keys().next().value);
                this.mathCache.set(key,html);
            }
            // MathJax is the only HTML producer here, and consumes untrusted
            // math input with safe defaults; never allow arbitrary user HTML.
            el.innerHTML=html;
            el.dataset.rendered='yes';
            if(this.observer)this.observer.unobserve(el);
        } catch (e) {
            el.textContent=tex;
            el.classList.add('nem-math-error');
            el.title='Unsupported formula — click to edit: '+String(e.message||e).slice(0,140);
        }
    }
    refreshMath() {
        this.host.querySelectorAll('.nem-math:not([data-rendered="yes"])').forEach(el => {
            if(!this.observer || this.isNearViewport(el))this.renderMath(el);
        });
    }
    isNearViewport(el) {
        const r=el.getBoundingClientRect(), p=this.scroller.getBoundingClientRect();
        return r.bottom > p.top-450 && r.top < p.bottom+450;
    }
    makeBlock(n,s) {
        let el;
        if(n.type==='table') {
            el=element('table','nem-table');
            const thead=element('thead'),tbody=element('tbody');
            for(const row of n.rows) {
                const tr=element('tr');
                for(const cell of row.cells) {
                    const td=element(row.header?'th':'td');
                    if(cell.children.length)this.inline(cell.children,td,s);
                    else {
                        const placeholder=element('span','md-leaf');
                        placeholder.dataset.start=String(cell.start);placeholder.dataset.end=String(cell.start);placeholder.textContent='\u200b';td.appendChild(placeholder);
                    }
                    tr.appendChild(td);
                }
                (row.header?thead:tbody).appendChild(tr);
            }
            el.append(thead,tbody);
        } else if(n.type==='fence') {
            el=element('pre','nem-code');
            const code=element('code','md-leaf');
            code.dataset.start=String(n.contentStart);code.dataset.end=String(n.contentEnd);
            code.textContent=s.slice(n.contentStart,n.contentEnd).replace(/\r?\n$/, '');
            el.appendChild(code);
        } else if(n.type==='math') el=this.mathElement(n,s);
        else if(n.type==='heading')el=element('h'+n.level);
        else if(n.type==='list') {
            el=element('div','nem-list-line');
            const mark=element('span','nem-list-marker');mark.textContent=/\d/.test(n.marker[0])?n.marker:'•';mark.contentEditable='false';
            el.style.paddingLeft=(n.indent*9+22)+'px';el.appendChild(mark);
        } else if(n.type==='quote')el=element('blockquote','nem-quote-line');
        else if(n.type==='rule')el=element('hr');
        else if(n.type==='blank') {
            el=element('div','nem-blank');el.appendChild(document.createElement('br'));
        } else el=element('div','nem-line');
        if(n.children && n.children.length)this.inline(n.children,el,s);
        if(n.type==='heading'||n.type==='line'||n.type==='quote'||n.type==='list') {
            if(!n.children.length){const placeholder=element('span','md-leaf');placeholder.dataset.start=String(n.contentStart);placeholder.dataset.end=String(n.contentStart);placeholder.textContent='\u200b';el.appendChild(placeholder);}
        }
        el.dataset.blockStart=String(n.start);el.dataset.blockEnd=String(n.end);
        el.dataset.blockType=n.type;
        return el;
    }
    shiftRegion(el,delta) {
        // O(1) positional shift for unchanged blocks: do not visit every leaf.
        // Each leaf stores its original coordinates plus its block's lazy shift.
        el.dataset.offsetShift=String((Number(el.dataset.offsetShift)||0)+delta);
        el.dataset.blockStart=String(Number(el.dataset.blockStart)+delta);
        el.dataset.blockEnd=String(Number(el.dataset.blockEnd)+delta);
    }
    effective(el,key) {
        const block=el.closest('[data-block-start]');
        return Number(el.dataset[key])+(Number(block?.dataset.offsetShift)||0);
    }
    draw(source,force=false) {
        // A trailing display formula is non-editable HTML. Supply a *view-only*
        // insertion line beyond it, with a source offset. Also expose a final
        // empty line when the Markdown source ends in a line break.
        if(this.tail){this.tail.remove();this.tail=null;}
        const next=P.parse(source).children;
        const old=this.blocks;
        if(force) {this.host.replaceChildren();this.blocks=[];this.nodes=[];}
        const prev=force?[]:old;
        const raw=(n,s)=>s.slice(n.start,n.end);
        const oldSource=this.lastSource??'';
        let p=0;while(p<prev.length && p<next.length && prev[p].type===next[p].type && raw(prev[p],oldSource)===raw(next[p],source))p++;
        let a=prev.length-1,b=next.length-1;
        while(a>=p && b>=p && prev[a].type===next[b].type && raw(prev[a],oldSource)===raw(next[b],source)){a--;b--;}
        const newNodes=[];
        for(let i=p;i<=b;i++)newNodes.push(this.makeBlock(next[i],source));
        const oldNodes=this.nodes;
        const anchor=oldNodes[a+1]||null;
        for(let i=p;i<=a;i++) {if(this.observer)oldNodes[i].querySelectorAll('.nem-math').forEach(el=>this.observer.unobserve(el));oldNodes[i].remove();}
        const fragment=document.createDocumentFragment();for(const n of newNodes)fragment.appendChild(n);
        this.host.insertBefore(fragment,anchor);
        const suffix=oldNodes.slice(a+1);
        for(let i=0;i<suffix.length;i++)this.shiftRegion(suffix[i],next[b+1+i].start-prev[a+1+i].start);
        this.nodes=[...oldNodes.slice(0,p),...newNodes,...suffix];
        this.blocks=next;this.lastSource=source;
        const last=next[next.length-1];
        const needsTail=last?.type==='math' && last.display ||
            /(?:\r\n|\r|\n)$/.test(source);
        if(needsTail){
            this.tail=this.caretAnchor(source.length,'nem-document-tail');
            this.host.appendChild(this.tail);
        }
        this.refreshMath();
    }
    positionFromPoint(node,offset,side='start') {
        if(!node)return null;
        const elementNode=node.nodeType===Node.TEXT_NODE?node.parentElement:node;
        let leaf=elementNode.closest('.md-leaf');
        if(leaf && this.host.contains(leaf)) {
            const start=this.effective(leaf,'start'),end=this.effective(leaf,'end');
            let index=0;
            try {const range=document.createRange();range.selectNodeContents(leaf);range.setEnd(node,offset);index=range.toString().length;}catch(_){index=0;}
            return Math.min(end,Math.max(start,start+index));
        }
        const math=elementNode.closest('.nem-math');
        if(math && this.host.contains(math))return this.effective(math,side==='end'?'end':'start');
        // A browser can place its selection *between* child elements. Map
        // that DOM boundary to source offsets instead of defaulting to the
        // start of the containing block (especially after inline math).
        if(node.nodeType===Node.ELEMENT_NODE && this.host.contains(node)) {
            const siblings=node.childNodes;
            if(offset>=0 && offset<=siblings.length) {
                const boundary=(child,edge)=>{
                    if(!child||child.nodeType!==Node.ELEMENT_NODE)return null;
                    if(child.hasAttribute('data-'+edge))return this.effective(child,edge);
                    if(child.hasAttribute('data-block-'+edge))return Number(child.dataset['block'+edge[0].toUpperCase()+edge.slice(1)]);
                    const found=edge==='start'?child.querySelector('[data-start]'):
                        [...child.querySelectorAll('[data-end]')].at(-1);
                    return found?this.effective(found,edge):null;
                };
                const left=offset>0?boundary(siblings[offset-1],'end'):null;
                const right=offset<siblings.length?boundary(siblings[offset],'start'):null;
                if(left!==null)return left;
                if(right!==null)return right;
            }
        }
        const block=elementNode.closest('[data-block-start]');
        if(block&&this.host.contains(block)) {
            const leaves=[...block.querySelectorAll('.md-leaf')];
            if(leaves.length) return this.effective(side==='end'?leaves[leaves.length-1]:leaves[0],side==='end'?'end':'start');
            return Number(block.dataset.blockStart);
        }
        return side==='end' ? this.lastSource.length : 0;
    }
    selectionRegion() {
        const s=global.getSelection();if(!s||!s.rangeCount||!this.host.contains(s.anchorNode))return null;
        const anchor=this.positionFromPoint(s.anchorNode,s.anchorOffset),focus=this.positionFromPoint(s.focusNode,s.focusOffset,'end');
        if(anchor===null||focus===null)return null;
        return {start:Math.min(anchor,focus),end:Math.max(anchor,focus),anchor,focus};
    }
    caret(position) {
        this.host.focus();
        const leaves=[...this.host.querySelectorAll('.md-leaf')];
        // Prefer the next line's zero-width insertion point over the end of
        // the previous line when two regions meet at exactly the same offset.
        let leaf=leaves.find(n=>this.effective(n,'start')===position) ||
            leaves.find(n=>this.effective(n,'start')<=position && position<=this.effective(n,'end'));
        if(!leaf)leaf=leaves.find(n=>this.effective(n,'start')>=position)||leaves[leaves.length-1];
        if(!leaf)return;
        const off=Math.max(0,Math.min(position-this.effective(leaf,'start'),leaf.textContent.replace(/\u200b/g,'').length));
        const text=[...leaf.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
        const range=document.createRange();
        if(text)range.setStart(text,Math.min(off,text.textContent.length)); else range.setStart(leaf,0);
        range.collapse(true);
        const selection=global.getSelection();selection.removeAllRanges();selection.addRange(range);
    }
}
global.NEMView={SourceView};
})(window);
