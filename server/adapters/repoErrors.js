// Lỗi chuẩn hoá của repository — route chuyển sang HttpError
export class RepoError extends Error {
  constructor(code, field) {
    super(code)
    this.code = code // 'CONFLICT'
    this.field = field // trường bị trùng (vd 'slug', 'code')
  }
}
