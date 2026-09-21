import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const FAQ_ITEMS = [
  {
    q: 'Video và lời chúc lưu giữ được bao lâu?',
    a: 'Vĩnh viễn. Mỗi mã QR gắn với một kho lưu trữ riêng, không giới hạn thời gian xem lại.',
  },
  {
    q: 'Tôi có thể chỉnh sửa lời chúc sau khi đặt hàng không?',
    a: 'Có. Bạn có thể ghi lại hoặc chỉnh sửa lời chúc/video trong dashboard cho đến khi đèn được đóng gói.',
  },
  {
    q: 'Người nhận có cần tải ứng dụng để xem không?',
    a: 'Không cần. Chỉ cần quét mã bằng camera điện thoại, nội dung mở ngay trên trình duyệt.',
  },
  {
    q: 'Đèn giấy dó có dễ vỡ khi vận chuyển không?',
    a: 'Khung tre và giấy dó được gia cố, đóng gói trong hộp có lớp đệm chuyên dụng cho hàng thủ công dễ vỡ.',
  },
  {
    q: 'Thời gian hoàn thành một chiếc đèn đặt riêng là bao lâu?',
    a: 'Trung bình 5–7 ngày làm việc, tuỳ theo mẫu và khối lượng đơn tại xưởng vào thời điểm đặt hàng.',
  },
]

export default function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <div className="faq-list">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i
        return (
          <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.q}>
            <button
              className="faq-question"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span className="faq-icon">{isOpen ? '−' : '+'}</span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  className="faq-answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p>{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
