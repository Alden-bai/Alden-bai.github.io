import { fileURLToPath } from 'node:url'
import { collectNotes } from './note-index.mjs'

export default {
  watch: ['../notes/**/*.md'],
  load() {
    return collectNotes(fileURLToPath(new URL('../notes/', import.meta.url)))
  }
}
