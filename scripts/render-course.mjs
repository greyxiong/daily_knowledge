import MarkdownIt from 'markdown-it';
import {mathTemplates} from './render-math.mjs';
import sanitizeHtml from 'sanitize-html';
import {evaluate,braceEnd} from './safe-expression.mjs';

const md=new MarkdownIt({html:true,linkify:true,breaks:false});
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function findDirective(source,start,kind) {
 let cursor=start,depth=0,alternate=-1;
 while(cursor<source.length){const next=source.slice(cursor).search(/\{(?:#(?:if|each)\b|\/(?:if|each)\}|:else\})/);if(next<0)break;
  const pos=cursor+next,end=braceEnd(source,pos);if(end<0)break;const token=source.slice(pos,end+1);
  if(token.startsWith('{#'))depth++;
  else if(token.startsWith('{/')){if(depth===0)return {end:pos,after:end+1,alternate};depth--;}
  else if(depth===0&&kind==='if')alternate=pos;
  cursor=end+1;
 }
 throw new Error('Unclosed historical component');
}
function expand(source,scope,issues,depth=0){
 if(depth>12)throw new Error('Component nesting limit');
 let result='',cursor=0;
 while(cursor<source.length){
  const rel=source.slice(cursor).search(/\{#(?:each|if)\b/);if(rel<0){result+=source.slice(cursor);break;}
  const start=cursor+rel,headEnd=braceEnd(source,start);result+=source.slice(cursor,start);
  if(headEnd<0)throw new Error('Unclosed directive');
  const head=source.slice(start+1,headEnd),kind=head.startsWith('#each')?'each':'if';
  const match=findDirective(source,headEnd+1,kind),body=source.slice(headEnd+1,match.end);
  if(kind==='each'){
   const spec=head.slice(6).trim().match(/^([\s\S]+)\s+as\s+(\w+)$/);if(!spec)throw new Error('Unsupported loop');
   const values=evaluate(spec[1],scope);if(!Array.isArray(values)||values.length>200)throw new Error('Loop limit');
   result+=values.map(value=>expand(body,{...scope,[spec[2]]:value},issues,depth+1)).join('\n');
  }else{
   const expr=head.slice(4).trim();
   const first=match.alternate<0?body:source.slice(headEnd+1,match.alternate);
   const second=match.alternate<0?'':source.slice(match.alternate+7,match.end);
   if(/!==?\s*["']none["']/.test(expr))result+='\n<details class="source-answer"><summary>查看原文解析</summary>\n\n'+expand(first,scope,issues,depth+1)+'\n\n</details>\n';
   else if(/(?:success|正确)/.test(first))result+=expand(first,scope,issues,depth+1);
   else if(/(?:success|正确)/.test(second))result+=expand(second,scope,issues,depth+1);
   else {result+='\n<details class="source-answer"><summary>查看各选项的原文说明</summary>\n\n'+expand(first,scope,issues,depth+1)+'\n\n'+expand(second,scope,issues,depth+1)+'\n\n</details>\n';}
  }
  cursor=match.after;
 }
 // Resolve remaining literal expressions without eval, Function, arbitrary calls or globals.
 let text='',i=0;
 while(i<result.length){if(result[i]!=='{'){text+=result[i++];continue;}const end=braceEnd(result,i);if(end<0){text+=result[i++];continue;}
  const expr=result.slice(i+1,end);
  try{text+=String(evaluate(expr,scope));}catch{issues.push({type:'component',message:'Unsupported original expression retained as text.'});text+=escape(result.slice(i,end+1));}
  i=end+1;
 }
 return text;
}
function normalizeTags(source,issues){
 let svgDepth=0;
 return source.replace(/<\/?[A-Za-z][^>]*>/g,tag=>{
  const match=tag.match(/^<(\/)?([\w-]+)/),close=!!match[1],name=match[2],lower=name.toLowerCase();
  const self=/\/\s*>$/.test(tag);
  if(lower==='cite')return '<sup class="source-reference">〔来源见本课末尾〕</sup>';
  if(lower==='entity'){const value=tag.match(/\bvalue="([^"]*)"/);return value?escape(value[1]):'';}
  if(lower==='asyncimage'||lower==='asyncimagegroup'){issues.push({type:'image',message:'Original remote illustration was not downloaded.'});return '\n\n<aside class="source-note">原对话配图未包含在迁移文本中，正文与公式已保留。</aside>\n\n';}
  if(lower==='icon')return '';
  if(lower==='slider'){issues.push({type:'interactive',message:'Interactive slider shown at original default value.'});return '\n\n<small class="source-note">以下显示原交互示例的默认参数值。</small>\n\n';}
  if(lower==='svg'){svgDepth+=close?-1:1;return tag.replace(/\b(fillOpacity|strokeOpacity|strokeWidth|fontSize|fontFamily|textAnchor)\b/g,(_,a)=>({fillOpacity:'fill-opacity',strokeOpacity:'stroke-opacity',strokeWidth:'stroke-width',fontSize:'font-size',fontFamily:'font-family',textAnchor:'text-anchor'}[a]));}
  if(svgDepth>0)return tag.replace(/\b(fillOpacity|strokeOpacity|strokeWidth|fontSize|fontFamily|textAnchor)\b/g,(_,a)=>({fillOpacity:'fill-opacity',strokeOpacity:'stroke-opacity',strokeWidth:'stroke-width',fontSize:'font-size',fontFamily:'font-family',textAnchor:'text-anchor'}[a]));
  const mapped={box:['div','source-box'],row:['div','source-row'],grid:['div','source-grid'],'grid-item':['div','source-grid-item'],text:['div','source-text'],title:['h3','source-title'],caption:['p','source-caption'],list:['ul',''],'list-item':['li',''],'radio-group':['ol','source-choices'],radio:['li',''],'table-row':['tr',''],'table-cell':['td',''],divider:['hr','']};
  if(mapped[lower]){const [to,cls]=mapped[lower];if(close)return `\n\n</${to}>\n\n`;return `\n\n<${to}${cls?` class="${cls}"`:''}>${self?`</${to}>`:''}\n\n`;}
  return tag;
 });
}
export function renderCourse(markdown,{sources=[],generated=false}={}){
 const issues=[];
 // Keep source code and formulas opaque while adapting historical components.
 const math=mathTemplates(String(markdown),md,escape,issues,{generated});
 let source=math.source;
 const scope={};
 source=source.replace(/\{@body[^\n]*\}/g,decl=>{
  const state=decl.match(/const \[(\w+),\w+\]\s*=\s*DIL\.useState\(([\s\S]*)\)\}$/);
  const assignment=decl.match(/const (\w+)\s*=\s*([\s\S]*)\}$/);
  try{if(state)scope[state[1]]=evaluate(state[2],scope);else if(assignment)scope[assignment[1]]=evaluate(assignment[2],scope);else throw new Error('Unknown state');}
  catch{issues.push({type:'component',message:'Original interactive state could not be interpreted.'});}
  return '';
 });
 // Preserve visible entity names instead of opaque ChatGPT entity identifiers.
 source=source.replace(/entity([\s\S]*?)/g,(_,raw)=>{try{return JSON.parse(raw)[1]||'';}catch{return '';}});
 source=source.replace(/(?:cite|memcite)[\s\S]*?/g,'〔来源见本课末尾〕').replace(/memcite/g,'');
 // Citation/Entity attributes are metadata, not executable expressions.
 source=source.replace(/<Cite\b[^>]*\/>/g,'<sup class="source-reference">〔来源见本课末尾〕</sup>');
 source=source.replace(/<Entity\b[^>]*\/>/g,tag=>escape(tag.match(/\bvalue="([^"]*)"/)?.[1]||''));
 source=source.replace(/\s+on[A-Z]\w*=\{[^}]*\}/g,'');
 try{source=expand(source,scope,issues);}catch{issues.push({type:'component',message:'An original component could not be adapted; source text preserved.'});}
 source=normalizeTags(source,issues);
 let html=sanitizeHtml(md.render(math.restoreCode(source)),{
  allowedTags:[...sanitizeHtml.defaults.allowedTags,'details','summary','svg','path','circle','rect','line','polyline','polygon','text','g','aside','small','sup','sub'],
  allowedAttributes:{'*':['class'],a:['href','title','target','rel'],svg:['viewBox','viewbox','width','height','xmlns','role','aria-label'],path:['d','fill','stroke','stroke-width','opacity'],rect:['x','y','width','height','rx','fill','fill-opacity','stroke','stroke-opacity','stroke-width','opacity'],circle:['cx','cy','r','fill','stroke','stroke-width','opacity'],line:['x1','y1','x2','y2','stroke','stroke-width'],polyline:['points','fill','stroke','stroke-width'],polygon:['points','fill','stroke'],text:['x','y','dx','dy','fill','font-size','font-family','text-anchor'],g:['transform','fill','stroke'],td:['colspan','rowspan'],th:['colspan','rowspan']},
  allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,parser:{lowerCaseTags:false,lowerCaseAttributeNames:false},
  transformTags:{
   a:(tagName,attribs)=>({tagName,attribs:{...attribs,rel:'noopener noreferrer'}}),
   '*':(tagName,attribs)=>({
    tagName,
    attribs:Object.fromEntries(Object.entries(attribs).map(([key,value])=>[key,math.restoreAttribute(value)])),
   }),
  },
  textFilter:math.renderText,
 });
 const links=sources.filter(s=>{try{return ['https:','http:'].includes(new URL(s.url).protocol);}catch{return false;}});
 if(links.length)html+='<section class="source-links"><h3>原对话关联来源</h3><ul>'+links.map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title||s.url)}</a></li>`).join('')+'</ul></section>';
 return {html,issues,mathCount:math.count()};
}
