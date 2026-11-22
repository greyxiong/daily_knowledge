import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checksum} from '../scripts/generation/store.mjs';
import {publishReviewedCourse} from '../scripts/publish-reviewed-course.mjs';
const url='https://example.org/research';
const now=new Date('2026-11-22T04:00:00Z');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'subscription-course-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'data'));
 const records=JSON.parse(await readFile(new URL('../data/lesson-index.json',import.meta.url),'utf8')).slice(0,70);
 await mkdir(join(root,'content','lessons'),{recursive:true});
 for(const entry of records)await cp(new URL('../'+entry.path,import.meta.url),join(root,entry.path));
 const original=JSON.stringify(records,null,2)+'\n';
 await writeFile(join(root,'data/lesson-index.json'),original);
 const statement='原始论文比较了不同探索算法。';
 const markdown=`# 每日认知模型 #71：汤普森采样（Thompson Sampling）

## 定义
从后验分布采样并选择预期收益最大的选项。

## 直觉与数学
使用贝叶斯后验更新，例如 \\(p=0.5\\)。

## 真实案例
${statement} [论文](${url})

## 工作和生活应用
先在有限且安全的候选集中尝试。

## 与旧模型的连接
Day 70 多臂老虎机问题提出资源分配问题。
Day 68 贝叶斯决策理论提供更新概率的机制。

## 常见误区
抽样参数不等于真实成功概率。

## 小练习
观察成功一次，该怎样更新成功计数？

## 答案解析
成功计数增加一。

## 参考资料
[论文](${url})：支持案例中的研究比较。
`;
 const bundle={date:'2026-11-22',indexSha256:checksum(original),reviewedDraftSha256:checksum(markdown),
  researchedUrls:[url],openedUrls:[url],
  research:{day:71,chineseName:'汤普森采样',englishName:'Thompson Sampling',module:'统计学与决策科学',discipline:'机器学习',novelty:'后验采样替代固定探索概率',connectionDays:[70,68],evidence:[{id:'paper',url,title:'原始论文',summary:statement}]},
  draft:{markdown,claims:[{id:'comparison',statement,evidenceIds:['paper']}]},
  critique:{approved:true,distinctTopic:true,connectionsAccurate:true,completeAndAccurate:true,allCriticalClaimsListed:true,findings:[],claims:[{id:'comparison',supported:true,supportingUrls:[url]}]}};
 return {root,original,bundle};
}
test('subscription preview and publication require no inference call or API key',async t=>{
 const {root,original,bundle}=await fixture(t);
 const fetch=globalThis.fetch;
 globalThis.fetch=()=>{assert.fail('Subscription importer must never call a model API');};
 t.after(()=>{globalThis.fetch=fetch;});
 const preview=await publishReviewedCourse({root,bundle,now,dryRun:true});
 assert.equal(preview.status,'dry-run');
 assert.equal(await readFile(join(root,'data/lesson-index.json'),'utf8'),original);
 const result=await publishReviewedCourse({root,bundle,now});
 assert.equal(result.status,'published');assert.equal(result.day,71);
 assert.equal(await readFile(join(root,result.path),'utf8'),bundle.draft.markdown);
 const repeated=await publishReviewedCourse({root,bundle,now});
 assert.equal(repeated.status,'existing');assert.equal(repeated.day,71);
 assert.equal(JSON.parse(await readFile(join(root,'data/lesson-index.json'),'utf8')).length,71);
});
test('stale or rejected subscription reviews never modify the index',async t=>{
 for(const error of ['stale-index','stale-draft','rejected','unopened']){
  const {root,original,bundle}=await fixture(t);
  let code;
  if(error==='stale-index'){bundle.indexSha256='a'.repeat(64);code='STALE_REVIEW_BUNDLE';}
  if(error==='stale-draft'){bundle.draft.markdown+='Changed after review.';code='STALE_REVIEW_BUNDLE';}
  if(error==='rejected'){bundle.critique.approved=false;code='REVIEW_REJECTED';}
  if(error==='unopened'){bundle.openedUrls=[];code='UNVERIFIED_EVIDENCE';}
  await assert.rejects(publishReviewedCourse({root,bundle,now}),{code});
  assert.equal(await readFile(join(root,'data/lesson-index.json'),'utf8'),original);
 }
});
