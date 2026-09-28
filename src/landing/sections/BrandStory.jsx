import { images } from '../data.js'
import { Eyebrow } from '../ui.jsx'

export default function BrandStory() {
  return (
    <section id="story" className="scroll-mt-20 py-space-xl bg-surface-container-low border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-5 flex flex-col justify-center">
            <Eyebrow>Triết Lý Sáng Tác</Eyebrow>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary leading-tight mb-8">
              Một tờ giấy.
              <br />
              Một câu chuyện.
              <br />
              <span className="italic text-outline">Một ánh sáng.</span>
            </h2>
            <div className="space-y-5 text-on-surface-variant font-body-md text-body-md leading-relaxed border-l-2 border-outline-variant/50 pl-5">
              <p>
                Giấy Dó không chỉ là bề mặt để vẽ; tự thân nó đã là một sinh quyển. Từng thớ sợi của vỏ cây
                Dướng được ngâm vôi, đãi sạch bằng nước sông mát rượi, rồi đập nhuyễn bằng chày gỗ qua hàng
                vạn nhịp thủ công.
              </p>
              <p>
                Khi hòa quyện cùng bột vỏ điệp óng ánh và những mảng màu tự nhiên từ lá chàm, quả dành dành
                hay than lá tre, bức tranh mộc bản Đông Hồ chứa đựng hơi thở của đất trời Kinh Bắc.
              </p>
              <p className="text-primary font-medium">
                Tại LAMVI, chúng tôi thắp sáng lớp xơ giấy ấy bằng nguồn sáng chuẩn bảo tàng (CRI &gt; 97),
                để từng vi mạch sợi giấy hiện lên như một tác phẩm điêu khắc ánh sáng đa chiều.
              </p>
            </div>

            {/* Triện son — BRAND_GUIDELINE §3.2 */}
            <div className="mt-8 pt-6 border-t border-outline-variant/40 flex items-center gap-4">
              <div
                aria-hidden="true"
                className="w-12 h-12 shrink-0 border border-secondary text-secondary flex items-center justify-center text-center font-headline-sm font-bold text-sm leading-tight tracking-tighter"
              >
                LÂM
                <br />
                VỊ
              </div>
              <div className="text-xs text-on-surface-variant leading-tight">
                <p className="font-medium text-primary">Chứng thư bảo hộ di sản Việt</p>
                <p>Mỗi tác phẩm mang chữ ký nghệ nhân và mã lưu trữ vĩnh viễn.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <figure className="relative bg-surface p-3 md:p-6 border border-outline-variant/60 lantern-bloom">
              <div className="overflow-hidden aspect-[4/3] relative">
                <img
                  alt="Nghệ nhân giấy Dó múc bột giấy bằng liềm seo bên bể nước truyền thống"
                  className="w-full h-full object-cover contrast-[1.02]"
                  loading="lazy"
                  src={images.papermaking}
                />
                <figcaption className="absolute bottom-4 left-4 right-4 p-4 bg-primary-container/90 backdrop-blur text-surface text-xs flex justify-between items-center gap-4">
                  <div>
                    <span className="block font-label-caps uppercase text-[0.65rem] text-secondary-fixed">
                      Công đoạn Liềm Seo
                    </span>
                    <span className="font-body-sm">Đãi từng lớp xơ giấy mỏng nhẹ tựa cánh ve</span>
                  </div>
                  <span className="font-label-meta text-outline-variant text-right">Làng Dương Ổ, Bắc Ninh</span>
                </figcaption>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}
