import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

function fail(env, message, line) {
  const file = env.path || env.relativePath || 'Markdown'
  throw new Error(`[公式检查] ${file}${line ? `:${line}` : ''}：${message}`)
}

function closingDelimiter(source, delimiter, start) {
  for (let pos = source.indexOf(delimiter, start); pos !== -1;
    pos = source.indexOf(delimiter, pos + delimiter.length)) {
    let slashes = 0
    for (let i = pos - 1; i >= 0 && source[i] === '\\'; i--) slashes++
    if (slashes % 2 === 0) return pos
  }
  return -1
}

// Work on Markdown tokens, so code examples, links and escaped characters
// keep their original meaning. Never replace delimiters across the raw file.
export function mathCompatibility(md) {
  md.inline.ruler.before('escape', 'latex_delimiters', (state, silent) => {
    const rest = state.src.slice(state.pos)
    const raw = rest.match(/^\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|lim|begin|end|operatorname|mathrm|mathbf|mathbb|theta|epsilon|alpha|beta|sigma|pi)\b/)
    if (raw && !silent) fail(state.env, `${raw[0]} 位于公式外；请用 $...$ 或 \\(...\\) 包裹，展示源码请用反引号。`)
    const open = rest.startsWith('$') && !rest.startsWith('$$') ? '$' : rest.slice(0, 2)
    if (!['\\(', '\\[', '$$', '$'].includes(open)) return false
    const close = { '\\(': '\\)', '\\[': '\\]', '$$': '$$', '$': '$' }[open]
    const end = closingDelimiter(state.src, close, state.pos + open.length)
    if (open === '$') {
      // Currency and a standalone dollar sign are ordinary prose.
      if (end < 0 && !/^\$\s*[A-Za-z\\{]/.test(rest)) return false
      if (end >= 0 && /^\d/.test(state.src[end + 1] || '')) return false
      if (end >= 0 && /^\d/.test(rest[1]) && /\s$/.test(state.src.slice(state.pos + 1, end))) return false
    }
    if (end < 0) {
      if (silent) return false
      fail(state.env, `${open} 缺少对应的 ${close}。请补全公式定界符。`)
    }
    if (!silent) {
      // VitePress protects math_inline tokens from its attribute parser.
      const token = state.push('math_inline', 'math', 0)
      token.meta = { display: open === '\\[' || open === '$$' }
      token.content = state.src.slice(state.pos + open.length, end).trim()
      token.markup = open
    }
    state.pos = end + close.length
    return true
  })

  // Block rules run before Markdown interprets underscores, backslashes or
  // alignment rows. getLines also removes list/blockquote indentation.
  md.block.ruler.before('math_block', 'latex_blocks', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false
    const begin = state.bMarks[start] + state.tShift[start]
    const first = state.src.slice(begin, state.eMarks[start])
    const open = first.slice(0, 2)
    if (open !== '\\[' && open !== '$$') return false
    const close = open === '\\[' ? '\\]' : '$$'
    let last = start
    let content = first.slice(2)
    let closeAt = closingDelimiter(content, close, 0)
    if (closeAt >= 0 && content.slice(closeAt + 2).trim()) return false
    if (silent) return true
    while (closeAt < 0 && ++last < end) {
      if (state.tShift[last] < state.blkIndent && !state.isEmpty(last)) break
      content = first.slice(2) + '\n' + state.getLines(start + 1, last + 1, state.tShift[start], false)
      closeAt = closingDelimiter(content, close, 0)
    }
    if (closeAt < 0) fail(state.env, `${open} 缺少对应的 ${close}。`, start + 1)
    // A bracket formula followed by prose belongs to the inline parser.
    if (content.slice(closeAt + 2).trim()) return false
    const token = state.push('math_block', 'math', 0)
    token.block = true
    token.content = content.slice(0, closeAt).trim()
    token.markup = open
    token.map = [start, last + 1]
    state.line = last + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  md.core.ruler.after('inline', 'check_math', state => {
    for (const token of state.tokens) {
      if (token.type !== 'inline') continue
      for (const child of token.children || []) {
        if (child.type.startsWith('math_')) child.map = token.map
      }
    }
  })

  const renderers = { math_inline: md.renderer.rules.math_inline, math_block: md.renderer.rules.math_block }
  for (const type of ['math_inline', 'math_block']) {
    md.renderer.rules[type] = (tokens, index, options, env, self) => {
      const token = tokens[index]
      if (!token.content.trim()) fail(env, '公式内容不能为空。', token.map?.[0] + 1)
      const html = renderers[token.meta?.display ? 'math_block' : type](tokens, index, options, env, self)
      const error = html.match(/data-mjx-error="([^"]*)"/)
      if (error) fail(env, `${error[1]}；公式：${token.content.slice(0, 160)}`, token.map?.[0] + 1)
      return html
    }
  }
}

// Disable MathJax's error-hiding packages so invalid TeX fails the build
// instead of publishing red text or raw LaTeX in place of an equation.
export const mathOptions = {
  tex: { packages: AllPackages.filter(name => !['noerrors', 'noundefined'].includes(name)) }
}
