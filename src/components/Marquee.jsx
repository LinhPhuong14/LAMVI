import { Fragment } from 'react'
import { useI18n } from '../i18n/index.js'
import { Lotus } from './Motifs'

// Mỗi dòng là một <span>; bản sao thứ hai ẩn với trình đọc màn hình
function Line({ items, hidden }) {
  return (
    <span className="marquee-line" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <Fragment key={item}>
          {item}
          <Lotus />
        </Fragment>
      ))}
    </span>
  )
}

export default function Marquee() {
  const { t } = useI18n()
  const items = t('marquee')
  return (
    <div className="marquee">
      <div className="marquee-track">
        <Line items={items} />
        <Line items={items} hidden />
      </div>
    </div>
  )
}
