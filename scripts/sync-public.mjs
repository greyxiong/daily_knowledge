import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadCatalog} from './validate-courses.mjs';
import {renderCourse} from './render-course.mjs';
const root=process.cwd(), publicDir=path.join(root,'public');
const issues=[];
const catalog=loadCatalog(root);
const courses=catalog.courses.map(({body,...entry})=>{
 const displayBody=body.replace(/^# [^\n]+\n?/, '');
 const generated=entry.source==='generated';
 const {html,issues:renderIssues}=renderCourse(displayBody,{sources:generated?[]:entry.sources,generated});
 if(entry.source==='generated'&&renderIssues.length)throw new Error('Generated course failed rendering validation.');
 if(renderIssues.length)issues.push({day:entry.day,issues:renderIssues});
 return {...entry,bodyHtml:html,searchText:body};
});
fs.rmSync(publicDir,{recursive:true,force:true});
fs.mkdirSync(path.join(publicDir,'data'),{recursive:true});
fs.copyFileSync(path.join(root,'index.html'),path.join(publicDir,'index.html'));
const json=JSON.stringify(courses);
fs.writeFileSync(path.join(root,'data/courses.json'),json+'\n');
fs.writeFileSync(path.join(publicDir,'data/courses.json'),json+'\n');
fs.writeFileSync(path.join(root,'data/render-report.json'),JSON.stringify(issues,null,2)+'\n');
fs.mkdirSync(path.join(publicDir,'assets'),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/katex/dist/katex.min.css'),path.join(publicDir,'assets/katex.min.css'));
fs.copyFileSync(path.join(root,'node_modules/katex/LICENSE'),path.join(publicDir,'assets/katex-LICENSE.txt'));
fs.cpSync(path.join(root,'node_modules/katex/dist/fonts'),path.join(publicDir,'assets/fonts'),{recursive:true});
fs.mkdirSync(path.join(publicDir,'content'),{recursive:true});
fs.mkdirSync(path.join(publicDir,'content/lessons'),{recursive:true});
for(const course of courses)fs.copyFileSync(path.join(root,course.path),path.join(publicDir,course.path));
for(const version of catalog.archivedVersions){
 const output=path.join(publicDir,version.path);
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,version.body);
}

function gitRevision(){
 try {
  return execFileSync('git',['rev-parse','--verify','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 } catch {
  return undefined;
 }
}
const commit=process.env.VERCEL_GIT_COMMIT_SHA || gitRevision();
if(commit){
 if(!/^[0-9a-f]{40}$/.test(commit))throw new Error('Invalid build commit SHA.');
 const lessons=courses.map(({day,sha256})=>({day,sha256}));
 fs.writeFileSync(path.join(publicDir,'deployment.json'),JSON.stringify({commit,lessons})+'\n');
}
console.log(`Built ${courses.length} complete lessons. ${issues.length} historical presentation limitations recorded.`);
