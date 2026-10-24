/* Lossless region graph. All offsets are UTF-16 offsets into the source string.
   The parser never rewrites user syntax, including whitespace or line endings. */
(function(global) {
    'use strict';
    function node(type, start, end, props = {}) { return { type, start, end, ...props }; }
    function findUnescaped(s, needle, from, until) {
        let pos = from;
        while ((pos = s.indexOf(needle, pos)) >= 0 && pos < until) {
            let escapes = 0;
            for (let n = pos - 1; n >= 0 && s[n] === '\\'; n--) escapes++;
            if (escapes % 2 === 0) return pos;
            pos++;
        }
        return -1;
    }
    function parseMath(s,a,b,depth=0) {
        // Structural regions for the LLM-style LaTeX subset. Display rendering
        // is delegated to MathJax; this graph remains source-indexed.
        if(depth>32)return [node('mathText',a,b)];
        function groupAt(i){
            if(s[i]!=='{')return null;
            let nesting=1,j=i+1;
            for(;j<b;j++){
                if(s[j]==='\\'){j++;continue;}
                if(s[j]==='{')nesting++;
                if(s[j]==='}' && --nesting===0)break;
            }
            const complete=j<b;
            const finish=complete?j+1:b;
            return node('group',i,finish,{contentStart:i+1,contentEnd:complete?j:b,closed:complete,
                children:parseMath(s,i+1,complete?j:b,depth+1)});
        }
        const tokens=[];
        for(let i=a;i<b;){
            if(s.startsWith('\\frac',i)&&!/[a-zA-Z]/.test(s[i+5]||'')){
                let j=i+5;while(s[j]===' ')j++;
                const numerator=groupAt(j);
                const denominator=numerator?groupAt(numerator.end):null;
                if(numerator&&denominator){
                    tokens.push(node('fraction',i,denominator.end,{children:[
                        node('numerator',numerator.contentStart,numerator.contentEnd,{children:numerator.children}),
                        node('denominator',denominator.contentStart,denominator.contentEnd,{children:denominator.children})
                    ]}));i=denominator.end;continue;
                }
            }
            if(s.startsWith('\\sqrt',i)&&!/[a-zA-Z]/.test(s[i+5]||'')){
                let j=i+5;while(s[j]===' ')j++;
                const arg=groupAt(j);
                if(arg){tokens.push(node('root',i,arg.end,{children:[arg]}));i=arg.end;continue;}
            }
            if(s[i]==='^'||s[i]==='_'){
                const next=groupAt(i+1);
                if(next){tokens.push(node(s[i]==='^'?'superscript':'subscript',i,next.end,{children:[next]}));i=next.end;continue;}
                if(i+1<b){tokens.push(node(s[i]==='^'?'superscript':'subscript',i,i+2,{children:[node('mathText',i+1,i+2)]}));i+=2;continue;}
            }
            if(s[i]==='{'){
                const grp=groupAt(i);tokens.push(grp);i=grp.end;continue;
            }
            if(s[i]==='\\'){
                const match=/^\\(?:[A-Za-z]+|.)/.exec(s.slice(i,b));
                if(match){tokens.push(node('command',i,i+match[0].length,{name:match[0]}));i+=match[0].length;continue;}
            }
            const j=i;while(i<b&&!/[\\{}^_]/.test(s[i]))i++;
            if(i===j)i++;
            tokens.push(node('mathText',j,i));
        }
        return tokens;
    }
    function parseInline(s, a, b, depth = 0) {
        if (depth > 16) return [node('text', a, b)];
        const out = [];
        let plain = a;
        function emit(i) { if (plain < i) out.push(node('text', plain, i)); }
        for (let i = a; i < b;) {
            // Literal backslash escapes, but math delimiters take priority.
            let delim = null, close = null;
            if (s.startsWith('\\(', i)) { delim = '\\('; close = '\\)'; }
            else if (s[i] === '$' && s[i+1] !== '$' && (i === a || s[i-1] !== '\\') && s[i+1] && !/\s/.test(s[i+1])) { delim='$'; close='$'; }
            if (delim) {
                const last = findUnescaped(s, close, i + delim.length, b);
                if (last >= i + delim.length) {
                    emit(i);
                    out.push(node('math', i, last + close.length, { texStart: i + delim.length, texEnd: last, delimiter: delim, display: false, children: parseMath(s,i+delim.length,last) }));
                    i = last + close.length; plain = i; continue;
                }
            }
            if (s[i] === '`') {
                let j = i; while (s[j] === '`' && j < b) j++;
                const ticks = s.slice(i, j), last = s.indexOf(ticks, j);
                if (last >= j && last < b) {
                    emit(i); out.push(node('code', i, last + ticks.length, { contentStart:j, contentEnd:last }));
                    i = last + ticks.length; plain = i; continue;
                }
            }
            if (s[i] === '[') {
                const mid = s.indexOf('](', i+1);
                if (mid > i && mid < b) {
                    const end = s.indexOf(')', mid + 2);
                    if (end > mid && end < b) {
                        emit(i);
                        out.push(node('link', i, end + 1, { children: parseInline(s, i+1, mid, depth+1), href: s.slice(mid+2,end) }));
                        i = end + 1; plain = i; continue;
                    }
                }
            }
            let marker = null, kind = null;
            if (s.startsWith('**',i) || s.startsWith('__',i)) { marker=s.slice(i,i+2); kind='strong'; }
            else if (s.startsWith('~~',i)) { marker='~~'; kind='strike'; }
            else if (s[i] === '*' || s[i] === '_') { marker=s[i]; kind='em'; }
            if (marker) {
                const last = findUnescaped(s,marker,i+marker.length,b);
                if (last > i+marker.length) {
                    emit(i);
                    out.push(node(kind, i,last+marker.length, {children:parseInline(s,i+marker.length,last,depth+1)}));
                    i=last+marker.length; plain=i; continue;
                }
            }
            if (s[i] === '\\' && i+1 < b && /[\\`*{}\[\]()#+.!_>~$]/.test(s[i+1])) {
                emit(i);
                out.push(node('escape',i,i+2,{ contentStart:i+1, contentEnd:i+2 }));
                i+=2;plain=i;continue;
            }
            i++;
        }
        emit(b);
        return out;
    }
    function linesOf(source) {
        const items = [];
        const re = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
        let match;
        while ((match = re.exec(source))) {
            if (match[0] === '' && re.lastIndex === source.length) break;
            const value=match[0];
            const eol=/\r\n$|\r$|\n$/.exec(value);
            const lineEnd=match.index+value.length-(eol?eol[0].length:0);
            items.push({start:match.index,end:lineEnd,fullEnd:match.index+value.length,text:source.slice(match.index,lineEnd)});
            if (re.lastIndex >= source.length) break;
        }
        return items;
    }
    function tableCells(s,L) {
        const parts=[];let a=L.start;
        for(let i=L.start;i<L.end;i++) {
            if(s[i]==='\\' && s[i+1]==='|'){i++;continue;}
            if(s[i]==='|') {parts.push([a,i]);a=i+1;}
        }
        parts.push([a,L.end]);
        if(s[L.start]==='|')parts.shift();
        if(s[L.end-1]==='|')parts.pop();
        return parts.map(([start,end])=>{
            while(start<end && /[ \t]/.test(s[start]))start++;
            while(end>start && /[ \t]/.test(s[end-1]))end--;
            return node('cell',start,end,{children:parseInline(s,start,end)});
        });
    }
    function tableSeparator(line) {
        return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    }
    function parse(source) {
        const s=String(source), lines=linesOf(s), out=[];
        function isBlockMath(t) { return /^ {0,3}(\\\[|\$\$)/.exec(t); }
        for (let i=0;i<lines.length;) {
            const L=lines[i], t=L.text;
            if(i+1<lines.length && t.includes('|') && tableSeparator(lines[i+1].text)) {
                const rows=[node('tableRow',L.start,L.fullEnd,{header:true,cells:tableCells(s,L)})];
                let j=i+2;
                for(;j<lines.length && lines[j].text.includes('|') && lines[j].text.trim();j++) {
                    const row=lines[j];
                    rows.push(node('tableRow',row.start,row.fullEnd,{header:false,cells:tableCells(s,row)}));
                }
                out.push(node('table',L.start,lines[j-1].fullEnd,{rows}));
                i=j;continue;
            }
            const fence=/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(t);
            if (fence) {
                const opener=fence[1], ch=opener[0];
                let j=i+1, close=null;
                const ending=new RegExp('^ {0,3}'+(ch==='`'?'`':'~')+'{'+opener.length+',}[ \\t]*$');
                for(;j<lines.length;j++) if(ending.test(lines[j].text)){close=lines[j];break;}
                const final=close?close.fullEnd:s.length;
                out.push(node('fence',L.start,final,{contentStart:L.fullEnd,contentEnd:close?close.start:final,lang:fence[2].trim(),closed:!!close}));
                i=close?j+1:lines.length; continue;
            }
            const math=isBlockMath(t);
            if (math) {
                const token=math[1], endToken=token==='\\['?'\\]':'$$';
                const openerPos=L.start+t.indexOf(token);
                const contentStart=openerPos+token.length;
                const end=findUnescaped(s,endToken,contentStart,s.length);
                let last=end>=0?end+endToken.length:s.length;
                let j=i;
                while(j+1<lines.length && lines[j].fullEnd<last)j++;
                out.push(node('math', L.start, end>=0?last:s.length,{texStart:contentStart,texEnd:end>=0?end:s.length,delimiter:token,display:true,closed:end>=0,children:parseMath(s,contentStart,end>=0?end:s.length)}));
                i=j+1; continue;
            }
            const heading=/^ {0,3}(#{1,6})[ \t]+/.exec(t);
            const list=/^(\s*)([-+*]|\d+[.)])([ \t]+)/.exec(t);
            const quote=/^( {0,3}> ?)/.exec(t);
            const hr=/^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(t);
            let typ='line', a=L.start, b=L.end, props={};
            if(heading) {typ='heading';a+=heading[0].length;props.level=heading[1].length;}
            else if(list) {typ='list';a+=list[0].length;props.marker=list[2];props.indent=list[1].length;}
            else if(quote) {typ='quote';a+=quote[0].length;}
            else if(hr) {typ='rule';}
            else if(!t.trim()) {typ='blank';}
            out.push(node(typ,L.start,L.fullEnd,{...props,contentStart:a,contentEnd:b,children:typ==='rule'||typ==='blank'?[]:parseInline(s,a,b)}));
            i++;
        }
        if (out.length === 0) out.push(node('line',0,0,{contentStart:0,contentEnd:0,children:[]}));
        return node('document',0,s.length,{children:out});
    }
    global.NEMParser={parse,parseInline,parseMath,linesOf};
})(window);
