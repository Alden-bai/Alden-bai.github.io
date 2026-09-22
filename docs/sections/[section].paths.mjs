import { fileURLToPath } from 'node:url'
import { collectNotebook } from '../.vitepress/note-index.mjs'

export default {
  paths() {
    const { sections } = collectNotebook(fileURLToPath(new URL('../notes/', import.meta.url)))
    return sections.map(section => ({ params: { section: section.name } }))
  }
}
