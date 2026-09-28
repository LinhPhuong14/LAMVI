import { useState } from 'react'
import { knowledgeBase, suggestedQuestions } from '../data.js'
import { Eyebrow, Icon, SectionTitle, buttonPrimary, focusRing } from '../ui.jsx'

const initialQuestion = suggestedQuestions[0].q

export default function CuratorialCompanion() {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState({ query: initialQuestion, answered: false })

  const ask = (question) => {
    const q = question.trim()
    if (!q) return
    setInput(q)
    setResponse({ query: q, answered: true })
  }

  const paragraphs = knowledgeBase[response.query]

  return (
    <section
      id="curatorial-companion"
      className="scroll-mt-20 py-space-xl bg-surface-container-low border-b border-outline-variant/40"
    >
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin">
        <div className="text-center mb-10">
          <Eyebrow center className="mb-2">
            Tri Thức &amp; Khảo Cổ Số
          </Eyebrow>
          <SectionTitle>Hỏi Chuyện Cổ</SectionTitle>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto mt-3">
            Hệ thống giám tuyển văn hóa AI của LAMVI được huấn luyện trên hàng trăm văn bản di sản Đông Hồ, thư
            tịch Hán Nôm và kỹ thuật giấy Dó cổ truyền.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2.5 mb-8">
          {suggestedQuestions.map(({ q, short }) => (
            <button
              key={q}
              type="button"
              className={`px-4 py-2 bg-surface border border-outline-variant text-xs text-primary hover:border-secondary hover:text-secondary transition-all ${focusRing}`}
              onClick={() => ask(q)}
            >
              “{short}”
            </button>
          ))}
        </div>

        <form
          className="bg-surface p-2 border border-outline-variant/80 flex items-center shadow-sm mb-8"
          onSubmit={(e) => {
            e.preventDefault()
            ask(input)
          }}
        >
          <Icon name="ink_pen" className="text-outline px-3" />
          <label htmlFor="chat-input" className="sr-only">
            Câu hỏi của bạn
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Đặt câu hỏi về tích cổ, màu sắc tự nhiên hoặc ý nghĩa tranh..."
            className="w-full min-w-0 bg-transparent border-none text-primary placeholder:text-outline focus:ring-0 text-sm font-body-md"
          />
          <button type="submit" className={`shrink-0 px-6 py-2.5 text-xs tracking-wider ${buttonPrimary}`}>
            Hỏi Cổ Nhân
          </button>
        </form>

        {/* Khối trả lời giám tuyển — BRAND_GUIDELINE §10.9 */}
        <div
          aria-live="polite"
          className="bg-surface p-8 border-l-2 border-l-secondary border-y border-r border-outline-variant/40 transition-all duration-300"
        >
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-outline-variant/30">
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full"></span>
              Lời Giám Tuyển LAMVI
            </span>
            <span className="text-xs text-on-surface-variant font-label-meta text-right">
              {response.answered ? 'Phản hồi tức thì • Cố vấn di sản số' : 'Kho lưu trữ Đông Hồ & Giấy Dó'}
            </span>
          </div>
          <h3 className="font-headline-sm text-lg text-primary mb-3">{response.query}</h3>
          <div className="font-body-md text-on-surface-variant text-sm space-y-3 leading-relaxed">
            {paragraphs ? (
              paragraphs.map((p) => <p key={p}>{p}</p>)
            ) : (
              <p>
                Cổ nhân ghi chép rằng: Trong mỹ cảm phương Đông, ánh sáng không chỉ để soi tỏ vật thể, mà là để
                tạo ra ‘Khoảng Trống’ (Void) cho tâm tưởng thảnh thơi. Câu hỏi của bạn về{' '}
                <em>“{response.query}”</em> phản chiếu tinh thần trân trọng nguồn cội sâu sắc. Nghệ nhân LAMVI
                luôn nỗ lực giữ trọn từng nét chạm khắc mộc bản để câu chuyện ngàn năm ấy tiếp tục tỏa rạng trong
                không gian hiện đại.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
