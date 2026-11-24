import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fieldContent, desktopFeed} from '../scripts/topics/field-guides.mjs';

test('all field guides have unique deep links, a worked exercise and a matching desktop card', () => {
  const {cards,groups} = fieldContent(s => s);
  const lessons = groups.flatMap(g => g.paths.flatMap(p => p.lessons));
  assert.equal(new Set(lessons.map(l => l.slug)).size, lessons.length);
  assert.deepEqual(lessons.map(l=>l.slug), cards.map(c=>c.slug));
  for (const l of lessons) {
    assert.ok(l.bodyHtml.includes('<details') && l.bodyHtml.includes('href="https://'));
  }
});

test('a newly published daily card joins the desktop feed without renumbering any guide', () => {
  const {cards} = fieldContent(s => s);
  const catalog = JSON.parse(fs.readFileSync('data/lesson-index.json','utf8'));
  const course = {day:catalog.length+1,chineseName:'新概念',card:{definition:'定义',intuition:'直觉',example:'例子'}};
  const feed = desktopFeed([...catalog,course],cards);
  assert.deepEqual(feed.cards.at(-1), {day:course.day,title:'新概念',group:'每日新课',...course.card});
  assert.equal(new Set(feed.cards.map(c => c.slug || c.day)).size, feed.cards.length);
});
