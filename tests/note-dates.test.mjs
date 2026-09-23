import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { uploadDate } from '../docs/.vitepress/note-dates.mjs'
import { collectNotebook } from '../docs/.vitepress/note-index.mjs'

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
  const write = (name, text) => writeFileSync(join(notesRoot, '强化学习资料', name), text)
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
  f.commit('2026-09-22T17:00:00Z')
  let notebook = f.notebook()
  const original = notebook.notes.find(n => n.title === '旧笔记')
  assert.equal(original.uploadDateText, '最近上传于 2026年9月21日')
  assert.equal(notebook.sections[0].uploadDateText, '最近上传于 2026年9月23日')
  assert.equal(notebook.sections[0].count, 2)
  assert.equal(notebook.notes.find(n => n.sourcePath.includes('agentic')).title, 'agentic rl：环境、轨迹、reward')
  writeFileSync(join(f.root, 'style.css'), 'body {}')
  f.commit('2026-09-24T09:00:00+08:00')
  assert.deepEqual(f.notebook(), notebook)
  f.write('旧笔记.md', '# 旧笔记\n\n新增内容')
  f.commit('2026-09-25T09:00:00+08:00')
  notebook = f.notebook()
  assert.equal(notebook.notes.find(n => n.title === '旧笔记').uploadDateText, '最近上传于 2026年9月25日')
  assert.equal(notebook.sections[0].uploadDateText, '最近上传于 2026年9月25日')
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
  writeFileSync(join(outside, '笔记.md'), '# 笔记')
  assert.equal(collectNotebook(outside).notes[0].uploadDateText, '上传日期暂不可用')
})
