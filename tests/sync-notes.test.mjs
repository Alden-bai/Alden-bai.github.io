import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { applySyncPlan, createSyncPlan } from '../scripts/sync-notes.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'notes-sync-'))
  const project = join(root, 'website')
  const source = join(root, '力扣刷题')
  mkdirSync(join(project, 'docs/notes'), { recursive: true })
  mkdirSync(source)
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (base, name, text) => {
    const path = join(base, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
    return path
  }
  return {
    root, project, source,
    put: (name, text) => put(source, name, text),
    target: (name, text) => put(join(project, 'docs/notes/力扣刷题'), name, text),
    output: name => join(project, 'docs/notes/力扣刷题', name),
    plan: () => createSyncPlan(project, [{ section: '力扣刷题', source: '../力扣刷题' }])
  }
}

test('预览不写入；同步 Markdown、引用式图片和 HTML 附件，保留原稿', async t => {
  const f = fixture(t)
  const original = '# Hot100\n\n![图][pic]\n\n[pic]: <images/示例 图.svg>\n\n[资料](files/说明.pdf)\n\n<img src="images/other.svg">\n\n`![忽略](missing.png)`\n\n[站内](/notes/)'
  f.put('hot100.md', original)
  f.put('images/示例 图.svg', '<svg />')
  f.put('images/other.svg', '<svg />')
  f.put('files/说明.pdf', Buffer.from([0, 1, 2, 255]))
  f.put('不引用.txt', '不公开')
  f.put('.private/secret.md', '隐藏')
  const plan = await f.plan()
  assert.equal(plan.actions.length, 4)
  assert.equal(existsSync(f.output('hot100.md')), false)
  assert.equal(existsSync(join(f.project, '.notes-sync.json')), false)
  applySyncPlan(plan)
  assert.equal(readFileSync(f.output('hot100.md'), 'utf8'), original)
  assert.equal(readFileSync(join(f.source, 'hot100.md'), 'utf8'), original)
  assert.equal(existsSync(f.output('不引用.txt')), false)
  assert.equal(existsSync(f.output('images/示例 图.svg')), true)
  assert.equal((await f.plan()).actions.length, 0)
})

test('更新和删除仅作用于已管理副本', async t => {
  const f = fixture(t)
  f.put('a.md', '# 旧文')
  f.put('b.md', '# 删除')
  applySyncPlan(await f.plan())
  f.target('手写.md', '# 不属于同步')
  f.put('a.md', '# 新文')
  unlinkSync(join(f.source, 'b.md'))
  const plan = await f.plan()
  assert.deepEqual(plan.actions.map(a => a.type).sort(), ['delete', 'update'])
  applySyncPlan(plan)
  assert.equal(readFileSync(f.output('a.md'), 'utf8'), '# 新文')
  assert.equal(existsSync(f.output('b.md')), false)
  assert.equal(existsSync(f.output('手写.md')), true)
})

test('冲突检查在任何写入之前完成', async t => {
  const f = fixture(t)
  f.put('z.md', '# 原稿')
  applySyncPlan(await f.plan())
  f.target('z.md', '# 网站被单独修改')
  f.put('a.md', '# 不能提前同步')
  await assert.rejects(f.plan(), /网站副本已被修改/)
  assert.equal(existsSync(f.output('a.md')), false)
  assert.equal(readFileSync(f.output('z.md'), 'utf8'), '# 网站被单独修改')
  unlinkSync(join(f.source, 'z.md'))
  await assert.rejects(f.plan(), /待删除的网站副本已被修改/)
})

test('同名未管理文件不能覆盖；来源缺失不能视为删除', async t => {
  const f = fixture(t)
  f.put('a.md', '# 原稿')
  f.target('a.md', '# 已有文章')
  await assert.rejects(f.plan(), /同名文件未受同步管理/)
  await assert.rejects(createSyncPlan(f.project, [{ section: '不存在', source: '../missing' }]), /来源目录不存在/)
  assert.equal(readFileSync(f.output('a.md'), 'utf8'), '# 已有文章')
})

test('拒绝越界附件、丢失图片和来源目录重叠', async t => {
  const f = fixture(t)
  f.put('a.md', '![越界](../secret.png)')
  await assert.rejects(f.plan(), /路径必须位于目录内/)
  f.put('a.md', '![图片](missing.png)')
  await assert.rejects(f.plan(), /本地附件或链接目标不存在/)
  await assert.rejects(createSyncPlan(f.project, [{ section: 'A', source: 'docs/notes' }]), /重叠/)
  await assert.rejects(createSyncPlan(f.project, [{ section: '../escape', source: '../力扣刷题' }]), /无效的专区名称/)
})

test('引用的 Markdown 保留路径；外部链接不下载', async t => {
  const f = fixture(t)
  f.put('index.md', '[子页](子目录/笔记.html#标题)\n\n![外部](https://example.com/a.png)')
  f.put('子目录/笔记.md', '# 笔记\n\n[返回首页](../)')
  applySyncPlan(await f.plan())
  assert.equal(existsSync(f.output('子目录/笔记.md')), true)
  assert.equal((await f.plan()).actions.length, 0)
})

test('执行前再次验证文件，拒绝预览后出现的修改', async t => {
  const f = fixture(t)
  f.put('a.md', '# 原稿')
  const plan = await f.plan()
  f.target('a.md', '# 在预览后写入')
  assert.throws(() => applySyncPlan(plan), /同步期间文件发生变化/)
})

test('Git 的换行转换不会被误判成网站副本修改', async t => {
  const f = fixture(t)
  f.put('a.md', '# 原稿\r\n\r\n正文\r\n')
  applySyncPlan(await f.plan())
  f.target('a.md', '# 原稿\n\n正文\n')
  assert.equal((await f.plan()).actions.length, 0)
  const manifest = join(f.project, '.notes-sync.json')
  writeFileSync(manifest, readFileSync(manifest, 'utf8').replace(/\n/g, '\r\n'))
  applySyncPlan(await f.plan())
})
