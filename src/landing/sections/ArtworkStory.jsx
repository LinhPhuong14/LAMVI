import { useState } from 'react'
import { hotspots, images } from '../data.js'
import { Eyebrow, SectionTitle, focusRing } from '../ui.jsx'

const pad = (n) => String(n).padStart(2, '0')

export default function ArtworkStory() {
  const [active, setActive] = useState(0)
  const current = hotspots[active]

  return (
    <section className="py-space-xl bg-surface border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="max-w-2xl mb-12">
          <Eyebrow className="mb-2">Khảo Luận Nghệ Thuật</Eyebrow>
          <SectionTitle>Mục Đồng Thổi Sáo: Biểu Tượng Của Tự Do &amp; An Lạc</SectionTitle>
          <p className="font-body-md text-body-md text-on-surface-variant mt-3">
            Chạm vào từng điểm sáng trên tuyệt tác để khám phá lớp ngôn ngữ biểu tượng sâu kín mà cổ nhân gửi
            gắm qua bức tranh mộc bản dân gian.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-7 bg-surface-container-low p-4 md:p-8 border border-outline-variant/60 flex items-center justify-center">
            <div className="relative max-w-md w-full shadow-lg border border-outline-variant/50 bg-[#F6F0E5]">
              <img
                alt="Tranh Đông Hồ Mục Đồng Thổi Sáo lồng khung trang trọng"
                className="w-full h-auto object-contain block"
                loading="lazy"
                src={images.mucDong}
              />
              {/* Hotspot 32px, vùng chạm mở rộng 44px qua pseudo-element — BRAND_GUIDELINE §10.10, §12 */}
              {hotspots.map((spot, i) => (
                <button
                  key={spot.label}
                  type="button"
                  aria-label={`Chi tiết ${i + 1}: ${spot.label}`}
                  aria-pressed={active === i}
                  aria-controls="hotspot-card"
                  className={`absolute ${spot.position} -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-surface flex items-center justify-center font-bold text-xs ring-4 hover:scale-110 transition-transform cursor-pointer before:absolute before:-inset-1.5 before:content-[''] ${
                    active === i ? 'bg-secondary ring-secondary/40' : 'bg-secondary/85 ring-secondary/20 motion-safe:animate-pulse'
                  } ${focusRing}`}
                  onClick={() => setActive(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div
              id="hotspot-card"
              aria-live="polite"
              className="bg-surface-container p-8 border border-outline-variant/60 min-h-[380px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-6">
                  <span className="font-label-caps text-xs text-secondary uppercase tracking-widest">
                    Chi Tiết {pad(active + 1)} / {pad(hotspots.length)}
                  </span>
                  <span aria-hidden="true" className="w-2.5 h-2.5 bg-secondary rotate-45 inline-block"></span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{current.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{current.desc}</p>
              </div>
              <div className="mt-8 pt-4 border-t border-outline-variant/40 flex justify-between items-center gap-4 text-xs font-label-caps text-on-surface-variant">
                <span>Nhấn các số 1 - 4 trên tranh để thấu cảm</span>
                <span className="text-secondary font-medium">Bản quyền lưu trữ LAMVI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
