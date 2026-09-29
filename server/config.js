import { isValidMeasurementId } from '../src/analytics/ga.js'

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
    publicSiteUrl: env.PUBLIC_SITE_URL || 'http://localhost:5173',
    // Giới hạn dung lượng video lô [ASSUMPTION]; phải ≤ giới hạn file của bucket Supabase
    maxVideoMb: Number(env.MAX_VIDEO_MB) || 500,
    // Số proxy phía trước (vd 1 khi sau load balancer); không đặt → không tin X-Forwarded-For
    trustProxy: env.TRUST_PROXY === undefined ? undefined : Number(env.TRUST_PROXY) || env.TRUST_PROXY,
    // FR-GA-001, D-72: Google Analytics 4. Không đặt → không nhúng GA (dev/test, Preview).
    // Giá trị hỏng bị bỏ qua vì được nhúng vào <script> nội tuyến (xem isValidMeasurementId).
    gaMeasurementId: isValidMeasurementId(env.GA_MEASUREMENT_ID) ? env.GA_MEASUREMENT_ID : null,
    // AI Mây (D-17, D-55…D-58). Khoá chỉ ở server.
    openai: {
      apiKey: env.OPENAI_API_KEY || null,
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      priceInPer1M: Number(env.OPENAI_PRICE_INPUT_PER_1M) || 0.15,
      priceOutPer1M: Number(env.OPENAI_PRICE_OUTPUT_PER_1M) || 0.6,
    },
    mayHashSalt: env.MAY_HASH_SALT || env.SUPABASE_URL || 'moc-dev',
    supabase,
    useSupabase: Boolean(supabase.url && supabase.anonKey && supabase.serviceRoleKey),
  }
}
