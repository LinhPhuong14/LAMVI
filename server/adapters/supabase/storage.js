// Supabase Storage cho video lô (D-46) và ảnh sản phẩm (G-23). Trình duyệt tải thẳng lên bằng
// signed upload URL do server cấp — frontend không cần key Supabase (T-05).
export const BATCH_VIDEO_BUCKET = 'batch-videos'
export const PRODUCT_IMAGE_BUCKET = 'product-images'

export function createSupabaseStorage(admin, defaultBucket = BATCH_VIDEO_BUCKET) {
  const files = (bucket = defaultBucket) => admin.storage.from(bucket)

  return {
    // Dashboard IT chỉ cần biết Storage còn sống → kiểm bucket mặc định
    async ping() {
      const { error } = await admin.storage.getBucket(defaultBucket)
      if (error) throw error
    },

    async createUpload({ path, contentType, bucket }) {
      const { data, error } = await files(bucket).createSignedUploadUrl(path)
      if (error) throw error
      return { uploadUrl: data.signedUrl, headers: { 'Content-Type': contentType, 'x-upsert': 'false' } }
    },

    // Video lô dùng bucket mặc định của adapter (batch-videos)
    createVideoUpload({ path, contentType }) {
      return this.createUpload({ path, contentType })
    },

    async statObject(path, bucket) {
      const { data, error } = await files(bucket).info(path)
      if (error) {
        if (error.status === 404 || error.statusCode === '404' || /not.?found/i.test(error.message ?? '')) return null
        throw error
      }
      return { size: data.size, contentType: data.contentType }
    },

    async removeObject(path, bucket) {
      const { error } = await files(bucket).remove([path])
      if (error) throw error
    },

    publicUrl(path, bucket) {
      return files(bucket).getPublicUrl(path).data.publicUrl
    },
  }
}
