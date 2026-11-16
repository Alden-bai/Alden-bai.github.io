import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { codeHighlight } from '../docs/.vitepress/code-highlight.mjs'
import { mathCompatibility, mathOptions } from '../docs/.vitepress/math.mjs'

const md = await createMarkdownRenderer(resolve('docs'), {
  math: mathOptions,
  lineNumbers: true,
  codeCopyButtonTitle: '复制代码',
  config: md => md.use(mathCompatibility).use(codeHighlight)
})
const fence = (code, language = '') => '```' + language + '\n' + code + '\n```'
const cpp = '// 注释保持原样\nclass Solution {\npublic:\n  int answer() { return 42; }\n};'

test('未标注 C++ 使用默认双色主题，保留行号、复制按钮和代码内容', () => {
  const html = md.render(fence(cpp))
  assert.match(html, /class="language-cpp /)
  assert.match(html, /class="line-numbers-wrapper"/)
  assert.match(html, /title="复制代码" class="copy"/)
  assert.match(html, /--shiki-dark:/)
  for (const mode of ['light', 'dark']) {
    assert.ok(new Set([...html.matchAll(new RegExp('--shiki-' + mode + ':([^;" ]+)', 'g'))].map(m => m[1])).size >= 3)
  }
  const displayed = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)[1].replace(/<[^>]*>/g, '')
  assert.equal(displayed.trimEnd(), cpp)
})

test('头文件、结构体、带类型函数和明确 C++ 语句能自动高亮', () => {
  for (const code of [
    '#include <bits/stdc++.h>\nint main() { return 0; }',
    '#include "tree.h"',
    'struct TreeNode {\n  int val;\n};',
    'bool cmp(ListNode* a, ListNode* b) { return a->val < b->val; }',
    'vector<int> result;', 'int count = 0;',
    'std::cout << "hello";', 'reverse(first, last);'
  ]) assert.match(md.render(fence(code)), /class="language-cpp /, code)
})

test('显式语言与围栏选项优先，不改写 token 内容', () => {
  for (const language of ['cpp', 'c++', 'python', 'text', 'mermaid']) {
    const token = md.parse(fence(cpp, language), {}).find(t => t.type === 'fence')
    assert.equal(token.info, language)
    assert.equal(token.content, cpp + '\n')
  }
  assert.doesNotMatch(md.render(fence(cpp, 'text')), /--shiki-dark:|language-cpp/)
  assert.match(md.render(fence('print("hello")', 'python')), /language-python/)
  assert.match(md.render(fence(cpp, 'cpp {2}')), /class="line highlighted"/)
})

test('纯文字、流程图、空块和不确定表达式不推断语言', () => {
  for (const code of [
    '', 'Agent\n  ↓\nTerminal Reward', '当前位置的水量 = 水面高度 - 柱子高度',
    'matrix[i][j]', 'dp[i] = min(dp[i], dp[i - j*j] + 1)',
    'class Example {\n  run() {}\n}', 'def solve():\n    return 42',
    '// int example = 0;', '/*\n#include <iostream>\n*/',
    '"int example = 0;"', '/*\n#include "tree.h"\n*/'
  ]) {
    const token = md.parse(fence(code), {}).find(t => t.type === 'fence')
    assert.equal(token.info, '', code)
    assert.equal(token.content, code ? code + '\n' : '\n')
  }
})

test('嵌套代码块高亮，行内代码、缩进代码和正文保持原语义', () => {
  assert.match(md.render('> ' + fence(cpp).replaceAll('\n', '\n> ')), /language-cpp/)
  assert.match(md.render('- 示例\n\n  ' + fence(cpp).replaceAll('\n', '\n  ')), /language-cpp/)
  const html = md.render('`int answer = 42;`\n\n    int answer = 42;\n\n正文 $x_i$')
  assert.doesNotMatch(html, /language-cpp/)
  assert.match(html, /<mjx-container/)
})

test('现有两篇刷题笔记的完整 C++ 解答全部高亮', () => {
  for (const name of ['hot100', 'csp刷题']) {
    const path = resolve('docs/notes/力扣刷题', name + '.md')
    const source = readFileSync(path, 'utf8')
    const blocks = md.parse(source, { path }).filter(t => t.type === 'fence')
    const solutions = blocks.filter(t => /class\s+\w+\s*\{|#include\s*</.test(t.content))
    assert.ok(solutions.length > 0, path)
    for (const token of solutions) assert.ok(['cpp', 'c++'].includes(token.info), path + ':' + token.map[0])
  }
})
