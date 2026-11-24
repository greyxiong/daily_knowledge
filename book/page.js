const examples = JSON.parse(document.querySelector('#examples').textContent);
const surface = document.getElementById('card');
const sections = document.querySelectorAll('#sections section');
let position = 0;

function turn(step) {
  position = (position + step + examples.length) % examples.length;
  const card = examples[position];
  document.getElementById('position').textContent = (position + 1) + ' / ' + examples.length;
  sections[0].querySelector('h3').textContent = '什么是「' + card.title + '」';
  for (const [index, field] of ['definition', 'intuition', 'example'].entries()) {
    sections[index].querySelector('p').textContent = card[field];
  }
  document.getElementById('full').href = '/topics/lesson-' + card.day + '.html';
}
document.getElementById('back').addEventListener('click', () => turn(-1));
document.getElementById('next').addEventListener('click', () => turn(1));
const themes = document.querySelectorAll('[data-theme]');
for (const button of themes) {
  button.addEventListener('click', () => {
    surface.dataset.look = button.dataset.theme;
    for (const option of themes) {
      option.setAttribute('aria-pressed', String(option === button));
    }
  });
}
