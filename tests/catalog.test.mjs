import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {loadCourses=()=>[]} = await import('../scripts/validate-courses.mjs').catch(()=>({}));
test('validates all recovered historical courses and their exact hashes',()=>{
 const index=JSON.parse(fs.readFileSync('data/lesson-index.json','utf8'));
 const result=loadCourses(process.cwd());assert.ok(result.length>=70);assert.equal(result[69].day,70);assert.equal(result[69].source,'history');
 assert.equal(index.every(c=>c.sha256.length===64),true);
});
test('rejects body tampering instead of silently changing historical courses',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'course-tamper-'));
 try{
  fs.cpSync('data',path.join(root,'data'),{recursive:true});fs.cpSync('content',path.join(root,'content'),{recursive:true});
  fs.appendFileSync(path.join(root,'content/lessons/day-001.md'),'\n篡改');
  assert.throws(()=>loadCourses(root),/hash|integrity/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('refuses a changed historical archive before a build can publish it',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'course-archive-tamper-'));
 try{
  fs.cpSync('data',path.join(root,'data'),{recursive:true});fs.cpSync('content',path.join(root,'content'),{recursive:true});
  fs.appendFileSync(path.join(root,'content/versions/day-001-v1.md'),'\n篡改');
  assert.throws(()=>loadCourses(root),/archive.*hash|version.*hash/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('the build emits the Vercel revision and exact hashes of the public lesson index',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'course-manifest-build-'));
 const revision='a'.repeat(40);
 try{
  for(const name of ['data','content','index.html'])fs.cpSync(name,path.join(root,name),{recursive:true});
  fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
  execFileSync(process.execPath,[path.resolve('scripts/sync-public.mjs')],{
   cwd:root,env:{...process.env,VERCEL_GIT_COMMIT_SHA:revision},stdio:'pipe',
  });
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/deployment.json'),'utf8'));
  assert.equal(manifest.commit,revision);
  const index=JSON.parse(fs.readFileSync(path.join(root,'data/lesson-index.json'),'utf8'));
  assert.deepEqual(manifest.lessons,index.map(({day,sha256})=>({day,sha256})));
  const archive=fs.readFileSync(path.join(root,'public/content/versions/day-001-v1.md'));
  assert.equal(createHash('sha256').update(archive).digest('hex'),'b425552c90252eb7e85a6b3882f481ca53dca62c04eadabc8f869d1f1f0ac59d');
  assert.deepEqual(fs.readFileSync(path.join(root,'public/assets/katex-LICENSE.txt')),fs.readFileSync('node_modules/katex/LICENSE'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
