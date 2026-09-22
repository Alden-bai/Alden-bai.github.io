import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative, basename, sep } from 'node:path'

export const ignoredDirectories = new Set(['node_modules', '$RECYCLE.BIN', 'System Volume Information', '__MACOSX'])
const compare = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })

// One source of truth for cards, section pages and the reading sidebar.
export function collectNotes(root) {
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile() && entry.name.endsWith('.md') && path !== resolve(root, 'index.md')) files.push(path)
    }
  }
  walk(root)
  return files.map(file => {
    const source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    const withoutFences = source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    const heading = withoutFences.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
    const title = (heading || basename(file, '.md')).replace(/\s*\{#[^}]+\}\s*$/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_]/g, '')
    const parts = relative(root, file).split(sep)
    const relativePath = parts.map(encodeURIComponent).join('/')
    const url = '/notes/' + relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')
    return { title, url, sourcePath: parts.join('/'), section: parts.length > 1 ? parts[0] : '其他笔记', directories: parts.slice(1, -1) }
  }).sort((a, b) => compare(a.title, b.title) || compare(a.url, b.url))
}

export function collectNotebook(root) {
  const notes = collectNotes(root)
  const sections = [...new Set(notes.map(note => note.section))].sort(compare).map(name => {
    const sectionNotes = notes.filter(note => note.section === name)
    const tree = { name, path: '', notes: [], groups: [] }
    for (const note of sectionNotes) {
      let group = tree
      for (const directory of note.directories) {
        let next = group.groups.find(item => item.name === directory)
        if (!next) {
          next = { name: directory, path: [group.path, directory].filter(Boolean).join('/'), notes: [], groups: [] }
          group.groups.push(next)
        }
        group = next
      }
      group.notes.push(note)
    }
    function sortTree(group) {
      group.groups.sort((a, b) => compare(a.name, b.name))
      group.groups.forEach(sortTree)
    }
    sortTree(tree)
    return { name, url: `/sections/${encodeURIComponent(name)}.html`, count: sectionNotes.length, notes: sectionNotes, tree }
  })
  return { notes, sections }
}

export function sectionSidebar(section) {
  function items(group) {
    return [
      ...group.notes.map(note => ({ text: note.title, link: note.url })),
      ...group.groups.map(child => ({ text: child.name, collapsed: false, items: items(child) }))
    ]
  }
  return [
    { text: '全部专区', link: '/notes/' },
    { text: section.name, link: section.url, items: items(section.tree) }
  ]
}

export function createNotebookNavigation(notebook) {
  const sidebar = {}
  const pages = {}
  for (const section of notebook.sections) {
    const items = sectionSidebar(section)
    sidebar[`/sections/${section.name}.md`] = items
    section.notes.forEach((note, index) => {
      // Match the source path used by VitePress, including nested index pages.
      sidebar['/notes/' + note.sourcePath] = items
      const neighbor = offset => {
        const other = section.notes[index + offset]
        return other ? { text: other.title, link: other.url } : false
      }
      pages['notes/' + note.sourcePath] = { prev: neighbor(-1), next: neighbor(1) }
    })
  }
  return { sidebar, pages }
}
