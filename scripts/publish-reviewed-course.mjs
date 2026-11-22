import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderCourse} from './render-course.mjs';
import {checkResearch,checkDraft,checkCritique,modelIndex,upcomingTopics} from './generation/lesson.mjs';
import {GenerationError} from './generation/responses.mjs';
import {checksum,lessonPath,publicationDate,publishLesson,readPublication,withPublicationLock,writePreview} from './generation/store.mjs';

// Inference and actual source reading belong to the signed-in Codex task.
// This importer validates the task's review bundle without calling a model API.
export async function publishReviewedCourse({bundle,root=fileURLToPath(new URL('../',import.meta.url)),now=new Date(),dryRun=false,allowEarly=false}={}){
 if(!bundle || !Array.isArray(bundle.researchedUrls) || !Array.isArray(bundle.openedUrls)){
  throw new GenerationError('INVALID_REVIEW_BUNDLE','validate');
 }
 const date=publicationDate(now,bundle.date,allowEarly);
 async function run(){
  const publication=await readPublication(root);
  const existing=publication.records.find(x=>x.source==='generated' && x.publishedOn===date);
  if(existing)return {status:'existing',day:existing.day,date,path:existing.path};
  if(bundle.indexSha256!==checksum(publication.original) || typeof bundle.draft?.markdown!=='string' ||
     bundle.reviewedDraftSha256!==checksum(bundle.draft.markdown))throw new GenerationError('STALE_REVIEW_BUNDLE','validate');
  const day=publication.records.length+1;
  const index=modelIndex(publication.records);
  const research=checkResearch(bundle.research,new Set(bundle.researchedUrls),index,upcomingTopics(index,day),day);
  const {title,sources,mathSection}=checkDraft(bundle.draft,research,index);
  const rendered=renderCourse(bundle.draft.markdown,{generated:true});
  if(!rendered.html.trim() || rendered.issues.length || !renderCourse(mathSection,{generated:true}).mathCount){
   throw new GenerationError('RENDER_REJECTED','validate');
  }
  checkCritique(bundle.critique,new Set(bundle.openedUrls),bundle.draft,research);
  if(dryRun)return {status:'dry-run',day,date,path:await writePreview(root,day,date,bundle.draft.markdown)};
  const path=lessonPath(day);
  const {chineseName,englishName,module,discipline}=research;
  await publishLesson(root,publication,{day,title,chineseName,englishName,module,discipline,path,
   sha256:checksum(bundle.draft.markdown),source:'generated',publishedOn:date,sources},bundle.draft.markdown);
  return {status:'published',day,date,path};
 }
 return dryRun?run():withPublicationLock(root,run);
}
async function main(){
 try{
  const {values}=parseArgs({options:{bundle:{type:'string'},'dry-run':{type:'boolean'},'allow-early':{type:'boolean'}}});
  if(!values.bundle)throw new GenerationError('MISSING_REVIEW_BUNDLE','configuration');
  const bytes=await readFile(values.bundle);
  if(bytes.length>350_000)throw new GenerationError('INVALID_REVIEW_BUNDLE','validate');
  const result=await publishReviewedCourse({bundle:JSON.parse(bytes),dryRun:values['dry-run'],allowEarly:values['allow-early']});
  console.log(JSON.stringify(result));
 }catch(error){
  console.error(JSON.stringify({event:'subscription_publication_failed',code:error instanceof GenerationError?error.code:'INVALID_REVIEW_BUNDLE'}));
  process.exitCode=1;
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await main();
