import { normalizeBrand } from '../mail/layout.js'

// Deliberately project only public business data, never spread config/mail objects.
export function publicSite(config = {}) {
  const b = normalizeBrand(config.mail?.brand)
  return {
    name: b.name,
    legalName: b.legalName,
    address: b.address,
    supportEmail: b.supportEmail,
    phone: b.phone,
    hours: b.hours,
    social: b.social,
  }
}
