import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { uploadDate } from '../docs/.vitepress/note-dates.mjs'
import { collectNotebook, createNotebookNavigation } from '../docs/.vitepress/note-index.mjs'

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), 'note-dates-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (args, date) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) }
  })
  git(['init', '-b', 'main'])
  git(['config', 'user.name', 'Notebook Test'])
  git(['config', 'user.email', 'notebook@example.test'])
  git(['config', 'commit.gpgsign', 'false'])
  const notesRoot = join(root, 'docs/notes')
  mkdirSync(join(notesRoot, '强化学习资料'), { recursive: true })
  const write = (name, text) => {
    const path = join(notesRoot, '强化学习资料', name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  const commit = date => {
    git(['add', '.'])
    git(['commit', '-m', 'fixture'], date)
  }
  return { root, git, notesRoot, write, commit, notebook: () => collectNotebook(notesRoot) }
}

test('统一按北京时间显示完整日期，跨日、跨年不依赖构建机时区', () => {
  assert.equal(uploadDate('2026-09-22T15:59:59Z').uploadDateText, '最近上传于 2026年9月22日')
  assert.equal(uploadDate('2026-09-22T16:00:00Z').uploadDateText, '最近上传于 2026年9月23日')
  assert.equal(uploadDate('2026-12-31T20:00:00Z').uploadDateText, '最近上传于 2027年1月1日')
  assert.equal(uploadDate('invalid').uploadDateText, '上传日期暂不可用')
})

test('读取每篇笔记自己的提交日期；修改样式不更新，修改笔记才更新专区日期', t => {
  const f = repository(t)
  f.write('旧笔记.md', '# 旧笔记')
  f.commit('2026-09-21T09:00:00+08:00')
  f.write('agentic rl：环境、轨迹、reward.md', "---\ntitle: 'agentic rl：环境、轨迹、reward'\n---\n\n# Agentic RL训练目标")
  assert.equal(f.notebook().notes.find(n => n.title.startsWith('agentic')).uploadDateText, '待上传')
  assert.deepEqual(f.notebook().notes.map(n => n.title), ['旧笔记', 'agentic rl：环境、轨迹、reward'])
  f.commit('2026-09-22T17:00:00Z')
  let notebook = f.notebook()
  const original = notebook.notes.find(n => n.title === '旧笔记')
  assert.equal(original.uploadDateText, '最近上传于 2026年9月21日')
  assert.equal(notebook.sections[0].uploadDateText, '最近上传于 2026年9月23日')
  assert.equal(notebook.sections[0].count, 2)
  assert.equal(notebook.notes.find(n => n.sourcePath.includes('agentic')).title, 'agentic rl：环境、轨迹、reward')
  assert.deepEqual(notebook.sections[0].notes.map(n => n.title), ['agentic rl：环境、轨迹、reward', '旧笔记'])
  writeFileSync(join(f.root, 'style.css'), 'body {}')
  f.commit('2026-09-24T09:00:00+08:00')
  assert.deepEqual(f.notebook(), notebook)
  f.write('旧笔记.md', '# 旧笔记\n\n新增内容')
  f.commit('2026-09-25T09:00:00+08:00')
  notebook = f.notebook()
  assert.equal(notebook.notes.find(n => n.title === '旧笔记').uploadDateText, '最近上传于 2026年9月25日')
  assert.equal(notebook.sections[0].uploadDateText, '最近上传于 2026年9月25日')
  assert.deepEqual(notebook.sections[0].notes.map(n => n.title), ['旧笔记', 'agentic rl：环境、轨迹、reward'])
})

test('文章按完整提交时间倒序，时间相同按标题和 URL 排序，待上传排最后且导航一致', t => {
  const f = repository(t)
  f.write('旧笔记.md', '# A 旧笔记')
  f.commit('2026-10-08T18:00:00+08:00')
  f.write('上午.md', '# B 上午')
  f.commit('2026-10-09T09:00:00+08:00')
  f.write('晚间.md', '# Z 晚间')
  f.write('同名 2.md', '# C 同名')
  f.write('同名 1.md', '# C 同名')
  f.commit('2026-10-09T19:00:00+08:00')
  f.write('待上传 2.md', '# A 待上传')
  f.write('待上传 1.md', '# A 待上传')
  const notebook = f.notebook()
  const section = notebook.sections[0]
  assert.deepEqual(section.notes.map(n => n.sourcePath), [
    '强化学习资料/同名 1.md', '强化学习资料/同名 2.md', '强化学习资料/晚间.md',
    '强化学习资料/上午.md', '强化学习资料/旧笔记.md',
    '强化学习资料/待上传 1.md', '强化学习资料/待上传 2.md'
  ])
  assert.deepEqual(section.tree.notes, section.notes)
  const { sidebar, pages } = createNotebookNavigation(notebook)
  assert.deepEqual(sidebar['/sections/强化学习资料.md'][1].items.map(item => item.link), section.notes.map(n => n.url))
  section.notes.forEach((note, index) => {
    assert.deepEqual(pages['notes/' + note.sourcePath], {
      prev: index ? { text: section.notes[index - 1].title, link: section.notes[index - 1].url } : false,
      next: index + 1 < section.notes.length ? { text: section.notes[index + 1].title, link: section.notes[index + 1].url } : false
    })
  })
  writeFileSync(join(f.notesRoot, '另一个专区.md'), '# 其他文章')
  f.commit('2026-10-10T09:00:00+08:00')
  assert.deepEqual(createNotebookNavigation(f.notebook()).pages['notes/另一个专区.md'], { prev: false, next: false })
})

test('保留专区和嵌套分组的名称顺序，每组内的文章按时间倒序', t => {
  const f = repository(t)
  f.write('A 组/旧笔记.md', '# A 旧笔记')
  f.write('A 组/子组/旧笔记.md', '# A 旧笔记')
  f.commit('2026-10-08T09:00:00+08:00')
  f.write('A 组/新笔记.md', '# Z 新笔记')
  f.write('A 组/子组/新笔记.md', '# Z 新笔记')
  f.commit('2026-10-09T09:00:00+08:00')
  f.write('B 组/最新.md', '# 最新')
  mkdirSync(join(f.notesRoot, 'A 专区'), { recursive: true })
  writeFileSync(join(f.notesRoot, 'A 专区/笔记.md'), '# 另一个专区')
  f.commit('2026-10-09T19:00:00+08:00')
  const notebook = f.notebook()
  assert.deepEqual(notebook.sections.map(s => s.name), ['强化学习资料', 'A 专区'])
  const section = notebook.sections.find(s => s.name === '强化学习资料')
  assert.deepEqual(section.tree.groups.map(g => g.name), ['A 组', 'B 组'])
  assert.deepEqual(section.tree.groups[0].notes.map(n => n.title), ['Z 新笔记', 'A 旧笔记'])
  assert.deepEqual(section.tree.groups[0].groups[0].notes.map(n => n.title), ['Z 新笔记', 'A 旧笔记'])
  const { sidebar } = createNotebookNavigation(notebook)
  const items = sidebar['/sections/强化学习资料.md'][1].items
  assert.deepEqual(items.map(item => item.text), ['A 组', 'B 组'])
  assert.deepEqual(items[0].items.slice(0, 2).map(item => item.text), ['Z 新笔记', 'A 旧笔记'])
  assert.deepEqual(items[0].items[2].items.map(item => item.text), ['Z 新笔记', 'A 旧笔记'])
})

test('没有提交的新仓库显示待上传，非 Git 目录和浅历史不伪造日期', t => {
  const f = repository(t)
  f.write('新笔记.md', '# 新笔记')
  assert.equal(f.notebook().notes[0].uploadDateText, '待上传')
  assert.equal(f.notebook().sections[0].uploadDateText, '待上传')
  f.commit('2026-09-22T09:00:00+08:00')
  // Simulate a shallow history boundary at HEAD without network access.
  writeFileSync(join(f.root, '.git/shallow'), f.git(['rev-parse', 'HEAD']))
  assert.equal(f.notebook().notes[0].uploadDateText, '上传日期暂不可用')
  const outside = mkdtempSync(join(tmpdir(), 'notes-no-history-'))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  writeFileSync(join(outside, '笔记.md'), '# Z 笔记')
  assert.equal(collectNotebook(outside).notes[0].uploadDateText, '上传日期暂不可用')
  writeFileSync(join(outside, '同名 2.md'), '# A 同名')
  writeFileSync(join(outside, '同名 1.md'), '# A 同名')
  assert.deepEqual(collectNotebook(outside).notes.map(n => n.sourcePath), ['同名 1.md', '同名 2.md', '笔记.md'])
})
