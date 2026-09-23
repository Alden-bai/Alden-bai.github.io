import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'

const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric'
})

function git(root, args) {
  return execFileSync('git', ['--literal-pathspecs', '-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  }).trim()
}

export function uploadDate(uploadedAt = null, uploadStatus = 'unavailable') {
  if (uploadedAt && Number.isFinite(Date.parse(uploadedAt))) {
    const parts = Object.fromEntries(dateFormat.formatToParts(new Date(uploadedAt)).map(part => [part.type, part.value]))
    return {
      uploadedAt: new Date(uploadedAt).toISOString(), uploadStatus: 'dated',
      uploadDateText: `最近上传于 ${parts.year}年${parts.month}月${parts.day}日`
    }
  }
  return {
    uploadedAt: null, uploadStatus,
    uploadDateText: uploadStatus === 'pending' ? '待上传' : '上传日期暂不可用'
  }
}

// Never use checkout mtime or build time: both change without a note upload.
export function createNoteDateReader(root) {
  try {
    if (git(root, ['rev-parse', '--is-shallow-repository']) !== 'false') return () => uploadDate()
  } catch {
    return () => uploadDate()
  }
  try {
    git(root, ['rev-parse', '--verify', 'HEAD'])
  } catch {
    return () => uploadDate(null, 'pending')
  }
  return file => {
    try {
      const timestamp = git(root, ['log', '-1', '--follow', '--format=%cI', '--', relative(root, file)])
      return timestamp ? uploadDate(timestamp) : uploadDate(null, 'pending')
    } catch {
      return uploadDate()
    }
  }
}

export function latestUploadDate(notes) {
  const timestamps = notes.map(note => note.uploadedAt).filter(Boolean)
  if (timestamps.length) return uploadDate(timestamps.sort().at(-1))
  return uploadDate(null, notes.length && notes.every(note => note.uploadStatus === 'pending') ? 'pending' : 'unavailable')
}
