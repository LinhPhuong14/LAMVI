import { footerLinks } from '../data.js'
import { focusRing } from '../ui.jsx'

const linkClass = `block font-label-caps text-label-caps text-on-surface-variant dark:text-outline-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-300 ${focusRing}`
const headingClass = 'font-label-caps text-xs uppercase text-primary font-semibold tracking-wider block mb-3'

export default function Footer() {
  return (
    <footer className="bg-surface-container dark:bg-inverse-surface text-primary dark:text-inverse-primary border-t border-outline-variant/60 dark:border-outline/40">
      <div className="w-full px-margin-mobile md:px-margin py-space-xl max-w-7xl mx-auto flex flex-col gap-space-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-4">
            <span className="font-headline-md text-headline-md text-primary dark:text-inverse-primary tracking-wide block mb-2">
              LÂM VỊ
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant max-w-sm mb-4 leading-relaxed">
              Không gian lưu giữ và tái hiện mỹ thuật dân gian Việt Nam qua nghệ thuật điêu khắc ánh sáng đương
              đại.
            </p>
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest block">
              Hà Nội • Bắc Ninh • Paris
            </span>
          </div>

          <nav aria-label="Liên kết chân trang" className="md:col-span-5 grid grid-cols-2 gap-4">
            {footerLinks.map((group) => (
              <div key={group.heading} className="space-y-2.5">
                <span className={headingClass}>{group.heading}</span>
                {group.links.map((link) => (
                  <a key={link.label} className={linkClass} href={link.href} lang="en">
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>

          <address className="md:col-span-3 not-italic text-xs text-on-surface-variant dark:text-outline-variant space-y-2 font-body-sm">
            <span className={headingClass}>LAMVI Atelier &amp; Gallery</span>
            <p>42 Hàng Bạc, Phường Hàng Bạc, Hoàn Kiếm, Hà Nội</p>
            <p>Mở cửa thưởng lãm: 09:00 — 18:30 (Hẹn trước)</p>
            <p className="text-primary font-medium">
              <a className={`hover:text-secondary ${focusRing}`} href="mailto:contact@lamvi.art">
                contact@lamvi.art
              </a>{' '}
              •{' '}
              <a className={`hover:text-secondary ${focusRing}`} href="tel:+842438289912">
                +84 (0) 24 3828 9912
              </a>
            </p>
          </address>
        </div>

        <div className="pt-6 border-t border-outline-variant/30 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-on-surface-variant dark:text-outline-variant font-body-sm text-center md:text-left">
          <p lang="en">© 2025 LÂM VỊ ARTISANAL ARCHIVE. CRAFTED BETWEEN HANOI &amp; PARIS. PRESERVING SACRED METIERS.</p>
          <div className="flex items-center space-x-6 font-label-caps text-[0.65rem] uppercase tracking-wider">
            <span>Tôn Trọng Bản Quyền Dân Gian</span>
            <span>Bảo Trợ Nghệ Nhân Kinh Bắc</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
