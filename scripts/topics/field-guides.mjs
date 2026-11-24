import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(new URL('../../data/' + file, import.meta.url), 'utf8'));
export function fieldContent(esc) {
  const cards = [];
  const groups = read('field-guides.json').map(group => {
    const lessons = group.entries.map(entry => {
      const {id, title, definition, intuition, example, exercise, answer, limit, source, url} = entry;
      cards.push({slug:id, title, group:group.title, definition, intuition, example});
      const section = (heading, body) => '<h2>' + esc(heading) + '</h2><p>' + esc(body) + '</p>';
      const bodyHtml = section('什么是「' + title + '」', definition) + section('直觉理解', intuition)
        + section('一个例子', example) + section('适用边界', limit) + section('试着判断', exercise)
        + '<details class="source-answer"><summary>查看解析</summary><p>' + esc(answer) + '</p></details>'
        + '<p><a href="' + esc(url) + '">' + esc(source) + '</a></p>';
      return {slug:id, chineseName:title, bodyHtml};
    });
    return {id:group.id, title:group.title, paths:[{title:group.question, lessons}]};
  });
  return {cards, groups};
}

export function desktopFeed(courses, guides) {
  const {cards} = read('core-cards.json');
  const daily = courses.filter(c => c.card && !cards.some(card => card.day === c.day)).map(c => ({
    day:c.day, title:c.chineseName, group:'每日新课', ...c.card,
  }));
  return {cards:[...cards, ...guides, ...daily]};
}
