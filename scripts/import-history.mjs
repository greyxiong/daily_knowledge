import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const pad = n => String(n).padStart(3,'0');
const group = day => day<=6?'系统思维':day<=10?'概率与不确定性':day<=17?'决策与经济学':day<=26?'认知偏差':day<=30?'博弈与激励':day<=38?'风险与决策':day<=43?'系统与韧性':day<=51?'信息与模型':day<=54?'因果推断':'概率、风险与学习';
function sourcesFor(message) {
 const urls = new Set();
 function visit(value) {
  if(typeof value==='string' && /^https?:\/\//.test(value)) {
   try {const u=new URL(value);if(!/(^|\.)images\.openai\.com$/.test(u.hostname)&&!u.hostname.endsWith('usercontent.com')){u.searchParams.delete('utm_source');urls.add(u.href);}}catch{}
  }else if(Array.isArray(value))value.forEach(visit);
  else if(value&&typeof value==='object')Object.values(value).forEach(visit);
 }
 visit(message.references||[]);visit(message.citations||[]);
 return [...urls].map(url=>({url,title:new URL(url).hostname}));
}
export function importHistory(transcript,root) {
 const versions=new Map();
 for(const message of transcript.messages||[]) {
  if(message.role!=='assistant')continue;
  const body=(message.content?.parts||[]).filter(p=>typeof p==='string').join('\n');
  const heading=body.match(/^#\s+每日认知模型\s*[#＃](\d+)[：:]([^\n]+)/);
  if(!heading)continue;
  const day=Number(heading[1]);if(day<1||day>70)continue;
  const title=heading[2].trim();
  const name=title.match(/^(.*?)（([^）]+)）\s*$/);
  const entry={day,title,chineseName:name?.[1]||title,englishName:name?.[2]||'',module:group(day),discipline:group(day),path:`content/lessons/day-${pad(day)}.md`,sha256:sha256(body),source:'history',messageId:message.id,publishedOn:message.create_time?new Date(message.create_time*1000+8*3600*1000).toISOString().slice(0,10):null,sources:sourcesFor(message)};
  const list=versions.get(day)||[];list.push({entry,body});versions.set(day,list);
 }
 const index=[];const duplicates=[];
 for(const [day,list] of [...versions].sort(([a],[b])=>a-b)) {
  const latest=list.at(-1);const full=path.join(root,latest.entry.path);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,latest.body);
  index.push(latest.entry);
  for(let i=0;i<list.length-1;i++) {
   const versionPath=`content/versions/day-${pad(day)}-v${i+1}.md`;fs.mkdirSync(path.join(root,'content/versions'),{recursive:true});fs.writeFileSync(path.join(root,versionPath),list[i].body);
   duplicates.push({day,path:versionPath,sha256:list[i].entry.sha256,messageId:list[i].entry.messageId,selectedMessageId:latest.entry.messageId});
  }
 }
 fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data/lesson-index.json'),JSON.stringify(index,null,2)+'\n');
 const missing=Array.from({length:70},(_,i)=>i+1).filter(d=>!versions.has(d));
 const report={courseCount:index.length,missing,duplicates,policy:'Exact source bodies; last conversation-order version selected; prior versions preserved. Only course texts and public source URLs are exported.',limitations:['ChatGPT-specific citation identifiers cannot be reliably matched one-to-one to returned source URLs; related source URLs are listed without claiming a precise mapping.','Original image binaries and attachments were not downloaded. Component adaptation is a presentation transform, never a source-text edit.']};
 fs.writeFileSync(path.join(root,'data/migration-report.json'),JSON.stringify(report,null,2)+'\n');
 return index;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw new Error('Provide the private transcript path; it must remain outside the repository.');
 const root=process.cwd(), source=path.resolve(process.argv[2]);
 if(source.startsWith(root+path.sep))throw new Error('Private transcript must be outside the public repository.');
 const index=importHistory(JSON.parse(fs.readFileSync(source,'utf8')),root);
 if(index.length!==70)throw new Error('Historical coverage is incomplete; inspect data/migration-report.json.');
 console.log(`Imported ${index.length} historical courses without rewriting source bodies.`);
}
