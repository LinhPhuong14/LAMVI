// Mây — nhân vật đám mây (FR-AI-001)
export default function MayAvatar({ size = 56, mood = 'happy' }) {
  const sleepy = mood === 'sleepy'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="may-avatar">
      <path
        d="M18 50c-7.2 0-12-5-12-11.2 0-5.9 4.4-10.5 10.1-11C17.4 19.9 23.9 14 32 14c7.4 0 13.5 5 15.2 11.8 6.3.2 10.8 5.2 10.8 11.3C58 43.8 53 50 45.8 50H18z"
        fill="#fbf6ec"
        stroke="#c99a4b"
        strokeWidth="2"
      />
      {sleepy ? (
        <>
          <path d="M23 35q3 2 6 0" stroke="#6b4226" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M35 35q3 2 6 0" stroke="#6b4226" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="26" cy="34" r="2.6" fill="#3a2c22" />
          <circle cx="38" cy="34" r="2.6" fill="#3a2c22" />
        </>
      )}
      <path d="M28.5 40q3.5 3 7 0" stroke="#6b4226" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="21" cy="39" rx="3" ry="1.8" fill="#f2a68f" opacity="0.7" />
      <ellipse cx="43" cy="39" rx="3" ry="1.8" fill="#f2a68f" opacity="0.7" />
    </svg>
  )
}
