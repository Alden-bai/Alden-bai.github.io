import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { collectNotebook, createNotebookNavigation } from './note-index.mjs'
import { mathCompatibility, mathOptions } from './math.mjs'
import { renderNoteSearch } from './note-search.mjs'

const notebook = collectNotebook(fileURLToPath(new URL('../notes/', import.meta.url)))
const navigation = createNotebookNavigation(notebook)

export default defineConfig({
  lang: 'zh-CN',
  title: '布吉熊的小窝',
  description: '布吉熊的个人学习空间，整理知识，记录思考。',
  base: '/',
  cleanUrls: false,
  appearance: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/bear.svg' }],
    ['meta', { name: 'theme-color', content: '#f7faff' }]
  ],
  markdown: {
    math: mathOptions,
    config: md => md.use(mathCompatibility),
    lineNumbers: true,
    codeCopyButtonTitle: '复制代码'
  },
  sitemap: { hostname: 'https://alden-bai.github.io' },
  transformPageData(page) {
    const neighbors = navigation.pages[page.relativePath]
    if (neighbors) {
      Object.assign(page.frontmatter, neighbors)
      // Some imported notebooks start at h2; keep their source untouched and
      // give the browser tab a useful title using the same index fallback.
      if (!page.title) page.title = notebook.notes.find(note => `notes/${note.sourcePath}` === page.relativePath)?.title || ''
    }
    if (page.relativePath.startsWith('sections/') && page.params?.section) {
      page.title = page.params.section
      page.description = `${page.params.section}专区的笔记与学习记录。`
    }
  },
  themeConfig: {
    logo: { src: '/bear.svg', alt: '布吉熊' },
    nav: [
      { text: '首页', link: '/', activeMatch: '^/$' },
      { text: '笔记专区', activeMatch: '^/(notes|sections)/', items: [
        { text: '全部专区', link: '/notes/' },
        ...notebook.sections.map(section => ({ text: section.name, link: section.url }))
      ] }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Alden-bai', ariaLabel: '访问 Alden 的 GitHub' }],
    sidebar: navigation.sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '笔记目录',
    darkModeSwitchLabel: '外观',
    darkModeSwitchTitle: '切换到深色模式',
    lightModeSwitchTitle: '切换到浅色模式',
    skipToContentLabel: '跳转到正文',
    notFound: {
      code: '404', title: '这页笔记走丢了',
      quote: '这里还没有留下足迹，回到小窝继续看看吧。',
      linkLabel: '返回首页', linkText: '回到小窝'
    },
    search: {
      provider: 'local',
      options: {
        _render: renderNoteSearch,
        miniSearch: {
          options: {
            tokenize: (text: string) => Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text))
              .filter(part => part.isWordLike).map(part => part.segment)
          }
        },
        locales: { root: { translations: {
        button: { buttonText: '搜索笔记', buttonAriaLabel: '搜索笔记' },
        modal: {
          displayDetails: '显示详细列表', resetButtonTitle: '清空搜索',
          backButtonTitle: '关闭搜索', noResultsText: '没有找到相关笔记',
          footer: { selectText: '打开', selectKeyAriaLabel: '回车键', navigateText: '选择', navigateKeyAriaLabel: '上下方向键', closeText: '关闭', closeKeyAriaLabel: 'Esc 键' }
        }
      } } } }
    }
  }
})
