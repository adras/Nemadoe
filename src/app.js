/* NEMADEO 2 application shell. All editor commands are source transactions.
   DOM and math SVG are throwaway views; never persisted as document content. */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const KEY='nemadeo2_source_v1', FILENAME_KEY='nemadeo2_filename', LEGACY_KEY='neon_writer_markdown_v4', THEME_KEY='neon_writer_theme';
function storageGet(key){try{return localStorage.getItem(key);}catch(_){return null;}}
function storageSet(key,value){try{localStorage.setItem(key,value);return true;}catch(_){$('saveStatus').textContent='Autosave unavailable – export your file';$('saveStatus').classList.add('storage-warning');return false;}}
const initial=storageGet(KEY)??storageGet(LEGACY_KEY)??'# NEMADEO 2\n\nWrite Markdown and math in one document.\n\n\\[\n256^m = 2^{8m}\n\\]\n';
const documentModel=new NEMModel.SourceDocument(initial);
const host=$('editor'),raw=$('rawEditor'),wrap=document.querySelector('.wrap');
const filename=$('filenameInput'),mathPanel=$('mathPanel'),mathInput=$('mathInput');
const mathPreview=$('mathPreview');
const view=new NEMView.SourceView(host,wrap,openMath,deleteMath);
let rawMode=false, saveTimer=null, drawScheduled=false, caretAfter=null, editingMath=null;
filename.value=storageGet(FILENAME_KEY)||'nemadeo2';
filename.addEventListener('input',()=>storageSet(FILENAME_KEY,filename.value));
function normalizedTextarea(text){return text.replace(/\r\n?/g,'\n');}
function sourceOffsetFromTextarea(source,visibleOffset){
    let i=0,j=0;
    while(i<source.length&&j<visibleOffset){
        if(source[i]==='\r'&&source[i+1]==='\n')i+=2;
        else i++;
        j++;
    }
    return i;
}
function documentLineEnding(text){return text.includes('\r\n')?'\r\n':(text.includes('\r')?'\r':'\n');}
function counts() {
    const s=documentModel.source;
    $('cc').textContent=Array.from(s).length.toLocaleString();
    $('wc').textContent=(s.match(/\S+/gu)||[]).length.toLocaleString();
}
function saveNow() {clearTimeout(saveTimer);saveTimer=null;if(storageSet(KEY,documentModel.source)){$('saveStatus').textContent='Saved locally';$('saveStatus').classList.remove('storage-warning');}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,260);$('saveStatus').textContent='Saving…';}
function scheduleDraw(position=null){if(position!==null)caretAfter=position;if(drawScheduled)return;drawScheduled=true;requestAnimationFrame(()=>{drawScheduled=false;if(rawMode)return;view.draw(documentModel.source);if(caretAfter!==null&&!editingMath){view.caret(caretAfter);caretAfter=null;}});}
function changeRegion(start,end,text,restore=true){
    if(!documentModel.replace(start,end,text))return;
    if(!rawMode&&!editingMath)scheduleDraw(restore?start+text.length:null);
}
documentModel.subscribe(()=>{
    counts();scheduleSave();
    if(rawMode&&raw.value!==normalizedTextarea(documentModel.source))raw.value=documentModel.source;
});
counts();view.draw(documentModel.source,true);
function setDocument(s){editingMath=null;mathPanel.hidden=true;documentModel.load(String(s));raw.value=documentModel.source;view.draw(documentModel.source,true);counts();saveNow();}
function toggleRaw(){
    if(editingMath)finishMath();
    rawMode=!rawMode;raw.hidden=!rawMode;host.hidden=rawMode;
    $('toggleViewBtn').textContent=rawMode?'Formatted':'Raw';
    if(rawMode){raw.value=documentModel.source;raw.focus();}
    else {view.draw(documentModel.source);host.focus();}
}
$('toggleViewBtn').addEventListener('click',toggleRaw);
raw.addEventListener('input',()=>{
    const before=documentModel.source;
    const diff=NEMModel.minimalDifference(normalizedTextarea(before),raw.value);
    documentModel.replace(sourceOffsetFromTextarea(before,diff.start),
        sourceOffsetFromTextarea(before,diff.end),diff.inserted.replace(/\n/g,documentLineEnding(before)));
});
raw.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}
});
function undo(isRedo=false){const pos=isRedo?documentModel.redo():documentModel.undo();if(pos!==null){if(rawMode){raw.value=documentModel.source;raw.setSelectionRange(pos,pos);}else scheduleDraw(pos);}}
function selection(){if(rawMode)return {start:raw.selectionStart,end:raw.selectionEnd};return view.selectionRegion();}
function afterFormulaInsertion(region,text){
    if(rawMode || !text || region.start!==region.end ||
       region.start!==documentModel.source.length)return text;
    const last=view.blocks[view.blocks.length-1],source=documentModel.source;
    if(last?.type==='math' && last.display &&
       view.tail?.contains(global.getSelection()?.anchorNode) &&
       /^[\r\n]*$/.test(source.slice(last.end)) &&
       !/[\r\n]$/.test(source))return documentLineEnding(source)+text;
    return text;
}
function insertAround(before,after,placeholder=''){
    const region=selection();if(!region)return;
    const chosen=documentModel.source.slice(region.start,region.end)||placeholder;
    const original=before+chosen+after;
    const insert=afterFormulaInsertion(region,original);
    changeRegion(region.start,region.end,insert,false);
    const pos=region.start+insert.length-after.length;
    if(rawMode){raw.focus();raw.setSelectionRange(pos,pos);}else scheduleDraw(pos);
}
function changeHeading(level){
    const region=selection();if(!region)return;
    const s=documentModel.source;
    const start=s.lastIndexOf('\n',Math.max(0,region.start-1))+1;
    const end=s.indexOf('\n',region.start);
    const finish=end<0?s.length:end;
    const line=s.slice(start,finish), body=line.replace(/^ {0,3}#{1,6}[ \t]+/,'');
    changeRegion(start,finish,(level?'#'.repeat(level)+' ':'')+body);
}
function performTool(name){
    if(editingMath){insertMathSnippet(name);return;}
    if(name==='undo'){undo(false);return;}
    if(name==='redo'){undo(true);return;}
    if(/^h[1-6]$/.test(name)){changeHeading(Number(name[1]));return;}
    if(name==='normal'){changeHeading(0);return;}
    const pairs={bold:['**','**','text'],italic:['*','*','text'],strike:['~~','~~','text'],code:['`','`','code'],inlineMath:['\\(','\\)','x'],blockMath:['\\[\n','\n\\]','x'],fraction:['\\(\\frac{','}{}\\)','x'],sqrt:['\\(\\sqrt{','}\\)','x'],power:['\\(','^{2}\\)','x'],subscript:['\\(','_{i}\\)','x'],sum:['\\(\\sum_{i=1}^{n} ','\\)','a_i'],matrix:['\\[\n\\begin{pmatrix}\n','&b\\\\\nc&d\n\\end{pmatrix}\n\\]','a']};
    if(name==='bullet'||name==='number'){
        const s=selection();if(!s)return;
        const start=documentModel.source.lastIndexOf('\n',Math.max(s.start-1,0))+1;
        changeRegion(start,start,name==='bullet'?'- ':'1. ');return;
    }
    if(name==='fence'){insertAround('```\n','\n```','code');return;}
    if(pairs[name])insertAround(...pairs[name]);
}
for(const el of document.querySelectorAll('[data-tool]')){
    el.addEventListener('mousedown',e=>{if(!rawMode&&!editingMath)e.preventDefault();});
    el.addEventListener('click',()=>performTool(el.dataset.tool));
}
// Intercept native browser changes before they mutate the projection DOM.
host.addEventListener('beforeinput',e=>{
    if(editingMath || e.isComposing)return;
    const r=(drawScheduled && caretAfter!==null) ? {start:caretAfter,end:caretAfter} : view.selectionRegion();if(!r)return;
    let a=r.start,b=r.end,text=null;
    // Test the actual (collapsed) caret *before* expanding a Backspace into
    // a one-character deletion; otherwise we delete a LaTeX delimiter.
    if(a===b && (e.inputType==='deleteContentBackward'||e.inputType==='deleteContentForward')) {
        const math=mathAtBoundary(a,e.inputType==='deleteContentBackward');
        if(math){e.preventDefault();deleteMath(math);return;}
    }
    if(e.inputType==='insertText'||e.inputType==='insertReplacementText'){text=e.data??'';}
    else if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'){
        // Preserve source syntax; extend existing list markers where appropriate.
        const lineStart=documentModel.source.lastIndexOf('\n',Math.max(a-1,0))+1;
        const prefix=/^\s*(?:[-*+] |\d+[.)] )/.exec(documentModel.source.slice(lineStart,a));
        text='\n'+(prefix?prefix[0]:'');
    }
    else if(e.inputType==='deleteContentBackward') {if(a===b&&a>0)a--;text='';}
    else if(e.inputType==='deleteContentForward') {if(a===b&&b<documentModel.source.length)b++;text='';}
    else if(e.inputType==='deleteByCut'){text='';}
    else if(e.inputType==='historyUndo'){e.preventDefault();undo(false);return;}
    else if(e.inputType==='historyRedo'){e.preventDefault();undo(true);return;}
    else return;
    // The tail caret exists only in the view. A first keystroke after an
    // unterminated last Markdown line must create the missing line break.
    if(text)text=afterFormulaInsertion({start:a,end:b},text);
    e.preventDefault();changeRegion(a,b,text,false);scheduleDraw(a+text.length);
});
host.addEventListener('keydown',e=>{
    const ctrl=e.ctrlKey||e.metaKey;
    if(ctrl&&e.key.toLowerCase()==='b'){e.preventDefault();performTool('bold');}
    else if(ctrl&&e.key.toLowerCase()==='i'){e.preventDefault();performTool('italic');}
    else if(ctrl&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}
    else if(ctrl&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}
    else if(e.key==='Tab'){e.preventDefault();insertAround('    ','');}
});
host.addEventListener('paste',e=>{
    if(editingMath)return;
    const r=view.selectionRegion();if(!r)return;
    e.preventDefault();const text=afterFormulaInsertion(r,e.clipboardData.getData('text/plain'));changeRegion(r.start,r.end,text,false);scheduleDraw(r.start+text.length);
});
host.addEventListener('copy',e=>{
    const r=view.selectionRegion();if(!r||r.start===r.end)return;
    e.preventDefault();e.clipboardData.setData('text/plain',documentModel.source.slice(r.start,r.end));
});
host.addEventListener('cut',e=>{
    const r=view.selectionRegion();if(!r||r.start===r.end)return;
    e.preventDefault();e.clipboardData.setData('text/plain',documentModel.source.slice(r.start,r.end));changeRegion(r.start,r.end,'');
});
// If an IME mutates a leaf during composition, only reconcile its source region.
let composition=null;
host.addEventListener('compositionstart',e=>{
    const el=(e.target.nodeType===1?e.target:e.target.parentElement).closest('.md-leaf');
    if(el)composition={start:Number(el.dataset.start),end:Number(el.dataset.end),el};
});
host.addEventListener('compositionend',()=>{
    if(!composition)return;
    const {start,end,el}=composition;composition=null;
    const text=el.textContent.replace(/\u200b/g,'');changeRegion(start,end,text,false);scheduleDraw(start+text.length);
});
// Formula edits are directly applied to the canonical LaTeX region.
function mathAtBoundary(position,backwards){
    for(let i=0;i<view.blocks.length;i++) {
        const n=view.blocks[i];
        if(n.type!=='math' || !n.display)continue;
        // The extra end-of-document caret lives at the source end; an actual
        // next line is also one line break past the closing delimiter.
        const edge=backwards?view.afterMathPosition(n.end):n.start;
        if(position===edge || (backwards && position===n.end))return view.nodes[i];
    }
    return null;
}
function deleteMath(element){
    const start=view.effective(element,'start');
    const end=view.effective(element,'end');
    if(start<0 || end<=start || end>documentModel.source.length)return;
    if(editingMath){editingMath=null;mathPanel.hidden=true;}
    changeRegion(start,end,'',false);
    scheduleDraw(start);
}
function deleteActiveMath(){
    if(!editingMath)return;
    const {open,close}=editingMath;
    editingMath=null;mathPanel.hidden=true;
    changeRegion(open,close,'',false);
    scheduleDraw(open);
}
function openMath(element){
    if(editingMath)finishMath();
    const open=view.effective(element,'start'),close=view.effective(element,'end');
    const value=element.dataset.tex;
    const delimiter=element.dataset.display==='1' ? (documentModel.source.slice(open,open+2)==='$$'?'$$':'\\[') : (documentModel.source.slice(open,open+2)==='\\('?'\\(':'$');
    const start=open+delimiter.length;
    editingMath={open,close,start,end:start+value.length};
    mathInput.value=value;mathPanel.hidden=false;
    mathInput.focus();mathInput.setSelectionRange(0,mathInput.value.length);
    updateMathPreview();
}
function updateMathPreview(){
    mathPreview.replaceChildren();
    const tex=mathInput.value;
    if(!tex.trim()){
        mathPreview.textContent='Empty formula — type LaTeX to preview';
        $('mathError').textContent='';
        return;
    }
    if(global.MathJax?.tex2svg) {
        try {mathPreview.appendChild(global.MathJax.tex2svg(tex,{display:true}));$('mathError').textContent='';}
        catch(e){mathPreview.textContent=tex;$('mathError').textContent=String(e.message).slice(0,180);}
    } else mathPreview.textContent=tex;
}
mathInput.addEventListener('input',()=>{
    if(!editingMath)return;
    const {start,end}=editingMath;
    // Even during visual math editing there is only one source of truth.
    documentModel.replace(start,end,mathInput.value);
    editingMath.close+=mathInput.value.length-(end-start);
    editingMath.end=start+mathInput.value.length;
    updateMathPreview();
});
function insertMathSnippet(name){
    const snippets={bold:'\\mathbf{#}',italic:'\\mathit{#}',fraction:'\\frac{#}{}',sqrt:'\\sqrt{#}',power:'^{#}',subscript:'_{#}',sum:'\\sum_{i=1}^{n} #',matrix:'\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}',inlineMath:'\\left(#\\right)',blockMath:'\\boxed{#}'};
    const t=snippets[name];if(!t)return;
    const a=mathInput.selectionStart,b=mathInput.selectionEnd;
    const selected=mathInput.value.slice(a,b);
    const insert=t.replace('#',selected||'x');
    mathInput.setRangeText(insert,a,b,'end');
    mathInput.dispatchEvent(new Event('input',{bubbles:true}));
    mathInput.focus();
}
function finishMath(){
    if(!editingMath)return;
    const source=documentModel.source;
    const endOfMath=editingMath.close;
    editingMath=null;mathPanel.hidden=true;
    view.draw(source);
    view.caret(view.afterMathPosition(endOfMath));
}
$('mathDone').addEventListener('click',finishMath);
$('mathDelete').addEventListener('click',deleteActiveMath);
mathInput.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finishMath();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();finishMath();}});
$('mathCommands').addEventListener('click',e=>{const b=e.target.closest('[data-math-tool]');if(b)insertMathSnippet(b.dataset.mathTool);});
$('importInput').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{setDocument(await file.text());filename.value=file.name.replace(/\.md$/i,'');storageSet(FILENAME_KEY,filename.value);}
    catch(err){$('saveStatus').textContent='Import failed: '+err.message;}
    finally{e.target.value='';}
});
$('importBtn').addEventListener('click',()=>$('importInput').click());
$('exportBtn').addEventListener('click',()=>{
    saveNow();const blob=new Blob([documentModel.source],{type:'text/markdown;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=(filename.value.trim()||'nemadeo2').replace(/\.md$/i,'')+'.md';
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
        e.preventDefault();$('exportBtn').click();
    }
});
window.addEventListener('pagehide',()=>{if(saveTimer)saveNow();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&saveTimer)saveNow();});
// A small transparent API is used exclusively by test and diagnostics.
global.NEMADEO2={document:documentModel,view,setDocument,toggleRaw,performTool,saveNow,get source(){return documentModel.source;},get rawMode(){return rawMode;}};
if(global.MathJax?.startup?.promise)global.MathJax.startup.promise.then(()=>view.refreshMath());
})(window);
