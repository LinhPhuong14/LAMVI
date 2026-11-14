import { useId, useState } from 'react'
import './wishes.css'

// Original words written for LAMVI; no quotation or attribution to another author.
const LAMVI_WISHES = Object.freeze(Object.fromEntries(Object.entries({
  birthday: [
    'Tuổi mới, mong bạn có thêm những ngày được sống đúng điều mình thích.',
    'Chúc những điều bạn âm thầm vun vén sớm tìm được mùa nở hoa.',
    'Mong chiếc bánh năm nay có vị ngọt của những người vẫn ở bên bạn.',
  ],
  anniversary: [
    'Mong mình còn nhiều ngày bình thường để cùng nhau nhớ lại.',
    'Một ngày được đánh dấu, và bao điều nhỏ được giữ trong lòng.',
    'Chúc những mùa sau, hai người vẫn tìm thấy nhau trong một câu chuyện cũ.',
  ],
  thankYou: [
    'Có những điều tử tế rất nhỏ, nhưng làm một ngày của ai đó ấm hơn.',
    'Mong sự dịu dàng bạn đã trao cũng có một lối trở về bên bạn.',
    'Cảm ơn vì một lần có mặt, để người khác thấy mình không đơn độc.',
  ],
  milestone: [
    'Chúc bạn có một khoảng nghỉ thật vui trước khi mở cánh cửa tiếp theo.',
    'Điều hôm nay đạt được có cả những ngày bạn đã lặng lẽ cố gắng.',
    'Mong bạn bước tiếp với niềm vui của người biết mình đã đi được bao xa.',
  ],
  encouragement: [
    'Hôm nay đi chậm một chút cũng được, bạn vẫn đang trên đường.',
    'Mong bạn tìm được một góc yên để thở và bắt đầu lại khi sẵn sàng.',
    'Chưa cần nghĩ hết ngày mai; cứ chăm chút cho mình trong hôm nay đã nhé.',
  ],
  longDistance: [
    'Hai nơi có thể khác giờ lên đèn, nhưng lời thương vẫn tìm được nhau.',
    'Mong những điều nhỏ kể mỗi ngày làm quãng đường giữa hai người gần lại.',
    'Chúc lần gặp tới có đủ thời gian cho cả những câu chuyện chưa kể hết.',
  ],
  justBecause: [
    'Không cần một ngày đặc biệt để dành cho bạn một điều ấm áp.',
    'Mong giữa ngày bận rộn, bạn vẫn có một phút ngồi yên bên ánh đèn.',
    'Có những món quà chỉ muốn nói rằng: hôm nay có người nhớ đến bạn.',
  ],
}).map(([occasion, wishes]) => [occasion, Object.freeze(wishes)])))

function WishesCard({ wishes }) {
  const headingId = useId()
  const [index, setIndex] = useState(0)
  return <section className="lr-wishes" aria-labelledby={headingId}>
    <h3 id={headingId} className="lr-wishes-heading">Một lời chúc từ LAMVI</h3>
    <div className="lr-wishes-message" role="status" aria-live="polite" aria-atomic="true">
      <p className="lr-wishes-quote">{wishes[index]}</p>
      <span className="lr-wishes-count" aria-label={`Lời chúc ${index + 1} trong ${wishes.length}`}>{index + 1} / {wishes.length}</span>
    </div>
    <button type="button" className="lr-wishes-next" onClick={() => setIndex(current => (current + 1) % wishes.length)}>
      Lời chúc tiếp theo <span aria-hidden="true">→</span>
    </button>
  </section>
}

export default function LamviWishes({ occasion } = {}) {
  const key = Object.hasOwn(LAMVI_WISHES, occasion) ? occasion : 'justBecause'
  return <WishesCard key={key} wishes={LAMVI_WISHES[key]} />
}
