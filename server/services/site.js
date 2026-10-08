import { normalizeBrand } from '../mail/layout.js'
import { PRICING_SETTING_KEY, normalizePricingConfig } from '../domain/pricing.js'

// Phí ship công khai (đọc cùng cấu hình tính giá với checkout)
export async function getShippingPolicy(repo) {
  const { shippingFee, freeShippingFrom } = normalizePricingConfig((await repo.getSetting?.(PRICING_SETTING_KEY))?.value)
  return { fee: shippingFee, freeFrom: freeShippingFrom }
}

// Deliberately project only public business data, never spread config/mail objects.
export function publicSite(config = {}) {
  const b = normalizeBrand(config.mail?.brand)
  return {
    name: b.name,
    legalName: b.legalName,
    address: b.address,
    registration: b.registration,
    workshopAddress: b.workshopAddress,
    moitUrl: b.moitUrl,
    zalo: b.social.find((x) => x.label === 'Zalo')?.url ?? '',
    // Form liên hệ chỉ bật khi có hộp thư nhận và nhà cung cấp thư gửi được
    contactForm: Boolean(b.supportEmail && config.mail?.from && (config.mail.resendApiKey || config.mail.brevoApiKey)),
    supportEmail: b.supportEmail,
    phone: b.phone,
    hours: b.hours,
    social: b.social,
    // Checkout ẩn/vô hiệu payOS khi chưa có khoá, thay vì để khách gặp lỗi ở bước cuối
    payosEnabled: Boolean(config.payosEnabled),
  }
}
