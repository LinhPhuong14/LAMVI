import { useState } from 'react'
import { buttonPrimary } from '../ui.jsx'

export default function Inquiry() {
  const [sent, setSent] = useState(false)

  return (
    <section id="inquire" className="scroll-mt-20 py-space-xl bg-surface text-center border-b border-outline-variant/40">
      <div className="max-w-3xl mx-auto px-margin-mobile">
        <span aria-hidden="true" className="w-8 h-px bg-secondary inline-block mb-6"></span>
        <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary leading-tight">
          “Để câu chuyện Việt
          <br />
          tiếp tục được kể.”
        </h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-6 mb-8 max-w-lg mx-auto">
          Mời bạn ghé thăm không gian trưng bày ánh sáng tại Phố Cổ Hà Nội hoặc yêu cầu gửi bộ tác phẩm lưu trữ
          (Curatorial Folio) tận nơi.
        </p>
        <form
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          onSubmit={(e) => {
            e.preventDefault()
            setSent(true)
          }}
        >
          <label htmlFor="inquire-email" className="sr-only">
            Địa chỉ thư điện tử
          </label>
          <input
            id="inquire-email"
            type="email"
            required
            placeholder="Địa chỉ thư điện tử của bạn..."
            className="w-full bg-surface-container border border-outline-variant text-sm px-4 py-3 focus:ring-secondary focus:border-secondary font-body-sm text-primary placeholder:text-outline"
          />
          <button type="submit" className={`px-7 py-3 text-xs whitespace-nowrap ${buttonPrimary}`}>
            Nhận Folio
          </button>
        </form>
        <p aria-live="polite" className="mt-4 font-body-sm text-body-sm text-secondary min-h-[1.375rem]">
          {sent && 'Cảm ơn bạn đã trân quý di sản. Giám tuyển LAMVI sẽ liên hệ trong 24 giờ.'}
        </p>
      </div>
    </section>
  )
}
