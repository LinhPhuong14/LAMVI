import { useState } from 'react'
import { artifacts, kelvinModes } from '../data.js'
import { Eyebrow, Icon, SectionTitle, focusRing } from '../ui.jsx'

const toggleOn = 'bg-primary-container text-surface hover:bg-secondary'
const toggleOff = 'bg-surface-container-high text-primary hover:bg-outline-variant'

function ArtifactCard({ artifact, lit, onToggle, filter }) {
  return (
    <article className="bg-surface-container-low border border-outline-variant/60 p-6 flex flex-col justify-between transition-all duration-500 group hover:border-secondary">
      <div>
        <div className="flex justify-between items-center gap-2 mb-4">
          <span className="font-label-caps text-label-caps text-secondary uppercase tracking-widest">
            {artifact.edition}
          </span>
          <span className="px-2 py-0.5 text-[0.65rem] font-label-caps bg-surface-container border border-outline-variant uppercase">
            {artifact.material}
          </span>
        </div>

        <div
          className={`relative aspect-[4/5] p-4 border border-outline-variant/40 overflow-hidden mb-6 transition-colors duration-500 flex items-center justify-center ${
            lit ? 'bg-[#241F1A] lantern-bloom-warm' : 'bg-surface'
          }`}
        >
          <img
            alt={artifact.alt}
            className={`max-h-full ${artifact.fit} transition-all duration-700`}
            loading="lazy"
            src={artifact.image}
            style={{ filter }}
          />
          <div
            className={`absolute inset-0 ${artifact.glow} pointer-events-none transition-opacity duration-700 mix-blend-color-dodge ${
              lit ? 'opacity-100' : 'opacity-0'
            }`}
          ></div>
        </div>

        <div className="space-y-2">
          <h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
            {artifact.title}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{artifact.desc}</p>
        </div>

        <dl className="mt-4 pt-4 border-t border-outline-variant/40 text-[0.75rem] font-label-meta text-on-surface-variant space-y-1">
          {artifact.specs.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt>{label}:</dt>
              <dd className="text-primary font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 pt-4 border-t border-outline-variant/60 flex items-center justify-between">
        <button
          type="button"
          aria-pressed={lit}
          className={`inline-flex items-center gap-1.5 font-label-caps text-xs text-primary hover:text-secondary uppercase tracking-wider transition-colors ${focusRing}`}
          onClick={onToggle}
        >
          <Icon name="lightbulb" className="text-base" />
          <span>{lit ? 'Tranh Thô Ban Ngày' : 'Bật Ánh Đêm'}</span>
        </button>
        <a
          className={`font-label-caps text-xs text-secondary hover:underline uppercase tracking-wider ${focusRing}`}
          href="#inquire"
        >
          Thưởng lãm →
        </a>
      </div>
    </article>
  )
}

export default function Collection() {
  const [kelvin, setKelvin] = useState('warm')
  const [litIds, setLitIds] = useState(() => new Set())

  const toggleLamp = (id) =>
    setLitIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section id="collection" className="scroll-mt-20 py-space-xl bg-surface border-b border-outline-variant/40">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
          <div>
            <Eyebrow className="mb-2">Tuyển Tập Tác Phẩm Lưu Giữ</Eyebrow>
            <SectionTitle>Điêu Khắc Ánh Sáng LAMVI</SectionTitle>
          </div>

          {/* Nhiệt độ màu toàn cục — áp bộ lọc lên ảnh mọi tác phẩm */}
          <div
            role="group"
            aria-label="Chọn nhiệt độ màu ánh sáng"
            className="mt-6 md:mt-0 p-3 bg-surface-container border border-outline-variant/60 flex flex-wrap items-center gap-4 text-xs font-label-caps"
          >
            <span className="text-on-surface uppercase tracking-wider flex items-center gap-1">
              <Icon name="wb_incandescent" className="text-sm" />
              Quang Nhiệt:
            </span>
            {Object.entries(kelvinModes).map(([mode, { label }]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={kelvin === mode}
                className={`px-2.5 py-1 transition-colors ${kelvin === mode ? toggleOn : toggleOff} ${focusRing}`}
                onClick={() => setKelvin(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              lit={litIds.has(artifact.id)}
              onToggle={() => toggleLamp(artifact.id)}
              filter={kelvinModes[kelvin].filter}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
