// G-108, D-105: các đoạn của câu chuyện mẫu đèn cách nhau bằng dòng trống
export const storyParagraphs = (story) => (story ? String(story).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) : [])
