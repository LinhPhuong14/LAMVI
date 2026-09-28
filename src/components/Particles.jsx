// Đốm lửa bay lên — chỉ dùng CSS keyframes (transform/opacity) để chạy trên compositor.
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
        <span
          key={i}
          className={`ember ${i % 2 === 0 ? 'drift-r' : 'drift-l'}`}
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
