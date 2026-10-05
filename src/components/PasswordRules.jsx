import { useI18n } from '../i18n/index.js'
import { passwordRules } from '../lib/password.js'

/**
 * Danh sách quy tắc mật khẩu hiện theo từng phím (D-91). Chỉ hướng dẫn: server luôn kiểm lại bằng cùng
 * một module (src/lib/password.js). Khi chưa gõ gì thì không tô đỏ — chỉ hiện việc cần làm.
 *
 * @param {object} p
 * @param {string} p.password
 * @param {string} [p.confirm] truyền vào để thêm quy tắc "hai ô khớp nhau"
 */
export default function PasswordRules({ password, confirm }) {
  const { t } = useI18n()
  const typed = password.length > 0
  const shown = passwordRules(password).map((r) => ({ id: r.id, ok: r.ok }))
  if (confirm !== undefined) shown.push({ id: 'match', ok: typed && password === confirm })
  return (
    <div className="pw-rules">
      <p className="pw-rules-title">{t('auth.pwRules.title')}</p>
      <ul>
        {shown.map((r) => (
          <li key={r.id} className={r.ok ? 'is-ok' : typed ? 'is-bad' : ''} data-rule={r.id}>
            <span aria-hidden="true" className="pw-rules-mark">
              {r.ok ? '✓' : '○'}
            </span>
            {t(`auth.pwRules.${r.id}`)}
            <span className="sr-only"> — {r.ok ? t('auth.pwRules.ok') : t('auth.pwRules.todo')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
