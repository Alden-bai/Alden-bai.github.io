import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { collectNotes } from './note-index.mjs'
import { mathCompatibility, mathOptions } from './math.mjs'

const notes = collectNotes(fileURLToPath(new URL('../notes/', import.meta.url)))

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
  themeConfig: {
    logo: { src: '/bear.svg', alt: '布吉熊' },
    nav: [
      { text: '首页', link: '/', activeMatch: '^/$' },
      { text: '学习笔记', link: '/notes/', activeMatch: '^/notes/' }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Alden-bai', ariaLabel: '访问 Alden 的 GitHub' }],
    sidebar: { '/notes/': [{ text: '学习笔记', items: [
      { text: '全部笔记', link: '/notes/' },
      ...notes.map(note => ({ text: note.title, link: note.url }))
    ] }] },
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
