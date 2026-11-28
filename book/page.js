const examples = JSON.parse(document.querySelector('#examples').textContent);
const card = document.querySelector('#card');
const sections = card.querySelectorAll('#sections section');
const launcher = document.querySelector('#launcher');
const closeButton = document.querySelector('#close');
const restart = document.querySelector('#restart');
const tasks = [...document.querySelectorAll('.task')];
const initialStatus = tasks.map(task => task.querySelector('small').textContent);
const themeButtons = document.querySelectorAll('[data-theme]');
let position = 0;
let timers = [];
let started = false;

function turn(step) {
  position = (position + step + examples.length) % examples.length;
  const lesson = examples[position];
  document.querySelector('#position').textContent = (position + 1) + ' / ' + examples.length;
  sections[0].querySelector('h3').textContent = '什么是「' + lesson.title + '」';
  ['definition', 'intuition', 'example'].forEach((field, index) => {
    sections[index].querySelector('p').textContent = lesson[field];
  });
  document.querySelector('#full').href = '/topics/lesson-' + lesson.day + '.html';
}

function startDemo() {
  if (started) return;
  started = true;
  restart.hidden = false;
  tasks.forEach((task, index) => {
    timers.push(setTimeout(() => {
      task.classList.add('ready');
      task.querySelector('small').textContent = ['已找到车次', '已整理住处'][index];
    }, [9000, 18000][index]));
  });
}

function showCard(open) {
  launcher.hidden = open;
  card.hidden = !open;
  launcher.setAttribute('aria-expanded', String(open));
  document.querySelector('#try').setAttribute('aria-expanded', String(open));
  if (open) startDemo();
  (open ? closeButton : launcher).focus({preventScroll:true});
}

function readHere() {
  showCard(true);
  document.querySelector('#desk').scrollIntoView({block:'nearest'});
}
launcher.addEventListener('click', () => showCard(true));
closeButton.addEventListener('click', () => showCard(false));
document.querySelector('#try').addEventListener('click', event => {
  event.preventDefault();
  readHere();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !card.hidden && document.querySelector('#desk').contains(document.activeElement)) showCard(false);
});
document.querySelector('#back').addEventListener('click', () => turn(-1));
document.querySelector('#next').addEventListener('click', () => turn(1));
restart.addEventListener('click', () => {
  timers.forEach(clearTimeout);
  timers = [];
  started = false;
  tasks.forEach((task, index) => {
    task.classList.remove('ready');
    task.querySelector('small').textContent = initialStatus[index];
  });
  restart.hidden = true;
  showCard(false);
});
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    card.dataset.look = button.dataset.theme;
    launcher.querySelector('img').src = button.querySelector('img').src;
    launcher.querySelector('span').textContent = '点开' + button.textContent.trim();
    for (const option of themeButtons) option.setAttribute('aria-pressed', String(option === button));
    readHere();
  });
}
