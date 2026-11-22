import test from 'node:test';
import assert from 'node:assert/strict';
const {renderCourse = () => ({html:'',issues:[]})} = await import('../scripts/render-course.mjs').catch(() => ({}));

test('renders original math into KaTeX without losing backslashes', () => {
  const {html,issues} = renderCourse(String.raw`收益 \\(x^2\\) 与公式：\n\\[\\frac{1}{2}\\]`.replaceAll('\\\\','\\'));
  assert.match(html,/class="katex/);
  assert.equal(issues.length,0);
});
test('reports invalid formula rather than silently publishing broken math', () => {
  assert.ok(renderCourse(String.raw`\\[\\notARealCommand{x}\\]`.replaceAll('\\\\','\\')).issues.some(i=>i.type==='math'));
});
test('preserves original quiz choices and reveals only correct feedback branch', () => {
  const source = `{@body const [answer,setAnswer] = DIL.useState("none")}\n<radio-group><radio value="a">16</radio><radio value="b">32</radio></radio-group>\n{#if answer!=="none"}{#if answer==="a"}<text color="success">正确。</text>{:else}再试试{/if}A 的损失为 16。{/if}`;
  const {html,issues}=renderCourse(source);
  assert.match(html,/<details/);assert.match(html,/16/);assert.match(html,/32/);
  assert.match(html,/A 的损失为 16/);assert.doesNotMatch(html,/再试试|DIL|#if/);
  assert.equal(issues.length,0);
});
test('expands source chart loops without executing JavaScript', () => {
  const {html,issues}=renderCourse('{#each [{label:"Pilot",v:3.6},{label:"完美信息",v:12}] as item}<text>{item.label}：{item.v} 万</text>{/each}');
  assert.match(html,/Pilot：3.6 万/);assert.match(html,/完美信息：12 万/);assert.equal(issues.length,0);
});
test('removes executable HTML, event attributes and unsafe URLs', () => {
  const {html}=renderCourse('<script>globalThis.compromised=true</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">点我</a>');
  assert.doesNotMatch(html,/script|onerror|javascript:/);assert.equal(globalThis.compromised,undefined);
});
test('never evaluates arbitrary source calls and flags unsupported expressions', () => {
  const {issues}=renderCourse('{globalThis.process.exit(1)}');
  assert.ok(issues.some(i=>i.type==='component'));
});
test('keeps original source links separate from unresolved citation markers', () => {
  const {html}=renderCourse('某个事实<Cite refs={["turn123search0"]}/>',{sources:[{url:'https://example.org/paper',title:'原对话关联来源'}]});
  assert.match(html,/https:\/\/example.org\/paper/);assert.match(html,/原对话关联来源/);
  assert.doesNotMatch(html,/turn123search0/);
});
test('retains both original option explanations when neither is marked correct', () => {
 const {html}=renderCourse('{@body const [choice,setChoice] = DIL.useState("a")}\n{#if choice==="a"}选 A 的原文{:else}选 B 的原文{/if}');
 assert.match(html,/选 A 的原文/);assert.match(html,/选 B 的原文/);
});

test('renders math in text without changing link metadata or impersonating a source marker', () => {
 const {html,issues} = renderCourse('[link](https://example.org "Formula \\(x\\)")\n\nMATHRENDERTOKEN0END Actual \\(y\\).');
 assert.match(html,/<a href="https:\/\/example\.org" title="Formula \\\(x\\\)"[^>]*>link<\/a>/);
 assert.match(html,/MATHRENDERTOKEN0END Actual <span class="katex"/);
 assert.equal((html.match(/class="katex"/g)||[]).length,1);
 assert.equal(issues.length,0);
});

test('keeps literal dollar replacements while inserting mathematical HTML', () => {
 const {html,issues} = renderCourse('\\(\\text{\\$\\&}\\)');
 assert.match(html,/<mtext>\$&amp;<\/mtext>/);
 assert.equal(issues.length,0);
});

test('reports unclosed and unexpected math delimiters without dropping their backslashes', () => {
 for (const source of ['Here \\(x', 'Here \\[x', 'Here $$x', 'Here x\\]']) {
  const {html,issues} = renderCourse(source);
  assert.ok(issues.some(({type})=>type==='math'),source);
  assert.ok(html.includes(source),html);
 }
});

test('treats delimiters inside fenced and inline code as literal text', () => {
 const {html,issues} = renderCourse('Inline `\\(x\\)`.\n\n~~~tex\n\\(x\n~~~');
 assert.match(html,/<code>\\\(x\\\)<\/code>/);
 assert.doesNotMatch(html,/class="katex"/);
 assert.equal(issues.length,0);
});

test('keeps indented math inside historical layout components visible', () => {
 const {html,issues} = renderCourse('<box>\n\n    $$\n    x^2\n    $$\n\n</box>');
 assert.match(html,/class="katex"/);
 assert.equal(issues.length,0);
});

test('does not treat template expressions in historical components as Markdown code', () => {
 const source='{#each [{v:2}] as item}<box width={`*${item.v*10}%`}>示例</box>{/each}';
 const {html,issues}=renderCourse(source);
 assert.match(html,/示例/);
 assert.equal(issues.length,0);
});
