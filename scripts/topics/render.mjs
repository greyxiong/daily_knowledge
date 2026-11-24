import fs from 'node:fs';
import path from 'node:path';
import {fieldContent, desktopFeed} from './field-guides.mjs';
import {buildDomains} from './paths.mjs';

const esc = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
const lessonURL = course => course.slug ? 'guide-' + course.slug + '.html' : 'lesson-' + course.day + '.html';
const domainURL = domain => domain.id + '.html';
const name = course => course.chineseName.replace(/（[^）]*）/gu, '');
const link = (url, label) => '<a href="' + esc(url) + '">' + esc(label) + '</a>';

function page(title, crumbs, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · 多元思维模型</title>
<link rel="stylesheet" href="/assets/katex.min.css">
<link rel="stylesheet" href="/assets/reading.css">
<link rel="stylesheet" href="topics.css"></head><body><main>
<nav aria-label="面包屑" class="crumbs">${crumbs}</nav>${body}
</main></body></html>`;
}

export function writeTopics(publicDir, courses) {
  const guides = fieldContent(esc);
  const groups = [...buildDomains(courses), ...guides.groups];
  const latest = courses.at(-1);
  const total = courses.length + guides.cards.length;
  const dir = path.join(publicDir, 'topics');
  fs.mkdirSync(dir, {recursive: true});
  fs.copyFileSync(new URL('./topics.css', import.meta.url), path.join(dir, 'topics.css'));
  const save = (file, html) => fs.writeFileSync(path.join(dir, file), html);
  save('cards.json', JSON.stringify(desktopFeed(courses, guides.cards)));
  save('latest.html', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>最新一课</title><meta http-equiv="refresh" content="0;url=' + lessonURL(latest) + '"><a href="' + lessonURL(latest) + '">' + esc(name(latest)) + '</a></html>');
  const home = link('/topics/', '领域目录');
  const tiles = groups.map(domain => {
    const count = domain.paths.reduce((n, p) => n + p.lessons.length, 0);
    return `<a class="tile" href="${domainURL(domain)}"><small>${count} 篇</small><h2>${esc(domain.title)}</h2><p>${esc(domain.paths[0].title)}</p></a>`;
  }).join('');
  save('index.html', page('领域目录', '多元思维模型 · ' + link('/book/', '桌面小书'), `<h1>按领域阅读</h1><p>共 ${total} 篇 · ${courses.length} 篇每日课程 · ${guides.cards.length} 篇专题短课</p>
<p>最新课程 · ${esc(latest.publishedOn)}　${link(lessonURL(latest), name(latest) + ' →')}</p><div class="tiles">` + tiles + '</div>'));
  for (const domain of groups) {
    const paths = domain.paths.map(p => `<section class="path"><h2>${esc(p.title)}</h2><ol>${p.lessons.map(c =>
      '<li>' + link(lessonURL(c), name(c)) + '</li>').join('')}</ol></section>`).join('');
    save(domainURL(domain), page(domain.title, home, '<h1>' + esc(domain.title) + '</h1>' + paths));
    for (const [pi, p] of domain.paths.entries()) {
      for (const [i, course] of p.lessons.entries()) {
        const prev = p.lessons[i-1], next = p.lessons[i+1], nextPath = domain.paths[pi+1];
        const forward = next ? link(lessonURL(next), '下一篇 · ' + name(next) + ' →')
          : nextPath ? link(lessonURL(nextPath.lessons[0]), '下一组 · ' + nextPath.title + ' →')
          : link('/topics/', '选择下一个领域 →');
        const article = `<article class="lesson"><header class="lesson-header"><div><p>${esc(p.title)} · ${i+1} / ${p.lessons.length}</p><h1>${esc(name(course))}</h1></div></header>
<div class="lesson-body">${course.bodyHtml}</div>
<nav class="lesson-nav" aria-label="推荐阅读顺序">${prev ? link(lessonURL(prev), '‹ ' + name(prev)) : link(domainURL(domain), '本领域目录')}${forward}</nav></article>`;
        save(lessonURL(course), page(name(course), home + ' / ' + link(domainURL(domain), domain.title), article));
      }
    }
  }
}
