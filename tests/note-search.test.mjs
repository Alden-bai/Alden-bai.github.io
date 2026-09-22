import test from 'node:test'
import assert from 'node:assert/strict'
import { createMarkdownRenderer } from 'vitepress'
import { renderNoteSearch } from '../docs/.vitepress/note-search.mjs'

const md = await createMarkdownRenderer(process.cwd())
test('带外部链接的题目标题能被 VitePress 搜索提取，正文链接不变', () => {
  const source = '## [1. 两数之和](https://leetcode.cn/problems/two-sum/)\n\n[题目](https://leetcode.cn/problems/two-sum/)\n\n```cpp\nreturn {};\n```'
  const html = renderNoteSearch(source, { relativePath: 'notes/力扣刷题/hot100.md' }, md)
  assert.match(html, /<h1>hot100/)
  const h2 = html.match(/<h2\b[^>]*>(.*?)<\/h2>/)?.[1]
  assert.match(h2, /^1\. 两数之和 /)
  assert.doesNotMatch(h2, /href="https:\/\/leetcode/)
  assert.match(h2, /href="#_1-两数之和"/)
  assert.match(html, /<a href="https:\/\/leetcode.cn\/problems\/two-sum\/"/)
  assert.match(md.render(source), /<h2[^>]*><a href="https:\/\/leetcode/)
})

test('已有一级标题和明确关闭搜索的文章保持原有行为', () => {
  const html = renderNoteSearch('# 我的笔记\n\n正文', { relativePath: 'notes/test.md' }, md)
  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.equal(renderNoteSearch('---\nsearch: false\n---\n# 私人草稿', {}, md), '')
})
