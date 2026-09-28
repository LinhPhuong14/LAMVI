// Tải file lên URL do server cấp (signed upload URL của Supabase Storage — D-46), có tiến trình.
export function uploadFile(url, file, headers = {}, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(Object.assign(new Error('upload'), { code: 'UPLOAD_FAILED' })))
    xhr.onerror = () => reject(Object.assign(new Error('upload'), { code: 'UPLOAD_FAILED' }))
    xhr.send(file)
  })
}
