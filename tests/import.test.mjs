import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const {importHistory = () => []} = await import('../scripts/import-history.mjs').catch(() => ({}));
test('imports exact course bodies, keeps versions and excludes private chat', () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'course-import-'));
 try {
  const first='# 每日认知模型 #1：反馈回路（Feedback Loop）\n\n原始正文 \\(x^2\\)。';
  const second=first+'\n补充原文。';
  const records=[{id:'private',role:'user',content:{parts:['私人笔记'],content_type:'text'}},{id:'v1',role:'assistant',content:{parts:[first],content_type:'text'}},{id:'v2',role:'assistant',content:{parts:[second],content_type:'text'}}];
  const index=importHistory({messages:records},root);
  assert.equal(index.length,1);assert.equal(index[0].messageId,'v2');
  assert.equal(fs.readFileSync(path.join(root,index[0].path),'utf8'),second);
  assert.equal(fs.readFileSync(path.join(root,'content/versions/day-001-v1.md'),'utf8'),first);
  assert.doesNotMatch(JSON.stringify(index),/私人笔记/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
