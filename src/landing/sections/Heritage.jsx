import { images, journeySteps } from '../data.js'
import { Eyebrow, SectionTitle } from '../ui.jsx'

export default function Heritage() {
  return (
    <section id="heritage" className="scroll-mt-20 py-space-xl bg-surface-container border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
          <div>
            <Eyebrow className="mb-2">Hành Trình Di Sản 600 Năm</Eyebrow>
            <SectionTitle>Dòng Chảy Bột Điệp &amp; Ánh Đèn</SectionTitle>
          </div>
          <p className="font-body-md text-on-surface-variant max-w-md mt-4 md:mt-0 text-sm">
            Hành trình của một tác phẩm LAMVI khởi đầu từ rặng dướng miền trung du Bắc Bộ, xuôi dòng sông
            Đuống và hóa thân thành nghệ thuật ánh sáng đương đại.
          </p>
        </div>

        {/* Thẻ bước quy trình — BRAND_GUIDELINE §10.4; bước cuối được nhấn */}
        <ol className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {journeySteps.map((step, i) => {
            const isLast = i === journeySteps.length - 1
            return (
              <li
                key={step.title}
                className={`p-5 border relative ${
                  isLast ? 'border-secondary bg-surface-container-lowest' : 'border-outline-variant/50 bg-surface'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`font-headline-sm text-3xl block mb-2 ${isLast ? 'text-secondary' : 'text-secondary/30'}`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-label-caps text-[0.7rem] uppercase text-secondary font-semibold block mb-1">
                  {step.place}
                </span>
                <h3 className="font-title-editorial text-sm font-medium text-primary mb-2">{step.title}</h3>
                <p className="font-body-sm text-[0.8rem] text-on-surface-variant leading-relaxed">{step.desc}</p>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 bg-surface p-3 border border-outline-variant/60 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 overflow-hidden aspect-[21/9]">
            <img
              alt="Đôi bàn tay nghệ nhân Đông Hồ ấn mộc bản gỗ lên giấy Dó"
              className="w-full h-full object-cover"
              loading="lazy"
              src={images.woodblock}
            />
          </div>
          <div className="lg:col-span-4 p-4 lg:pr-6">
            <span className="font-label-caps text-secondary text-xs uppercase tracking-widest block mb-2">
              Kỹ Nghệ Điển Phạm
            </span>
            <h3 className="font-headline-sm text-headline-sm text-primary mb-3">Ấn Mộc Từng Sắc Độ</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Mỗi bức tranh Đông Hồ cần từ 4 đến 5 bản khắc gỗ riêng biệt, in lần lượt từng màu: màu đỏ chu
              sa, màu vàng hoa dành dành, màu xanh rỉ đồng, màu đen than lá tre và bản nét sau cùng.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
