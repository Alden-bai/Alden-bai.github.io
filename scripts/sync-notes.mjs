import { createHash } from 'node:crypto'
import { isUtf8 } from 'node:buffer'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMarkdownRenderer } from 'vitepress'
import { ignoredDirectories } from '../docs/.vitepress/note-index.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
// Git can convert LF/CRLF on checkout. Treat those as the same text while
// preserving source bytes when copying; binary attachments stay byte-exact.
const contentHash = bytes => digest(isUtf8(bytes) && !bytes.includes(0) ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes)
const portable = path => path.split(sep).join('/')
const currentHash = path => existsSync(path) ? contentHash(readFileSync(path)) : null
const hidden = path => path.split(/[\\/]/).some(part => part.startsWith('.') || ignoredDirectories.has(part))

function contained(root, path, allowRoot = false) {
  const rel = relative(root, path)
  if ((!rel && !allowRoot) || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`路径必须位于目录内：${path}（目录：${root}）`)
  }
  return rel
}

// Check every existing component, not just the leaf, before reading/writing.
// A junction or symlink must never redirect synchronization outside the roots.
function noSymlinks(path) {
  let cursor = resolve(path)
  while (true) {
    if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`不支持符号链接或目录联接：${cursor}`)
    const parent = dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
}

function localReferences(md, source) {
  const links = []
  const content = source.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  function visit(tokens) {
    for (const token of tokens) {
      if (token.type === 'image') links.push(token.attrGet('src'))
      if (token.type === 'link_open') links.push(token.attrGet('href'))
      if (token.type === 'html_inline' || token.type === 'html_block') {
        const html = token.content.replace(/<!--[\s\S]*?-->/g, '')
        for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
          links.push(match[1] ?? match[2] ?? match[3])
        }
      }
      if (token.children) visit(token.children)
    }
  }
  visit(md.parse(content, {}))
  return links.filter(Boolean)
}

export async function createSyncPlan(projectRoot, sources) {
  const root = resolve(projectRoot)
  const notesRoot = resolve(root, 'docs/notes')
  const manifestPath = resolve(root, '.notes-sync.json')
  noSymlinks(notesRoot)
  noSymlinks(manifestPath)
  if (!Array.isArray(sources)) throw new Error('notes.sources.json 必须是来源数组。')
  const manifestBytes = existsSync(manifestPath) ? readFileSync(manifestPath) : null
  const previous = manifestBytes ? JSON.parse(manifestBytes.toString('utf8')) : { version: 1, files: {} }
  if (previous.version !== 1 || !previous.files || typeof previous.files !== 'object' || Array.isArray(previous.files)) {
    throw new Error('同步记录格式不支持；请保留 .notes-sync.json，不要手动重建。')
  }
  const md = await createMarkdownRenderer(root, { html: true, linkify: false })
  const desired = new Map()
  const owners = new Set()
  const sectionNames = new Set()

  for (const entry of sources) {
    const { section, source } = entry
    if (typeof section !== 'string' || !section.trim() || /[\\/:*?"<>|]/.test(section) || section.startsWith('.') || /[. ]$/.test(section) || ignoredDirectories.has(section)) {
      throw new Error(`无效的专区名称：${section}`)
    }
    const sectionKey = section.toLowerCase()
    if (sectionNames.has(sectionKey)) throw new Error(`重复专区：${section}`)
    sectionNames.add(sectionKey)
    if (typeof source !== 'string' || !source || isAbsolute(source)) throw new Error(`来源必须是相对网站目录的路径：${section}`)
    const sourceRoot = resolve(root, source)
    noSymlinks(sourceRoot)
    if (!existsSync(sourceRoot) || !lstatSync(sourceRoot).isDirectory()) throw new Error(`来源目录不存在：${sourceRoot}`)
    const sourceRel = relative(sourceRoot, notesRoot)
    const targetRel = relative(notesRoot, sourceRoot)
    if ((!sourceRel.startsWith('..' + sep) && !isAbsolute(sourceRel)) || (!targetRel.startsWith('..' + sep) && !isAbsolute(targetRel))) {
      throw new Error(`来源目录不能与网站笔记目录重叠：${sourceRoot}`)
    }
    const owner = `${section}:${portable(relative(root, sourceRoot))}`
    owners.add(owner)
    const included = new Set()
    const markdown = []
    function walk(directory) {
      for (const child of readdirSync(directory, { withFileTypes: true })) {
        if (hidden(child.name)) continue
        const path = resolve(directory, child.name)
        if (child.isSymbolicLink()) throw new Error(`来源中不支持符号链接：${path}`)
        if (child.isDirectory()) walk(path)
        else if (child.isFile() && child.name.endsWith('.md')) markdown.push(path)
      }
    }
    walk(sourceRoot)
    function include(path) {
      const rel = contained(sourceRoot, path)
      if (hidden(rel)) throw new Error(`引用了隐藏文件或系统目录：${path}`)
      noSymlinks(path)
      if (!existsSync(path) || !lstatSync(path).isFile()) throw new Error(`本地附件或链接目标不存在：${path}`)
      included.add(path)
    }
    for (const file of markdown) {
      include(file)
      for (const link of localReferences(md, readFileSync(file, 'utf8'))) {
        if (/^(?:file:|[A-Za-z]:[\\/])/i.test(link)) throw new Error(`请把电脑绝对路径改成相对链接：${file} → ${link}`)
        if (/^(?:[A-Za-z][\w+.-]*:|\/|#|\?)/.test(link)) continue
        const clean = decodeURIComponent(link.split(/[?#]/)[0])
        if (!clean) continue
        let path = resolve(dirname(file), clean)
        contained(sourceRoot, path, true)
        noSymlinks(path)
        if (existsSync(path) && lstatSync(path).isDirectory()) path = resolve(path, 'index.md')
        else if (path.endsWith('.html') && existsSync(path.slice(0, -5) + '.md')) path = path.slice(0, -5) + '.md'
        include(path)
      }
    }
    for (const file of [...included].sort()) {
      const key = `${section}/${portable(relative(sourceRoot, file))}`
      const bytes = readFileSync(file)
      desired.set(key, { bytes, source: owner, sha256: contentHash(bytes) })
    }
  }

  const actions = []
  const files = { ...previous.files }
  const caseKeys = new Set()
  for (const [key, record] of desired) {
    if (caseKeys.has(key.toLowerCase())) throw new Error(`文件名仅大小写不同，无法跨平台同步：${key}`)
    caseKeys.add(key.toLowerCase())
    const path = resolve(notesRoot, key)
    contained(notesRoot, path)
    noSymlinks(path)
    const before = currentHash(path)
    const old = previous.files[key]
    if (old && (old.source !== record.source || before !== old.sha256)) {
      throw new Error(`网站副本已被修改或来源改变，未同步任何文件：${key}`)
    }
    if (!old && before !== null) throw new Error(`同名文件未受同步管理，未同步任何文件：${key}`)
    if (before !== record.sha256) actions.push({ type: old ? 'update' : 'add', key, path, before, bytes: record.bytes })
    files[key] = { source: record.source, sha256: record.sha256 }
  }
  for (const [key, old] of Object.entries(previous.files)) {
    if (!owners.has(old.source) || desired.has(key)) continue
    const path = resolve(notesRoot, key)
    contained(notesRoot, path)
    noSymlinks(path)
    const before = currentHash(path)
    if (before !== old.sha256) throw new Error(`待删除的网站副本已被修改，未同步任何文件：${key}`)
    actions.push({ type: 'delete', key, path, before })
    delete files[key]
  }
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
  return { notesRoot, manifestPath, manifestBefore: manifestBytes ? contentHash(manifestBytes) : null, manifest: JSON.stringify({ version: 1, files: sortedFiles }, null, 2) + '\n', actions }
}

export function applySyncPlan(plan) {
  noSymlinks(plan.manifestPath)
  if (currentHash(plan.manifestPath) !== plan.manifestBefore) throw new Error('同步记录已变化，请重新运行。')
  // Preflight the entire set before the first mutation.
  for (const action of plan.actions) {
    contained(plan.notesRoot, action.path)
    noSymlinks(action.path)
    if (currentHash(action.path) !== action.before) throw new Error(`同步期间文件发生变化：${action.key}`)
  }
  for (const action of plan.actions) {
    if (action.type === 'delete') unlinkSync(action.path)
    else {
      mkdirSync(dirname(action.path), { recursive: true })
      writeFileSync(action.path, action.bytes)
    }
  }
  if (digest(plan.manifest) !== plan.manifestBefore) writeFileSync(plan.manifestPath, plan.manifest)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--dry-run')) throw new Error('用法：npm run notes:sync -- [--dry-run]')
  const root = fileURLToPath(new URL('../', import.meta.url))
  const sources = JSON.parse(readFileSync(resolve(root, 'notes.sources.json'), 'utf8'))
  const plan = await createSyncPlan(root, sources)
  const labels = { add: '新增', update: '更新', delete: '删除' }
  for (const action of plan.actions) console.log(`${labels[action.type]} ${action.key}`)
  if (args.includes('--dry-run')) console.log(`预览完成：${plan.actions.length} 项变化，未修改文件。`)
  else {
    applySyncPlan(plan)
    console.log(`同步完成：${plan.actions.length} 项变化。原稿保持不变；运行 npm run build 检查后再提交发布。`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[笔记同步] ${error.message}`); process.exitCode = 1 })
}
