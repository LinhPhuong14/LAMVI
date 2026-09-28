import { useState } from 'react'

// Quản lý trạng thái gửi form: lỗi chung (mã) + lỗi theo trường
export function useSubmit() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})

  async function run(fn) {
    setPending(true)
    setError(null)
    setFields({})
    try {
      return await fn()
    } catch (err) {
      setError(err.code || 'INTERNAL_ERROR')
      setFields(err.fields || {})
      return undefined
    } finally {
      setPending(false)
    }
  }

  return { pending, error, fields, run }
}
