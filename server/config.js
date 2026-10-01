import { isValidMeasurementId } from '../src/analytics/ga.js'
import { normalizeSiteUrl } from '../src/seo/head.js'
import { parseServiceAccount } from './adapters/gaRealtime.js'

/**
 * Muối băm dự phòng khi thiếu MAY_HASH_SALT (chỉ hợp lệ ở dev). Môi trường thật BẮT BUỘC đặt
 * MAY_HASH_SALT riêng — xem docs/knowledge/deploy-vercel.md.
 */
export const DEFAULT_HASH_SALT = 'dev-hash-salt'

export function loadConfig(env = process.env) {
  const supabase = {
    url: env.SUPABASE_URL,
    // Khoá mới (sb_publishable_/sb_secret_) ưu tiên; tên cũ anon/service_role vẫn nhận
    anonKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return {
    // D-49: một server cho cả web (SSR) và API
    port: Number(env.PORT) || 5173,
    // Cắt "/" ở cuối: canonical/hreflang/sitemap nối trực tiếp đường dẫn nên sẽ sinh "//" nếu để
    publicSiteUrl: normalizeSiteUrl(env.PUBLIC_SITE_URL || 'http://localhost:5173'),
    // Giới hạn dung lượng video lô [ASSUMPTION]; phải ≤ giới hạn file của bucket Supabase
    maxVideoMb: Number(env.MAX_VIDEO_MB) || 500,
    // Giới hạn ảnh sản phẩm [ASSUMPTION] — ảnh web nên ≤ 5 MB (G-23)
    maxImageMb: Number(env.MAX_IMAGE_MB) || 5,
    // Số proxy phía trước (vd 1 khi sau load balancer); không đặt → không tin X-Forwarded-For
    trustProxy: env.TRUST_PROXY === undefined ? undefined : Number(env.TRUST_PROXY) || env.TRUST_PROXY,
    // FR-GA-001, D-72: Google Analytics 4. Không đặt → không nhúng GA (dev/test, Preview).
    // Giá trị hỏng bị bỏ qua vì được nhúng vào <script> nội tuyến (xem isValidMeasurementId).
    gaMeasurementId: isValidMeasurementId(env.GA_MEASUREMENT_ID) ? env.GA_MEASUREMENT_ID : null,
    // Báo cáo GA realtime ở /admin/analytics (GA Data API). Thiếu bất kỳ biến nào → trang báo "chưa cấu hình".
    gaRealtime: { propertyId: env.GA_PROPERTY_ID || null, ...parseServiceAccount(env) },
    /**
     * G-20: chống dò/spam ở tầng ứng dụng. Ngưỡng [ASSUMPTION] — đủ rộng cho người gõ nhầm vài
     * lần và cho nhiều người dùng chung một IP (văn phòng, quán), đủ chặt để không dò được.
     * `RATE_LIMIT=0` tắt hẳn (chỉ dùng cho test tự động, KHÔNG dùng ở môi trường thật).
     */
    rateLimit: {
      enabled: env.RATE_LIMIT !== '0',
      login: { max: 10, windowSec: 300 },
      register: { max: 20, windowSec: 3600 },
      forgot: { max: 5, windowSec: 3600 },
      password: { max: 10, windowSec: 3600 },
      order: { max: 20, windowSec: 3600 },
    },
    // BR-PAY-003: bí mật cho lịch quét đơn quá hạn (Vercel Cron). Để trống → tắt endpoint.
    cronSecret: env.CRON_SECRET || null,
    // Thanh toán payOS (FR-PAY-001, D-35). Thiếu khoá → checkout chỉ cho COD.
    payos: {
      clientId: env.PAYOS_CLIENT_ID || null,
      apiKey: env.PAYOS_API_KEY || null,
      checksumKey: env.PAYOS_CHECKSUM_KEY || null,
    },
    // AI Mây (D-17, D-55…D-58). Khoá chỉ ở server.
    openai: {
      apiKey: env.OPENAI_API_KEY || null,
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      priceInPer1M: Number(env.OPENAI_PRICE_INPUT_PER_1M) || 0.15,
      priceOutPer1M: Number(env.OPENAI_PRICE_OUTPUT_PER_1M) || 0.6,
    },
    // Đăng nhập Google (D-78): OAuth 2.0 trực tiếp với Google Cloud, không dùng provider Google của
    // Supabase. Thiếu một trong hai → ẩn nút "Đăng nhập với Google".
    google: { clientId: env.GOOGLE_CLIENT_ID || null, clientSecret: env.GOOGLE_CLIENT_SECRET || null },
    mayHashSalt: env.MAY_HASH_SALT || env.SUPABASE_URL || DEFAULT_HASH_SALT,
    supabase,
    useSupabase: Boolean(supabase.url && supabase.anonKey && supabase.serviceRoleKey),
  }
}
