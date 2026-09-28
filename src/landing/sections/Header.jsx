import { navLinks } from '../data.js'
import { Icon, focusRing } from '../ui.jsx'

export default function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 dark:bg-primary-container/90 backdrop-blur-md text-primary dark:text-inverse-primary border-b border-outline-variant/40 dark:border-outline/30 transition-all duration-300 ease-out">
      <div className="w-full px-margin-mobile md:px-margin max-w-7xl mx-auto flex justify-between items-center h-20">
        {/* Wordmark — BRAND_GUIDELINE §3.1 */}
        <a className={`flex flex-col group ${focusRing}`} href="#top" aria-label="LÂM VỊ — về đầu trang">
          <span className="flex items-center gap-1.5">
            <span className="font-headline-sm text-headline-sm tracking-wider uppercase text-primary dark:text-inverse-primary font-medium">
              LÂM VỊ
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          </span>
          <span className="font-label-caps text-[0.625rem] tracking-[0.2em] text-outline uppercase -mt-0.5">
            Artisanal Light &amp; Folk Art Archive
          </span>
        </a>

        <nav aria-label="Điều hướng chính" className="hidden md:flex items-center space-x-8">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              lang="en"
              className={`font-label-caps text-label-caps uppercase tracking-widest transition-colors duration-300 hover:text-secondary dark:hover:text-secondary-fixed ${focusRing} ${
                i === 0
                  ? 'text-primary dark:text-inverse-primary border-b border-primary dark:border-inverse-primary pb-1'
                  : 'text-on-surface-variant dark:text-outline-variant'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center space-x-5">
          <a
            className={`hidden sm:inline-flex items-center gap-1.5 text-on-surface-variant hover:text-secondary font-label-caps text-label-caps uppercase tracking-wider transition-colors ${focusRing}`}
            href="#curatorial-companion"
          >
            <Icon name="menu_book" className="text-[16px]" />
            <span>Hỏi Chuyện Cổ</span>
          </a>
          <a
            className={`inline-flex items-center px-4 py-2 bg-primary-container text-surface font-label-caps text-label-caps uppercase tracking-widest hover:bg-secondary transition-colors duration-300 ${focusRing}`}
            href="#inquire"
          >
            Inquire
          </a>
        </div>
      </div>
    </header>
  )
}
