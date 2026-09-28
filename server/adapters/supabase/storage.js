// Supabase Storage cho video lô (D-46). Trình duyệt tải thẳng lên bằng signed upload URL
// do server cấp — frontend không cần key Supabase (T-05).
export const BATCH_VIDEO_BUCKET = 'batch-videos'

export function createSupabaseStorage(admin, bucket = BATCH_VIDEO_BUCKET) {
  const files = () => admin.storage.from(bucket)

  return {
    async createVideoUpload({ path, contentType }) {
      const { data, error } = await files().createSignedUploadUrl(path)
      if (error) throw error
      return { uploadUrl: data.signedUrl, headers: { 'Content-Type': contentType, 'x-upsert': 'false' } }
    },

    async statObject(path) {
      const { data, error } = await files().info(path)
      if (error) {
        if (error.status === 404 || error.statusCode === '404' || /not.?found/i.test(error.message ?? '')) return null
        throw error
      }
      return { size: data.size, contentType: data.contentType }
    },

    publicUrl(path) {
      return files().getPublicUrl(path).data.publicUrl
    },
  }
}
