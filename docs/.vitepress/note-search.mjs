import { basename } from 'node:path'

// VitePress 1's heading extractor can confuse an external title link with
// the following permalink. Remove only those wrappers in the search HTML;
// the actual article and its LeetCode links stay unchanged.
export function renderNoteSearch(source, env, md) {
  let html = md.render(source, env)
  if (env.frontmatter?.search === false) return ''
  html = html.replace(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi, heading =>
    heading.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (link, attrs, label) =>
      /\bhref=["']#/.test(attrs) ? link : label))
  if (env.relativePath?.startsWith('notes/') && !/<h1\b/.test(html)) {
    const title = md.utils.escapeHtml(env.frontmatter?.title || basename(env.relativePath, '.md'))
    html = `<h1>${title}<a href="#" aria-hidden="true">#</a></h1>\n` + html
  }
  return html
}
