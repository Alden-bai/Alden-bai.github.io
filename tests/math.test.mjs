import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { mathCompatibility, mathOptions } from '../docs/.vitepress/math.mjs'

const md = await createMarkdownRenderer(resolve('docs'), {
  math: mathOptions,
  config: md => md.use(mathCompatibility)
})
const render = source => md.render(source, { path: 'fixture.md' })

for (const [name, source, count] of [
  ['截图原始 GRPO 公式', String.raw`GRPO的advantage公式：\(A_i= \frac{ r_i-\operatorname{mean}(r_{\text{group}}) }{ \operatorname{std}(r_{\text{group}})+\epsilon }\)`, 1],
  ['四种定界符', String.raw`$x_i$、\(\theta\)、$$\frac{1}{2}$$、\[\sqrt{x}\]`, 4],
  ['容忍美元内部空格', '$ x_i $', 1],
  ['跨行块公式', String.raw`公式：
\[
\begin{aligned}
a &= b + c \\
d &= \frac{1}{2}
\end{aligned}
\]
后续正文`, 1],
  ['美元块公式', '$$\nx_i = 1\n$$\n\n后续正文', 1],
  ['单行块公式', String.raw`\[x_i = 1\]`, 1],
  ['列表和引用', String.raw`- 优势：\(A_i\)

  > \[
  > \frac{1}{2}
  > \]

  后续正文`, 2],
  ['块公式后接文字', String.raw`\[x_i\]：说明`, 1],
  ['表格和链接文字', String.raw`| 公式 | 说明 |
| --- | --- |
| \(x_i\) | $y_i$ |

[\(z_i\)](https://example.com)`, 3],
  ['HTML 和 Vue 字符', String.raw`\(x < y\) 与 \(\text{ {{value}} }\)`, 2]
]) {
  test(name, () => {
    const html = render(source)
    assert.equal((html.match(/<mjx-container\b/g) || []).length, count)
    assert.doesNotMatch(html, /data-mjx-error|<merror/)
    assert.match(html, /<svg\b/)
    if (source.includes('后续正文')) assert.match(html, /后续正文/)
  })
}

for (const [name, source] of [
  ['行内代码', '`\\(\\frac{1}{2}\\)` 和 `$HOME`'],
  ['围栏代码', '```tex\n\\[\\frac{1}{2}\\]\n$$\n```'],
  ['缩进代码', '    \\[\\frac{1}{2}\\]'],
  ['转义括号和美元', String.raw`\\(普通括号\\) 和 \$HOME，\$x`],
  ['货币', '价格 $5，优惠后 $3.50。'],
  ['链接地址', '[下载](https://example.com/$HOME)']
]) {
  test(`保留${name}`, () => assert.doesNotMatch(render(source), /<mjx-container\b/))
}

for (const [name, source] of [
  ['圆括号缺少闭合', String.raw`\(x_i`],
  ['方括号缺少闭合', '\\[\nx_i'],
  ['美元块缺少闭合', '$$\nx_i'],
  ['行内美元缺少闭合', '$x_i'],
  ['空公式', String.raw`\( \)`],
  ['大括号缺少闭合', String.raw`$\frac{1}{$`],
  ['未知命令', String.raw`$\thisCommandDoesNotExist{x}$`],
  ['原始 TeX', String.raw`公式：(A_i = \frac{r_i}{s})`]
]) {
  test(`拒绝${name}`, () => assert.throws(() => render(source), /\[公式检查\].*fixture\.md/))
}

test('真实笔记全部能渲染', () => {
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) check(path)
      else if (entry.name.endsWith('.md')) {
        const html = md.render(readFileSync(path, 'utf8'), { path })
        assert.doesNotMatch(html, /data-mjx-error|<merror/, path)
        if (entry.name.includes('PPO')) {
          assert.match(html, /<mjx-container\b/)
        }
      }
    }
  }
  check(resolve('docs/notes'))
})
