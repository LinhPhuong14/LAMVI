import { describe, expect, it, vi } from 'vitest'
import { createSupabaseRepo } from './repo.js'
import { createSupabaseStorage, BATCH_VIDEO_BUCKET } from './storage.js'
import { RepoError } from '../repoErrors.js'

// Client Supabase giả: ghi lại chuỗi lời gọi; kết quả do test cấu hình (theo bảng)
function fakeClient(results = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const ops = []
      calls.push({ table, ops })
      const result = () => {
        const r = results[table]
        return Promise.resolve(typeof r === 'function' ? r(ops) : (r ?? { data: [], error: null }))
      }
      const b = {}
      for (const name of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'order']) {
        b[name] = (...args) => (ops.push([name, ...args]), b)
      }
      b.single = () => (ops.push(['single']), result())
      b.maybeSingle = () => (ops.push(['maybeSingle']), result())
      b.then = (res, rej) => result().then(res, rej)
      return b
    },
  }
}

const productRow = {
  id: 'p1',
  slug: 'den-moi',
  kind: 'set',
  status: 'draft',
  price: 1200000,
  tone: 'moss',
  sort_order: 3,
  name: { vi: 'Đèn Mới' },
  description: { vi: 'Mô tả' },
  badge: null,
  created_at: '2026-09-01',
  updated_at: '2026-09-02',
}

const batchRow = {
  id: 'b1',
  code: 'L-01',
  status: 'created',
  video_url: null,
  video_path: null,
  produced_on: '2026-10-01',
  title: { vi: 'Lô' },
  story: null,
  created_at: '2026-09-01',
  updated_at: '2026-09-02',
}

const dup = (constraint) => ({
  data: null,
  error: { code: '23505', message: `duplicate key value violates unique constraint "${constraint}"`, details: 'Key (x)=(y) already exists.' },
})

describe('Supabase repo — ghi sản phẩm', () => {
  it('createProduct: map camelCase → snake_case, insert().select().single(), trả camelCase', async () => {
    const client = fakeClient({ products: { data: productRow, error: null } })
    const repo = createSupabaseRepo(client)
    const p = await repo.createProduct({
      slug: 'den-moi',
      kind: 'set',
      status: 'draft',
      price: 1200000,
      tone: 'moss',
      sortOrder: 3,
      name: { vi: 'Đèn Mới' },
      description: { vi: 'Mô tả' },
      badge: null,
    })
    const { ops } = client.calls[0]
    expect(ops[0]).toEqual([
      'insert',
      {
        slug: 'den-moi',
        kind: 'set',
        status: 'draft',
        price: 1200000,
        tone: 'moss',
        sort_order: 3,
        name: { vi: 'Đèn Mới' },
        description: { vi: 'Mô tả' },
        badge: null,
      },
    ])
    expect(ops.slice(1)).toEqual([['select', '*'], ['single']])
    expect(p).toMatchObject({ id: 'p1', price: 1200000, sortOrder: 3, updatedAt: '2026-09-02' })
    expect(p).not.toHaveProperty('price_excl_vat')
  })

  it('updateProduct: chỉ gửi cột có giá trị, bỏ trường lạ (id, created_at, role); eq(id)', async () => {
    const client = fakeClient({ products: { data: [productRow], error: null } })
    const repo = createSupabaseRepo(client)
    await repo.updateProduct('p1', { price: 5, id: 'hack', createdAt: 'x', role: 'admin', badge: null })
    const { ops } = client.calls[0]
    expect(ops[0]).toEqual(['update', { price: 5, badge: null }])
    expect(ops).toContainEqual(['eq', 'id', 'p1'])
  })

  it('updateProduct: không có dòng nào → null', async () => {
    const repo = createSupabaseRepo(fakeClient({ products: { data: [], error: null } }))
    expect(await repo.updateProduct('nope', { price: 1 })).toBeNull()
  })

  it('deleteProduct: true khi xoá được, false khi không có', async () => {
    const yes = fakeClient({ products: { data: [{ id: 'p1' }], error: null } })
    expect(await createSupabaseRepo(yes).deleteProduct('p1')).toBe(true)
    expect(yes.calls[0].ops).toEqual([['delete'], ['eq', 'id', 'p1'], ['select', 'id']])
    expect(await createSupabaseRepo(fakeClient({ products: { data: [], error: null } })).deleteProduct('x')).toBe(false)
  })

  it('getProductById: maybeSingle; không có → null', async () => {
    const client = fakeClient({ products: { data: null, error: null } })
    expect(await createSupabaseRepo(client).getProductById('x')).toBeNull()
    expect(client.calls[0].ops).toEqual([['select', '*'], ['eq', 'id', 'x'], ['maybeSingle']])
  })

  it('23505 products_slug_key → RepoError CONFLICT field slug (create và update)', async () => {
    const repo = createSupabaseRepo(fakeClient({ products: dup('products_slug_key') }))
    const e1 = await repo.createProduct({ slug: 'a' }).catch((e) => e)
    expect(e1).toBeInstanceOf(RepoError)
    expect(e1).toMatchObject({ code: 'CONFLICT', field: 'slug' })
    const e2 = await repo.updateProduct('p1', { slug: 'a' }).catch((e) => e)
    expect(e2).toMatchObject({ code: 'CONFLICT', field: 'slug' })
  })

  it('lỗi khác 23505 được ném nguyên (để 500), không thành CONFLICT', async () => {
    const err = { code: '42501', message: 'permission denied' }
    const repo = createSupabaseRepo(fakeClient({ products: { data: null, error: err } }))
    const e = await repo.createProduct({ slug: 'a' }).catch((x) => x)
    expect(e).not.toBeInstanceOf(RepoError)
    expect(e).toBe(err)
  })
})

describe('Supabase repo — FAQ', () => {
  it('createFaq/updateFaq map isPublished/sortOrder', async () => {
    const row = { id: 'f1', sort_order: 2, is_published: true, question: { vi: 'Q' }, answer: { vi: 'A' }, updated_at: 'u' }
    const client = fakeClient({ faq_entries: (ops) => (ops[0][0] === 'insert' ? { data: row, error: null } : { data: [row], error: null }) })
    const repo = createSupabaseRepo(client)
    const f = await repo.createFaq({ question: { vi: 'Q' }, answer: { vi: 'A' }, isPublished: true, sortOrder: 2 })
    expect(client.calls[0].ops[0]).toEqual(['insert', { sort_order: 2, is_published: true, question: { vi: 'Q' }, answer: { vi: 'A' } }])
    expect(f).toEqual({ id: 'f1', sortOrder: 2, isPublished: true, question: { vi: 'Q' }, answer: { vi: 'A' }, updatedAt: 'u' })
    await repo.updateFaq('f1', { isPublished: false })
    expect(client.calls[1].ops[0]).toEqual(['update', { is_published: false }])
  })

  it('listFaq({publishedOnly:false}) không lọc is_published', async () => {
    const client = fakeClient({ faq_entries: { data: [], error: null } })
    await createSupabaseRepo(client).listFaq({ publishedOnly: false })
    expect(client.calls[0].ops.some(([op, col]) => op === 'eq' && col === 'is_published')).toBe(false)
  })
})

describe('Supabase repo — lô', () => {
  it('createBatch: status mặc định created; map video_path/produced_on', async () => {
    const client = fakeClient({ batches: { data: batchRow, error: null } })
    const b = await createSupabaseRepo(client).createBatch({ code: 'L-01', producedOn: '2026-10-01', title: { vi: 'Lô' }, story: null })
    expect(client.calls[0].ops[0]).toEqual(['insert', { code: 'L-01', status: 'created', produced_on: '2026-10-01', title: { vi: 'Lô' }, story: null }])
    expect(b).toMatchObject({ id: 'b1', code: 'L-01', status: 'created', videoUrl: null, videoPath: null, producedOn: '2026-10-01' })
  })

  it('updateBatch: videoPath/videoUrl/status → video_path/video_url/status', async () => {
    const client = fakeClient({ batches: { data: [{ ...batchRow, video_path: 'b1/x.mp4', video_url: 'https://cdn/x.mp4' }], error: null } })
    const b = await createSupabaseRepo(client).updateBatch('b1', { videoPath: 'b1/x.mp4', videoUrl: 'https://cdn/x.mp4' })
    expect(client.calls[0].ops[0]).toEqual(['update', { video_path: 'b1/x.mp4', video_url: 'https://cdn/x.mp4' }])
    expect(b).toMatchObject({ videoPath: 'b1/x.mp4', videoUrl: 'https://cdn/x.mp4' })
  })

  it('23505 batches_code_key → RepoError CONFLICT field code', async () => {
    const repo = createSupabaseRepo(fakeClient({ batches: dup('batches_code_key') }))
    await expect(repo.createBatch({ code: 'L-01' })).rejects.toMatchObject({ code: 'CONFLICT', field: 'code' })
    await expect(repo.updateBatch('b1', { code: 'L-01' })).rejects.toMatchObject({ code: 'CONFLICT', field: 'code' })
  })

  it('lỗi trigger D-47 (P0001) được ném nguyên, không nuốt', async () => {
    const err = { code: 'P0001', message: 'batch_published_cannot_be_deleted' }
    const repo = createSupabaseRepo(fakeClient({ batches: { data: null, error: err } }))
    await expect(repo.deleteBatch('b1')).rejects.toBe(err)
  })

  it('listBatches: sắp xếp produced_on giảm dần, null cuối', async () => {
    const client = fakeClient({ batches: { data: [batchRow], error: null } })
    const items = await createSupabaseRepo(client).listBatches()
    expect(client.calls[0].ops).toContainEqual(['order', 'produced_on', { ascending: false, nullsFirst: false }])
    expect(items[0].code).toBe('L-01')
  })
})

function fakeStorage({ signed, info, publicUrl } = {}) {
  const calls = []
  const bucketApi = {
    createSignedUploadUrl: vi.fn(async (path) => (calls.push(['sign', path]), signed ?? { data: { signedUrl: `https://sb.test/upload/${path}?token=t`, path, token: 't' }, error: null })),
    info: vi.fn(async (path) => (calls.push(['info', path]), info ?? { data: { size: 123, contentType: 'video/mp4' }, error: null })),
    getPublicUrl: vi.fn((path) => ({ data: { publicUrl: publicUrl ?? `https://sb.test/public/batch-videos/${path}` } })),
  }
  const admin = { storage: { from: vi.fn(() => bucketApi) } }
  return { admin, bucketApi, calls }
}

describe('Supabase storage (D-46)', () => {
  it('bucket mặc định batch-videos', () => {
    expect(BATCH_VIDEO_BUCKET).toBe('batch-videos')
  })

  it('createVideoUpload: gọi createSignedUploadUrl(path), trả uploadUrl + header không upsert', async () => {
    const { admin, bucketApi } = fakeStorage()
    const s = createSupabaseStorage(admin)
    const up = await s.createVideoUpload({ path: 'b1/1.mp4', contentType: 'video/mp4' })
    expect(admin.storage.from).toHaveBeenCalledWith('batch-videos')
    expect(bucketApi.createSignedUploadUrl).toHaveBeenCalledWith('b1/1.mp4')
    expect(up).toEqual({ uploadUrl: 'https://sb.test/upload/b1/1.mp4?token=t', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'false' } })
  })

  it('createVideoUpload: lỗi → ném ra', async () => {
    const err = new Error('boom')
    const { admin } = fakeStorage({ signed: { data: null, error: err } })
    await expect(createSupabaseStorage(admin).createVideoUpload({ path: 'b1/1.mp4', contentType: 'video/mp4' })).rejects.toBe(err)
  })

  it('statObject: có file → {size, contentType}', async () => {
    const { admin, bucketApi } = fakeStorage()
    expect(await createSupabaseStorage(admin).statObject('b1/1.mp4')).toEqual({ size: 123, contentType: 'video/mp4' })
    expect(bucketApi.info).toHaveBeenCalledWith('b1/1.mp4')
  })

  it.each([
    [{ status: 404, message: 'x' }],
    [{ statusCode: '404', message: 'x' }],
    [{ status: 400, message: 'Object not found' }],
    [{ message: 'not_found' }],
  ])('statObject: lỗi không tìm thấy %j → null', async (error) => {
    const { admin } = fakeStorage({ info: { data: null, error } })
    expect(await createSupabaseStorage(admin).statObject('b1/x.mp4')).toBeNull()
  })

  it('statObject: lỗi khác (500) → ném ra', async () => {
    const error = { status: 500, message: 'internal' }
    const { admin } = fakeStorage({ info: { data: null, error } })
    await expect(createSupabaseStorage(admin).statObject('b1/x.mp4')).rejects.toBe(error)
  })

  it('publicUrl: dùng getPublicUrl(path).data.publicUrl', () => {
    const { admin, bucketApi } = fakeStorage()
    expect(createSupabaseStorage(admin).publicUrl('b1/1.mp4')).toBe('https://sb.test/public/batch-videos/b1/1.mp4')
    expect(bucketApi.getPublicUrl).toHaveBeenCalledWith('b1/1.mp4')
  })

  it('bucket tuỳ chỉnh', async () => {
    const { admin } = fakeStorage()
    await createSupabaseStorage(admin, 'khac').createVideoUpload({ path: 'a', contentType: 'video/mp4' })
    expect(admin.storage.from).toHaveBeenCalledWith('khac')
  })
})
