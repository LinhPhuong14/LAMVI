import { Fragment } from 'react'
import { giftFeatures, giftStats } from '../data.js'
import { Eyebrow, Icon, SectionTitle } from '../ui.jsx'

export default function GiftingRitual() {
  return (
    <section className="py-space-xl bg-surface-container border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-2">Nghi Thức Trao Tặng</Eyebrow>
            <SectionTitle className="mb-6">Món Quà Văn Hóa Vượt Thời Gian</SectionTitle>
            <div className="space-y-4 font-body-md text-on-surface-variant text-sm leading-relaxed">
              <p>
                Mỗi tác phẩm LAMVI rời xưởng chế tác đều được trân trọng bao bọc trong hộp gỗ bọc lụa Hà Đông,
                niêm phong bằng sáp chu sa mang triện khắc riêng.
              </p>
              <p>
                Bên trong là cuốn thư di sản in trên giấy Dó thủ công nguyên bản, ghi nhận xuất xứ cây Dướng, tên
                tuổi nghệ nhân bóc vỏ, làng mộc bản và chữ ký chứng nhận từ giám tuyển LAMVI.
              </p>
              <dl className="pt-4 flex flex-wrap items-center gap-6">
                {giftStats.map((stat, i) => (
                  <Fragment key={stat.label}>
                    {i > 0 && <div aria-hidden="true" className="w-px h-8 bg-outline-variant"></div>}
                    <div className="flex flex-col-reverse">
                      <dt className="font-label-meta text-xs text-on-surface-variant">{stat.label}</dt>
                      <dd className="font-headline-sm text-headline-sm text-primary font-medium">{stat.value}</dd>
                    </div>
                  </Fragment>
                ))}
              </dl>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {giftFeatures.map((f) => (
              <div
                key={f.title}
                className="bg-surface p-6 border border-outline-variant/60 flex flex-col justify-between gap-6 sm:aspect-square"
              >
                <Icon name={f.icon} className="text-secondary text-3xl" />
                <div>
                  <h3 className="font-title-editorial text-primary text-base mb-1">{f.title}</h3>
                  <p className="font-body-sm text-xs text-on-surface-variant">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
