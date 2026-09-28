const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

// T-09: tiền là số nguyên VND
export const formatVnd = (amount) => vnd.format(amount)
