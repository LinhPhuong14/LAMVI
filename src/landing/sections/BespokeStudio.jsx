import { useState } from 'react'
import { DEFAULT_INSCRIPTION, images, occasions, recipients } from '../data.js'
import { Eyebrow, SectionTitle, buttonPrimary, focusRing } from '../ui.jsx'

const fieldLabel = 'block font-label-caps text-xs text-primary uppercase tracking-wider mb-2'
const fieldInput =
  'w-full bg-surface border border-outline-variant text-primary p-3 focus:ring-secondary focus:border-secondary'

export default function BespokeStudio() {
  const [recipient, setRecipient] = useState(recipients[0])
  const [occasion, setOccasion] = useState(occasions[0].value)
  const [inscription, setInscription] = useState(DEFAULT_INSCRIPTION)

  return (
    <section id="bespoke" className="scroll-mt-20 py-space-xl bg-surface border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="max-w-2xl mb-12">
          <Eyebrow className="mb-2">Xưởng Chế Tác Riêng (Bespoke Atelier)</Eyebrow>
          <SectionTitle>Khắc Ghi Dấu Ấn Riêng</SectionTitle>
          <p className="font-body-md text-body-md text-on-surface-variant mt-3">
            Mỗi món quà văn hóa có thể được khắc bảng đồng hoặc triện mộc riêng biệt trên đế gỗ lũa, biến tác
            phẩm thành kỷ vật truyền đời cho người trân quý.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-6 bg-surface-container-low p-8 border border-outline-variant/60">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <fieldset>
                <legend className={fieldLabel}>1. Người Nhận Trân Quý</legend>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {recipients.map((name) => {
                    const selected = recipient === name
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={selected}
                        className={`p-3 bg-surface border text-left transition-colors ${
                          selected
                            ? 'border-secondary text-primary font-medium'
                            : 'border-outline-variant text-on-surface-variant hover:border-secondary'
                        } ${focusRing}`}
                        onClick={() => setRecipient(name)}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="bespoke-occasion" className={fieldLabel}>
                  2. Dịp Tặng Tương Ngộ
                </label>
                <select
                  id="bespoke-occasion"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className={`${fieldInput} text-xs`}
                >
                  {occasions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bespoke-inscription" className={fieldLabel}>
                  3. Lời Đề Từ Thư Pháp Khắc Bản Đồng
                </label>
                <input
                  id="bespoke-inscription"
                  type="text"
                  value={inscription}
                  onChange={(e) => setInscription(e.target.value)}
                  aria-describedby="bespoke-inscription-hint"
                  className={`${fieldInput} text-sm font-headline-sm`}
                />
                <span id="bespoke-inscription-hint" className="block text-[0.7rem] text-on-surface-variant mt-1 font-label-meta">
                  Chữ được chạm chìm thủ công trên thẻ đồng nguyên khối hoặc mộc bản son.
                </span>
              </div>

              <div className="pt-4 border-t border-outline-variant/40">
                <a className={`w-full inline-block text-center py-3.5 text-xs ${buttonPrimary}`} href="#inquire">
                  Yêu Cầu Chế Tác Bản Mộc Riêng
                </a>
              </div>
            </form>
          </div>

          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-md bg-surface p-8 border border-outline-variant/60 lantern-bloom text-center relative">
              <div className="aspect-[3/4] bg-surface-container-high border border-outline-variant/40 mb-6 flex items-center justify-center p-6 relative overflow-hidden">
                <img
                  alt="Đèn LAMVI với đế gỗ khắc tên riêng"
                  className="max-h-full object-contain contrast-105"
                  loading="lazy"
                  src={images.lamp}
                />
                <div className="absolute inset-0 bg-secondary/5 mix-blend-multiply pointer-events-none"></div>
              </div>

              {/* Mockup bảng đồng — màu đặc biệt BRAND_GUIDELINE §4.4 */}
              <div
                aria-live="polite"
                className="bg-gradient-to-r from-[#d9be8c] via-[#f7e6c4] to-[#c9ad79] text-primary p-3 shadow border border-[#b89a64] max-w-xs mx-auto"
              >
                <span className="block font-label-caps text-[0.65rem] uppercase tracking-widest text-[#5c4a2a]">
                  Kính Tặng: {recipient}
                </span>
                <span className="block font-headline-sm text-sm font-semibold tracking-wide text-[#332512] my-0.5">
                  {inscription || 'Tâm An Vạn Sự Tường'}
                </span>
                <span className="block font-label-meta text-[0.625rem] text-[#6d5630]">
                  LAMVI ATELIER • {occasion.toUpperCase()}
                </span>
              </div>
              <span className="block text-[0.7rem] font-label-caps text-on-surface-variant uppercase tracking-wider mt-4">
                Mô phỏng khắc đồng nguyên khối tại chân đèn
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
