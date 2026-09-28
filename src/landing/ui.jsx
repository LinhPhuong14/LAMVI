// Viền focus nhìn thấy được cho mọi phần tử tương tác — BRAND_GUIDELINE §12
export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

export const buttonPrimary = `bg-primary-container text-surface hover:bg-secondary transition-colors duration-300 font-label-caps text-label-caps uppercase tracking-widest ${focusRing}`

export function Icon({ name, className = '' }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  )
}

// Nhãn in hoa màu son có gạch ngang phía trước — BRAND_GUIDELINE §10.2
export function Eyebrow({ children, center = false, className = 'mb-4' }) {
  return (
    <div className={`flex items-center gap-2 ${center ? 'justify-center' : ''} ${className}`}>
      <span className="w-6 h-px bg-secondary"></span>
      <span className="font-label-caps text-label-caps text-secondary uppercase tracking-widest">
        {children}
      </span>
    </div>
  )
}

export function SectionTitle({ children, className = '' }) {
  return (
    <h2
      className={`font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary ${className}`}
    >
      {children}
    </h2>
  )
}
