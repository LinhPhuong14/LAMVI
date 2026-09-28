// Lỗi chuẩn hoá của auth provider — route chuyển sang HttpError
export class AuthError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
