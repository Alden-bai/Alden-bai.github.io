import { fileURLToPath } from 'node:url'
import { collectNotebook } from './note-index.mjs'

export default {
  watch: ['../notes/**/*.md'],
  load() {
    return collectNotebook(fileURLToPath(new URL('../notes/', import.meta.url)))
  }
}
