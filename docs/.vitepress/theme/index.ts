import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import BearHome from './BearHome.vue'
import NotesIndex from './NotesIndex.vue'
import SectionIndex from './SectionIndex.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('BearHome', BearHome)
    app.component('NotesIndex', NotesIndex)
    app.component('SectionIndex', SectionIndex)
  }
} satisfies Theme
