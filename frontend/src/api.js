const messages = {
  INVALID_ARGUMENT: '请检查输入内容。',
  INVALID_CREDENTIALS: '请核对学号和密码。',
  UNAUTHENTICATED: '会话已过期，请重新登录。',
  FORBIDDEN: '没有权限进行此操作。',
  USER_NOT_FOUND: '未找到这名学生。',
  PHOTO_NOT_FOUND: '尚未录入标准照。',
  STUDENT_NO_TAKEN: '该学号已注册。',
  REQUEST_ID_CONFLICT: '照片与请求编号不符，请重新拍摄。',
  CHECK_IN_PROCESSING: '这张照片正在处理中，请稍后重试。',
  PHOTO_TOO_LARGE: '照片超过 5 MiB，请压缩后重试。',
  UNSUPPORTED_MEDIA_TYPE: '请选择 JPEG 或 PNG 照片。',
  INVALID_IMAGE: '无法读取照片，请重新拍摄或选择。',
  NO_FACE: '没有检测到人脸，请正对镜头重拍。',
  MULTIPLE_FACES: '检测到多张人脸，请拍摄单人照。',
  FACE_NOT_RECOGNIZED: '未识别到已录入人员。',
  FACE_AMBIGUOUS: '无法区分相似人员，请重拍。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  FACE_SERVICE_UNAVAILABLE: '识别服务暂不可用，请稍后重试。',
  INTERNAL_ERROR: '系统异常，请稍后重试。',
}

export async function api(path, { method = 'GET', body, image = false, signal, session = true } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 30000)
  try {
    const json = body !== undefined && !(body instanceof FormData)
    const res = await fetch('/api/v1' + path, {
      method, body: json ? JSON.stringify(body) : body,
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const code = data.code || ({ 401: 'UNAUTHENTICATED', 429: 'RATE_LIMITED', 503: 'FACE_SERVICE_UNAVAILABLE' })[res.status]
      const err = Object.assign(new Error(data.message || messages[code] || '服务请求失败，请稍后重试。'), {
        code, status: res.status, field: data.field, retryAfter: Number(res.headers.get('Retry-After')) || 0,
      })
      if (session && code === 'UNAUTHENTICATED') window.dispatchEvent(new Event('session-expired'))
      throw err
    }
    if (image) {
      if (!/^image\/(jpeg|png)\b/i.test(res.headers.get('Content-Type') || '')) throw new Error('照片响应格式异常。')
      return await res.blob()
    }
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { throw new Error('服务响应异常，请确认后端已启动。') }
  } catch (err) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('请求超时，请稍后重试。')
    if (err instanceof TypeError) throw new Error('无法连接服务，请检查网络后重试。')
    throw err
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function validatePhoto(file) {
  if (!file || !file.size) return '请选择有效照片。'
  if (!['image/jpeg', 'image/png'].includes(file.type)) return messages.UNSUPPORTED_MEDIA_TYPE
  if (file.size > 5242880) return messages.PHOTO_TOO_LARGE
  return ''
}

const shanghai = { timeZone: 'Asia/Shanghai' }
export const today = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', shanghai).format(date)
export const time = value => new Intl.DateTimeFormat('zh-CN', {
  ...shanghai, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(new Date(value))
