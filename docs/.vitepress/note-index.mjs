import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative, basename, sep } from 'node:path'

// One source of truth for the note list and the reading sidebar.
export function collectNotes(root) {
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.md') && path !== resolve(root, 'index.md')) files.push(path)
    }
  }
  walk(root)
  return files.map(file => {
    const source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    const withoutFences = source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    const heading = withoutFences.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
    const title = (heading || basename(file, '.md')).replace(/\s*\{#[^}]+\}\s*$/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '')
    const relativePath = relative(root, file).split(sep).map(encodeURIComponent).join('/')
    const url = '/notes/' + relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')
    return { title, url }
  }).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN') || a.url.localeCompare(b.url))
}
