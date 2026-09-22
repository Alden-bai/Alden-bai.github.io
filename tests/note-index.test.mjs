import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { collectNotebook, createNotebookNavigation } from '../docs/.vitepress/note-index.mjs'

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'note-index-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [file, text] of Object.entries(files)) {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  return root
}

test('按目录分类，保留文章 URL，并生成嵌套分组', t => {
  const root = fixture(t, {
    'index.md': '# 总览',
    '力扣刷题/hot100.md': '## 第一题',
    '强化学习资料/入门.md': '# 同名文章',
    'agentic rl项目资料/项目 1/笔记.md': '# 同名文章',
    'agentic rl项目资料/项目 1/实验/结果.md': '# 实验结果',
    '零散.md': '# 其他收获',
    '.private/secret.md': '# 隐藏',
    'node_modules/readme.md': '# 系统',
    '空专区/images/example.svg': '<svg />'
  })
  const { notes, sections } = collectNotebook(root)
  assert.equal(notes.length, 5)
  assert.deepEqual(sections.map(s => s.name), [...sections.map(s => s.name)].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })))
  assert.equal(sections.length, 4)
  assert.equal(sections.find(s => s.name === '力扣刷题').notes[0].title, 'hot100')
  const project = sections.find(s => s.name === 'agentic rl项目资料')
  assert.equal(project.count, 2)
  assert.equal(project.url, '/sections/agentic%20rl%E9%A1%B9%E7%9B%AE%E8%B5%84%E6%96%99.html')
  assert.equal(project.tree.groups[0].name, '项目 1')
  assert.equal(project.tree.groups[0].groups[0].notes[0].title, '实验结果')
  const article = notes.find(n => n.sourcePath === '强化学习资料/入门.md')
  assert.equal(article.url, '/notes/' + encodeURIComponent('强化学习资料') + '/' + encodeURIComponent('入门') + '.html')
  assert.equal(sections.find(s => s.name === '其他笔记').count, 1)
})

test('导航和上一篇下一篇仅包含当前专区，索引文章不产生冲突', t => {
  const root = fixture(t, {
    'A/index.md': '# 1. 专题介绍',
    'A/题 2.md': '# 2. 练习',
    'AB/题.md': '# 同名练习',
    '根.md': '# 根目录'
  })
  const notebook = collectNotebook(root)
  const { sidebar, pages } = createNotebookNavigation(notebook)
  assert.equal(sidebar['/notes/A/index.md'][1].text, 'A')
  assert.equal(sidebar['/sections/AB.md'][1].text, 'AB')
  assert.equal(sidebar['/notes/AB/题.md'][1].items.length, 1)
  assert.equal(pages['notes/A/index.md'].prev, false)
  assert.equal(pages['notes/A/index.md'].next.link, '/notes/A/%E9%A2%98%202.html')
  assert.equal(pages['notes/A/题 2.md'].prev.link, '/notes/A/')
  assert.equal(pages['notes/A/题 2.md'].next, false)
  assert.deepEqual(pages['notes/AB/题.md'], { prev: false, next: false })
  assert.deepEqual(pages['notes/根.md'], { prev: false, next: false })
})

test('没有文章时不生成空专区', t => {
  const root = fixture(t, { 'index.md': '# 总览', '空/images.txt': '图片' })
  assert.deepEqual(collectNotebook(root), { notes: [], sections: [] })
})
