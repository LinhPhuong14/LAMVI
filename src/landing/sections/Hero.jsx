import { heroMeta, images } from '../data.js'
import { Icon, buttonPrimary, focusRing } from '../ui.jsx'

export default function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden border-b border-outline-variant/40"
    >
      <div className="absolute inset-0 z-0">
        <img
          alt=""
          className="w-full h-full object-cover object-center brightness-[0.88] contrast-[1.03]"
          src={images.lamp}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-margin-mobile md:px-margin py-space-xl flex flex-col justify-between min-h-[82vh]">
        <div className="pt-8">
          {/* Badge xuất xứ — BRAND_GUIDELINE §10.6 */}
          <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-surface-container/80 backdrop-blur border border-outline-variant/60 mb-6">
            <span className="w-2 h-2 rounded-full bg-secondary motion-safe:animate-pulse"></span>
            <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest text-[0.7rem]">
              Giấy Dó Bắc Ninh • Mộc Bản Đông Hồ • Ánh Sáng Điêu Khắc
            </span>
          </div>

          <h1 className="font-display-hero text-display-hero-mobile md:text-display-hero text-primary max-w-3xl leading-[1.08] tracking-tight">
            Mang câu chuyện Việt
            <br />
            sống lại bằng ánh sáng
            <br />
            <span className="italic font-normal text-secondary">và công nghệ.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-6 leading-relaxed">
            Sự giao hòa giữa chất liệu giấy Dó ngàn năm, hồn tranh mộc bản Đông Hồ và ngôn ngữ ánh sáng
            đương đại. Mỗi chiếc đèn là một bảo tàng thu nhỏ trong không gian sống.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-8">
            <a className={`inline-flex items-center px-7 py-3.5 shadow-sm ${buttonPrimary}`} href="#collection">
              <span>Khám phá LAMVI</span>
              <Icon name="arrow_forward" className="ml-2 text-base" />
            </a>
            <a
              className={`inline-flex items-center px-6 py-3.5 border border-primary-container text-primary hover:bg-surface-container transition-all duration-300 font-label-caps text-label-caps uppercase tracking-widest ${focusRing}`}
              href="#heritage"
            >
              <Icon name="graphic_eq" className="mr-2 text-base" />
              <span>Xem phim tư liệu làng nghề</span>
            </a>
          </div>
        </div>

        {/* Dải metadata — BRAND_GUIDELINE §10.7 */}
        <dl className="pt-12 border-t border-outline-variant/40 mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {heroMeta.map((item) => (
            <div key={item.label}>
              <dt className="font-label-meta text-label-meta text-on-surface-variant">{item.label}</dt>
              <dd className="font-body-sm text-body-sm text-primary font-medium">{item.value}</dd>
            </div>
          ))}
          <div className="md:text-right flex items-end md:justify-end">
            <span className="inline-flex items-center font-label-caps text-label-caps text-secondary uppercase tracking-widest">
              Ấn bản lưu trữ 2025 • Số lượng giới hạn
            </span>
          </div>
        </dl>
      </div>
    </section>
  )
}
