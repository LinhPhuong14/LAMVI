import { motion } from 'framer-motion'

const EMBERS = [
  { left: '12%', size: 6, delay: 0, duration: 7 },
  { left: '22%', size: 4, delay: 1.2, duration: 9 },
  { left: '35%', size: 5, delay: 0.6, duration: 8 },
  { left: '58%', size: 4, delay: 2, duration: 10 },
  { left: '68%', size: 7, delay: 0.3, duration: 7.5 },
  { left: '78%', size: 5, delay: 1.6, duration: 8.5 },
  { left: '88%', size: 4, delay: 0.9, duration: 9.5 },
]

export default function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {EMBERS.map((e, i) => (
        <motion.span
          key={i}
          className="ember"
          style={{ left: e.left, width: e.size, height: e.size }}
          animate={{
            y: [0, -180, -360],
            opacity: [0, 0.9, 0],
            x: [0, i % 2 === 0 ? 14 : -14, 0],
          }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
