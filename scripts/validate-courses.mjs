import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

function loadArchivedVersions(root) {
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/migration-report.json'),'utf8'));
 const declared=report.duplicates;
 if(!Array.isArray(declared) || !declared.some(version=>version?.day===1 && version.path==='content/versions/day-001-v1.md')) {
  throw new Error('Missing declared Day 1 historical archive.');
 }
 const seen=new Set();
 return declared.map(version=>{
  const match=version?.path?.match(/^content\/versions\/day-(\d{3})-v[1-9]\d*\.md$/);
  if(!match || Number(match[1])!==version.day || seen.has(version.path) || !/^[0-9a-f]{64}$/.test(version.sha256)) {
   throw new Error('Invalid historical archive path or hash.');
  }
  seen.add(version.path);
  const body=fs.readFileSync(path.join(root,version.path));
  if(crypto.createHash('sha256').update(body).digest('hex')!==version.sha256) {
   throw new Error(`Historical archive hash mismatch for Day ${version.day}.`);
  }
  return {...version,body};
 });
}

export function loadCatalog(root=process.cwd()) {
 const index=JSON.parse(fs.readFileSync(path.join(root,'data/lesson-index.json'),'utf8'));
 if(!Array.isArray(index)||index.length<70)throw new Error('Historical baseline must contain Days 1–70.');
 const dates=new Set();
 const courses=index.map((entry,i)=>{
  if(entry.day!==i+1)throw new Error('Course days must be continuous and ordered.');
  for(const key of ['title','chineseName','module','discipline','path','sha256','source'])if(typeof entry[key]!=='string'||!entry[key])throw new Error('Invalid field: '+key);
  if(entry.path!==`content/lessons/day-${String(entry.day).padStart(3,'0')}.md`)throw new Error('Unexpected lesson path.');
  if(entry.day<=70&&entry.source!=='history')throw new Error('Historical baseline cannot be generated.');
  if(entry.day>70&&entry.source!=='generated')throw new Error('New lessons must have generated provenance.');
  const body=fs.readFileSync(path.join(root,entry.path),'utf8');
  const hash=crypto.createHash('sha256').update(body).digest('hex');
  if(hash!==entry.sha256)throw new Error(`Course ${entry.day} integrity hash mismatch.`);
  if(!body.startsWith('# 每日认知模型 #'+entry.day+'：'))throw new Error(`Course ${entry.day} heading mismatch.`);
  if(entry.source==='generated'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishedOn||''))throw new Error('Missing publication date.');
   if(dates.has(entry.publishedOn))throw new Error('Duplicate publication date.');dates.add(entry.publishedOn);
  }
  if(!Array.isArray(entry.sources))throw new Error('Missing source list.');
  for(const source of entry.sources)if(!/^https?:\/\//.test(source.url))throw new Error('Unsafe source URL.');
  return {...entry,body};
 });
 return {courses,archivedVersions:loadArchivedVersions(root)};
}

export function loadCourses(root=process.cwd()) {
 return loadCatalog(root).courses;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(`Validated ${loadCourses().length} courses and exact source hashes.`);
