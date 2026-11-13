export const occasions = {
  birthday: "Sinh nhật",
  anniversary: "Kỷ niệm",
  thankYou: "Cảm ơn",
  milestone: "Cột mốc",
  encouragement: "Động viên",
  longDistance: "Gửi từ xa",
  justBecause: "Tặng bất chợt",
};
const message = [
  "Có những ngày mình chỉ muốn gửi đến bạn một chút bình yên. Một góc nhỏ để ngồi xuống, thở thật chậm, và nhớ rằng bạn luôn được yêu thương.",
  "Chiếc đèn này không thể ôm bạn thay mình. Nhưng mỗi khi bật lên, mong ánh sáng của nó sẽ nhắc bạn rằng: ở đâu đó, có một người đang nghĩ về bạn, bằng tất cả sự dịu dàng.",
  "Mình nhớ những buổi chiều hai đứa ngồi nói đủ chuyện, từ những ước mơ rất lớn đến việc tối nay ăn gì. Những điều bé xíu ấy, hóa ra lại là những điều mình muốn giữ lâu nhất.",
  "Chúc bạn có nhiều ngày nắng đẹp. Còn những hôm mưa, mong bạn luôn tìm được một mái hiên, một tách trà ấm, và một người sẵn lòng lắng nghe.",
  "Cứ đi theo nhịp của riêng mình nhé. Không cần phải rực rỡ mỗi ngày. Chỉ cần được là bạn, thế là đủ rồi.",
];
export const demos = Object.fromEntries(
  Object.keys(occasions).map((occasion) => [
    occasion,
    {
      recipientName: "Linh",
      senderName: "An",
      kind: occasion === "longDistance" ? "video" : "text",
      occasion,
      message,
      videoUrl: "/letter-room/message.webm",
      posterUrl: "/letter-room/poster.jpg",
      captionsUrl: "/letter-room/captions.vtt",
      occasionData: {
        birthday: {
          message: "Tuổi mới, mong mọi điều bạn ấp ủ sẽ tìm được ngày nở hoa.",
        },
        anniversary: {
          date: "13.11.2026",
          message: "Thêm một ngày có nhau, thêm một điều để nhớ.",
          photos: [],
        },
        thankYou: {
          message:
            "Cảm ơn bạn đã ở lại nghe mình kể, vào hôm mình tưởng chẳng ai hiểu.",
        },
        milestone: {
          label: "Đã tốt nghiệp",
          message: "Mình biết bạn đã cố gắng bao nhiêu. Tự hào về bạn lắm!",
        },
        encouragement: {
          message: "Chậm một chút cũng được. Mình vẫn ở đây, cùng bạn.",
        },
        longDistance: {
          places: ["Hà Nội", "Sài Gòn"],
          message: "Hai ô cửa, cùng một vầng trăng.",
        },
        justBecause: {
          icon: "☾",
          message:
            "P.S. Thấy trăng là nhớ bạn. Chỉ vậy thôi, không cần một dịp nào cả.",
        },
      }[occasion],
    },
  ]),
);
export function validateLetter(value) {
  if (
    !value ||
    typeof value.recipientName !== "string" ||
    typeof value.senderName !== "string"
  )
    throw new Error("Thiếu tên người gửi hoặc người nhận");
  if (
    !Object.hasOwn(occasions, value.occasion) ||
    !["text", "video"].includes(value.kind)
  )
    throw new Error("Loại lời chúc không hợp lệ");
  if (
    value.kind === "text" &&
    !(
      typeof value.message === "string" ||
      (Array.isArray(value.message) &&
        value.message.every((p) => typeof p === "string"))
    )
  )
    throw new Error("Thiếu nội dung thư");
  if (
    value.kind === "video" &&
    !(
      typeof value.videoUrl === "string" &&
      /^(\/[^/]|https:\/\/)/.test(value.videoUrl)
    )
  )
    throw new Error("Thiếu đường dẫn video hợp lệ");
  const d = value.occasionData;
  if (d != null && (typeof d !== "object" || Array.isArray(d)))
    throw new Error("Dữ liệu dịp không hợp lệ");
  for (const field of ["photos", "places"]) {
    if (
      d?.[field] != null &&
      (!Array.isArray(d[field]) ||
        !d[field].every((item) => typeof item === "string"))
    )
      throw new Error("Dữ liệu ảnh hoặc địa điểm không hợp lệ");
  }
  return { ...value, occasionData: value.occasionData || {} };
}
export const initialState = { phase: "dark", progress: 0 };
export const PHASE_TIMINGS = {
  lighting: ["LIT", 1800],
  lit: ["FOCUS_ENVELOPE", 900],
  approaching: ["READY", 1200],
  returning: ["RETURNED", 380],
  extracting: ["EXTRACTED", 420],
  lifting: ["READ", 1100],
  surpriseEntering: ["SURPRISE_READY", 1100],
  celebrating: ["CELEBRATED", 1100],
};
export function roomReducer(state, action) {
  const go = (phase, progress = state.progress) => ({
    ...state,
    phase,
    progress,
  });
  switch (action.type) {
    case "LIGHT":
      return state.phase === "dark" ? go("lighting") : state;
    case "LIT":
      return state.phase === "lighting" ? go("lit") : state;
    case "FOCUS_ENVELOPE":
      return state.phase === "lit" ? go("envelope") : state;
    case "APPROACH":
      return state.phase === "envelope" ? go("approaching") : state;
    case "READY":
      return state.phase === "approaching" ? go("ready") : state;
    case "DRAG":
      return state.phase === "ready" && Number.isFinite(action.value)
        ? go("ready", Math.max(0, Math.min(1, action.value)))
        : state;
    case "RELEASE":
      return state.phase === "ready"
        ? go(
            action.cancel || state.progress < 0.4 ? "returning" : "extracting",
            action.cancel || state.progress < 0.4 ? 0 : 1,
          )
        : state;
    case "RETURNED":
      return state.phase === "returning" ? go("ready", 0) : state;
    case "OPEN":
      return state.phase === "ready" ? go("extracting", 1) : state;
    case "EXTRACTED":
      return state.phase === "extracting" ? go("lifting", 1) : state;
    case "READ":
      return state.phase === "lifting" ? go("reading", 1) : state;
    case "SURPRISE":
      return state.phase === "reading" ? go("surpriseEntering") : state;
    case "SURPRISE_READY":
      return state.phase === "surpriseEntering" ? go("surprise") : state;
    case "BLOW":
    case "REVEAL":
      return state.phase === "surprise" ? go("celebrating") : state;
    case "CELEBRATED":
      return state.phase === "celebrating" ? go("celebrated") : state;
    default:
      return state;
  }
}
export function shotForPhase(phase, occasion = "birthday") {
  if (phase === "dark") return "room";
  if (["lighting", "lit"].includes(phase)) return "switch";
  if (phase === "envelope") return "envelope";
  if (["approaching", "ready", "returning", "extracting"].includes(phase))
    return "slot";
  if (["lifting", "reading"].includes(phase)) return "letter";
  return occasion === "justBecause" ? "lamp" : "reverse";
}
