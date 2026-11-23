// Paths follow the questions addressed by the original lessons. IDs stay stable
// when articles move between paths; the personal edition still uses Day order.
export const domains = [
  {id: 'systems', title: '系统思维', paths: [
    ['怎样看懂一个系统，找到值得改变的地方？', [1, 2, 3, 4, 5, 6]],
    ['系统为什么会堵，又为什么很难改变？', [39, 40, 31, 38]],
  ]},
  {id: 'probability', title: '概率与判断', paths: [
    ['线索出现后，我该相信什么？', [7, 8, 9, 10]],
    ['如何校准对证据的判断？', [33, 32, 55, 56, 49]],
    ['如何比较有波动的结果？', [34, 57, 61, 62]],
  ]},
  {id: 'behavior', title: '认知与行为', paths: [
    ['什么会悄悄改变我的判断？', [18, 19, 20, 21, 22, 23]],
    ['怎样检查自己的推理？', [11, 24, 25]],
  ]},
  {id: 'incentives', title: '博弈与激励', paths: [
    ['怎样设计让人愿意做对事情的规则？', [12, 26, 27, 28]],
    ['规则改变后，参与者会怎样回应？', [29, 30, 50, 51]],
  ]},
  {id: 'decisions', title: '经济与决策', paths: [
    ['下一份资源值得投在哪里？', [13, 14, 15, 16]],
    ['先试、再决定，值多少钱？', [67, 68, 69]],
  ]},
  {id: 'risk', title: '风险与韧性', paths: [
    ['怎样承受损失并保留上行空间？', [35, 36, 37, 17, 41, 42, 43]],
    ['极端事件怎样影响长期决策？', [58, 59, 63, 64, 66, 65]],
  ]},
  {id: 'causality', title: '因果与模型', paths: [
    ['多个判断合起来会更可靠吗？', [46, 47, 48]],
    ['观察到的差异是谁造成的？', [52, 53, 54]],
  ]},
  {id: 'learning', title: '实验与学习', paths: [
    ['什么时候值得花资源去探索？', [44, 45, 60]],
    ['怎样一边试验，一边做选择？', [70, 71, 72]],
  ]},
];

const byModule = {
  '系统思维':'systems', '系统与韧性':'systems', '概率与不确定性':'probability',
  '认知偏差':'behavior', '博弈与激励':'incentives', '决策与经济学':'decisions',
  '风险与决策':'risk', '因果推断':'causality', '信息与模型':'causality',
  '概率、风险与学习':'learning', '统计学与决策科学':'learning',
};

export function buildDomains(courses) {
  const byDay = new Map(courses.map(course => [course.day, course]));
  const assigned = new Set();
  const result = domains.map(domain => ({...domain, paths: domain.paths.map(([title, days]) => ({
    title, lessons: days.map(day => {
      if (!byDay.has(day) || assigned.has(day)) throw new Error('Invalid reading path for lesson ' + day);
      assigned.add(day);
      return byDay.get(day);
    }),
  }))}));
  // Newly published courses appear immediately, even before editorial sequencing.
  for (const course of courses.filter(item => !assigned.has(item.day))) {
    const id = byModule[course.module] || 'more';
    let domain = result.find(item => item.id === id);
    if (!domain) {
      domain = {id, title: '跨学科专题', paths: []};
      result.push(domain);
    }
    let path = domain.paths.find(item => item.title === '延伸阅读');
    if (!path) {
      path = {title: '延伸阅读', lessons: []};
      domain.paths.push(path);
    }
    path.lessons.push(course);
  }
  return result;
}
