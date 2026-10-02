import { LOCALES } from '../i18n.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const COPY = {
  vi: {
    recoverySubject: 'Đặt lại mật khẩu LAMVI',
    recoveryBody: 'Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Liên kết có hiệu lực trong 1 giờ và chỉ dùng được một lần.',
    recoveryCta: 'Đặt lại mật khẩu',
    recoveryIgnore: 'Nếu không phải bạn, hãy bỏ qua thư này — mật khẩu của bạn không thay đổi.',
    changedSubject: 'Mật khẩu LAMVI đã được đổi',
    changedBody: 'Mật khẩu tài khoản của bạn vừa được thay đổi và mọi thiết bị đã bị đăng xuất.',
    changedWarn: 'Nếu không phải bạn, hãy dùng "Quên mật khẩu" ngay để lấy lại tài khoản.',
  },
  en: {
    recoverySubject: 'Reset your LAMVI password',
    recoveryBody: 'You (or someone else) asked to reset the password for this account. The link is valid for 1 hour and can be used once.',
    recoveryCta: 'Reset password',
    recoveryIgnore: 'If this was not you, ignore this email — your password is unchanged.',
    changedSubject: 'Your LAMVI password was changed',
    changedBody: 'The password of your account was just changed and all devices were signed out.',
    changedWarn: 'If this was not you, use "Forgot password" right away to recover your account.',
  },
  zh: {
    recoverySubject: '重置 LAMVI 密码',
    recoveryBody: '您（或他人）请求重置此账户的密码。链接 1 小时内有效，且只能使用一次。',
    recoveryCta: '重置密码',
    recoveryIgnore: '如果不是您本人操作，请忽略此邮件，密码不会改变。',
    changedSubject: '您的 LAMVI 密码已更改',
    changedBody: '您账户的密码刚刚被更改，所有设备已退出登录。',
    changedWarn: '如果不是您本人操作，请立即使用“忘记密码”找回账户。',
  },
}
const copy = (lang) => COPY[LOCALES.includes(lang) ? lang : 'vi']

const wrap = (paragraphs, cta) =>
  `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1b2a41;line-height:1.55">${paragraphs
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')}${
    cta ? `<p><a href="${esc(cta.url)}" style="display:inline-block;background:#1b2a41;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none">${esc(cta.label)}</a></p>` : ''
  }</div>`

// `url` chứa token một lần trong fragment (#t=…) nên không vào log máy chủ/Referer
export function recoveryMail({ lang, url }) {
  const c = copy(lang)
  return {
    subject: c.recoverySubject,
    text: `${c.recoveryBody}\n\n${url}\n\n${c.recoveryIgnore}`,
    html: wrap([c.recoveryBody, c.recoveryIgnore], { url, label: c.recoveryCta }),
  }
}

export function passwordChangedMail({ lang }) {
  const c = copy(lang)
  return {
    subject: c.changedSubject,
    text: `${c.changedBody}\n\n${c.changedWarn}`,
    html: wrap([c.changedBody, c.changedWarn]),
  }
}
