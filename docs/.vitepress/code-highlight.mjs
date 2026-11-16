// Infer only recognizable C++ syntax. Explicit fence languages always win.
// Mask comments and strings so quoted examples cannot trigger a match.
function looksLikeCpp(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    match => match.replace(/[^\r\n]/g, ' '))

  if (/^\s*#\s*include\s*<[^>\n]+>/m.test(code)) return true
  // Quoted includes disappear when strings are masked, but the directive stays.
  if (/^\s*#\s*include\s+"[^"\n]+"/m.test(source) && /^\s*#\s*include\s*$/m.test(code)) return true
  if (/^\s*(?:class|struct)\s+\w+[^;{}\n]*\{/m.test(code) &&
      /(?:^\s*(?:public|private|protected)\s*:|^\s*};)/m.test(code)) return true

  const type = '(?:(?:const|static|unsigned|signed|long)\\s+)*(?:void|bool|char|short|int|long|float|double|size_t|(?:std::)?(?:string|vector|map|unordered_map|set|unordered_set|queue|stack|deque|pair)(?:\\s*<[^;{}\\n]+>)?|[A-Z]\\w*\\s*[*&])(?:\\s*[*&])*'
  // Typed function definitions or declarations/assignments ending in a semicolon.
  if (new RegExp('^\\s*' + type + '\\s+\\w+\\s*(?:\\([^;{}]*\\)\\s*(?:const\\s*)?\\{|(?:=[^;\\n]*)?;)', 'm').test(code)) return true
  return /^\s*(?:(?:std::)?(?:cout|cerr|cin)\s*(?:<<|>>)|(?:std::)?(?:reverse|sort|lower_bound|upper_bound)\s*\([^;\n]*\)\s*;)/m.test(code)
}

export function codeHighlight(md) {
  md.core.ruler.after('block', 'infer_cpp_fences', state => {
    for (const token of state.tokens) {
      if (token.type === 'fence' && !token.info.trim() && looksLikeCpp(token.content)) {
        token.info = 'cpp'
      }
    }
  })
}
