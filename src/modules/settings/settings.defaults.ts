// Default business and delivery settings from the approved Care implementation.
import { DEFAULT_WEIGHTS, type Weights } from '../scoring/scoring.constants.js';

export type JourneyKey =
  | 'order_confirm' | 'payment_received' | 'payment_reminder' | 'trip_prep' | 'flight_checkin' | 'survey' | 'thank_you'
  | 'review_invite' | 'tier_up' | 'post_trip' | 'trip_anniversary' | 'winback' | 'lead_nurture' | 'birthday'
  | 'partner_trip_report' | 'partner_quarterly' | 'partner_season';

// Thứ tự = thứ tự ưu tiên khi một khách có nhiều tin chăm sóc trong cùng ngày. "step" là bước trong Quy trình chăm sóc v1.
export const JOURNEYS: Record<JourneyKey, { label: string; marketing: boolean; desc: string; step?: string }> = {
  order_confirm: { label: 'Xác nhận đơn mới', marketing: false, desc: 'Trong ngày tạo đơn: dịch vụ, số tiền, còn phải thanh toán', step: 'QT2 · 2.1' },
  payment_received: { label: 'Xác nhận đã nhận thanh toán', marketing: false, desc: 'Khi kế toán duyệt phiếu thu của khách' },
  payment_reminder: { label: 'Nhắc thanh toán trước khởi hành', marketing: false, desc: 'Khách còn nợ, theo các mốc ngày trước khởi hành' },
  trip_prep: { label: 'Nhắc chuẩn bị trước khởi hành', marketing: false, desc: '1–3 ngày trước khởi hành; gộp nhắc thanh toán nếu còn nợ' },
  flight_checkin: { label: 'Nhắc check-in chuyến bay', marketing: false, desc: 'Một ngày trước ngày bay (đơn có vé máy bay)', step: 'QT2 · 2.7' },
  survey: { label: 'Cảm ơn + khảo sát sau chuyến đi', marketing: false, desc: 'N ngày sau ngày về: khách chấm 0–10 ngay trong email. Điểm thấp tạo việc gấp cho sếp, điểm cao mời đánh giá', step: 'QT3 · 3.2' },
  thank_you: { label: 'Cảm ơn sau chuyến đi (bản cũ, không khảo sát)', marketing: false, desc: 'Ngày sau khi khách về. Đã thay bằng "Cảm ơn + khảo sát"' },
  review_invite: { label: 'Mời đánh giá, giới thiệu bạn bè', marketing: true, desc: 'Khách chấm 9–10 điểm', step: 'QT3 · 3.5' },
  tier_up: { label: 'Chúc mừng lên hạng thành viên', marketing: true, desc: 'Khi hạng thành viên tăng (Bạc, Vàng, Kim cương)', step: 'QT4' },
  partner_trip_report: { label: 'Đối tác: báo cáo sau chuyến đi', marketing: false, desc: 'Đại lý, doanh nghiệp: N ngày sau ngày về, tóm tắt chuyến đi, điểm khảo sát của khách, mời góp ý', step: 'Đối tác' },
  partner_quarterly: { label: 'Đối tác: tổng kết hợp tác quý', marketing: false, desc: 'Đầu mỗi quý: số đơn, giá trị đã hợp tác quý trước, chính sách hợp tác; đối tác có đơn trong quý trước', step: 'Đối tác' },
  partner_season: { label: 'Đối tác: bản tin mùa vụ', marketing: true, desc: 'Trước các mùa cao điểm (Tết, mùa cao điểm, cuối năm…): mời đặt sớm, giữ chỗ; mỗi mùa một lần', step: 'Đối tác' },
  post_trip: { label: 'Gợi ý chuyến tiếp theo', marketing: true, desc: 'Sau chuyến đi N ngày, gợi ý tour theo dự đoán điểm đến' },
  trip_anniversary: { label: 'Kỷ niệm 1 năm chuyến đi', marketing: true, desc: 'Đúng 1 năm sau ngày khởi hành, gợi ý chuyến mới' },
  winback: { label: 'Đánh thức khách lâu không quay lại', marketing: true, desc: 'Nhóm Cần giữ chân, Ngủ đông; tối đa 1 lần/quý' },
  lead_nurture: { label: 'Nuôi dưỡng khách tiềm năng', marketing: true, desc: 'Nhóm Tiềm năng ấm; tour đúng nhu cầu đã hỏi; 1 lần/tháng' },
  birthday: { label: 'Chúc mừng sinh nhật', marketing: true, desc: 'Đúng ngày sinh nhật (nếu CRM có ngày sinh), kèm ưu đãi theo nhóm' },
};

export const DEFAULT_TEMPLATES: Partial<Record<JourneyKey, { subject: string; body: string }>> = {
  partner_trip_report: {
    subject: 'Báo cáo chuyến đi {{ten_chuyen}} – đơn {{ma_don}}',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nNhóm du lịch demo xin cảm ơn Quý đối tác đã tin tưởng hợp tác cho chuyến đi {{ten_chuyen}} (đơn {{ma_don}}, khởi hành {{ngay_di}}, về {{ngay_ve}}, {{so_khach}} khách).\n\n{{danh_gia}}\n\nMọi góp ý của Quý đối tác giúp Nhóm demo phục vụ đoàn sau tốt hơn. Quý đối tác có thể trả lời email này hoặc bấm nút bên dưới.',
  },
  partner_quarterly: {
    subject: 'Tổng kết hợp tác {{quy}} – {{ten}} và Nhóm du lịch demo',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nTrong {{quy}}, Quý đối tác đã cùng Nhóm demo thực hiện {{so_don}} đơn với tổng giá trị {{gia_tri}} ({{dich_vu}}). Nhóm du lịch demo trân trọng cảm ơn sự đồng hành của Quý đối tác.\n\n{{chinh_sach}}\n\nNhân viên {{sale}} luôn sẵn sàng hỗ trợ kế hoạch quý tới. Quý đối tác cần báo giá, giữ chỗ, vui lòng bấm nút bên dưới hoặc trả lời email này.',
  },
  partner_season: {
    subject: '{{mua}}: Nhóm demo mở nhận đặt chỗ cho đối tác',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nSắp tới là {{mua}}, giai đoạn nhu cầu tăng cao và vé máy bay, khách sạn thường kín sớm. Nhóm du lịch demo mở nhận giữ chỗ sớm cho đối tác với giá tốt.\n\n{{chinh_sach}}\n\nQuý đối tác gửi kế hoạch (điểm đến, ngày đi, số khách) qua nút bên dưới, nhân viên {{sale}} sẽ báo giá trong ngày làm việc.',
  },
  order_confirm: {
    subject: 'Xác nhận đơn {{ma_don}} – {{ten_chuyen}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nNhóm du lịch demo xác nhận đã nhận đơn {{ma_don}}: {{ten_chuyen}}, ngày đi {{ngay_di}}.\nTổng giá trị: {{tong_tien}}. Đã thanh toán: {{da_tra}}. Còn lại: {{con_lai}}.\n\nNhân viên {{sale}} sẽ đồng hành cùng Quý khách đến khi hoàn tất chuyến đi. Quý khách cần hỗ trợ, vui lòng trả lời email này hoặc gọi hotline.',
  },
  flight_checkin: {
    subject: 'Nhắc check-in chuyến bay ngày {{ngay_di}} – đơn {{ma_don}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nChuyến bay của Quý khách ({{ten_chuyen}}) khởi hành ngày {{ngay_di}}. Quý khách có thể làm thủ tục trực tuyến (check-in online) trên trang của hãng bay từ 24 giờ trước giờ bay, và nên có mặt tại sân bay trước 3 giờ với chuyến quốc tế, 2 giờ với chuyến nội địa.\n\nChúc Quý khách chuyến đi thuận lợi!',
  },
  survey: {
    subject: 'Cảm ơn Quý khách đã đi {{ten_chuyen}} cùng Nhóm demo',
    body: 'Kính gửi Quý khách {{ten}},\n\nCảm ơn Quý khách đã tin tưởng Nhóm du lịch demo cho chuyến đi {{ten_chuyen}}. Mong Quý khách đã có những ngày thật đáng nhớ.\n\nĐể Nhóm demo phục vụ tốt hơn, Quý khách vui lòng dành 5 giây chấm điểm chuyến đi (bấm vào một số bên dưới):',
  },
  review_invite: {
    subject: 'Cảm ơn {{ten}} đã chấm {{diem}} điểm cho Nhóm demo',
    body: 'Kính gửi Quý khách {{ten}},\n\nNhóm du lịch demo rất vui khi Quý khách hài lòng với chuyến đi vừa qua. Nếu được, Quý khách có thể dành một phút chia sẻ cảm nhận để nhiều người biết đến Nhóm demo hơn:\n{{link_danh_gia}}\n\n{{gioi_thieu}}',
  },
  tier_up: {
    subject: 'Chúc mừng {{ten}} trở thành khách hàng hạng {{hang}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nCảm ơn Quý khách đã luôn đồng hành cùng Nhóm du lịch demo. Quý khách vừa trở thành khách hàng hạng {{hang}}.\n\n{{quyen_loi}}\n\nNhân viên {{sale}} luôn sẵn sàng hỗ trợ Quý khách cho những chuyến đi tiếp theo.',
  },
  post_trip: {
    subject: '{{ten}} ơi, chuyến đi tiếp theo đến {{diem_den_goi_y}}?',
    body: 'Kính gửi Quý khách {{ten}},\n\nCảm ơn Quý khách đã đồng hành cùng Nhóm du lịch demo trong chuyến đi vừa qua. Nhiều khách hàng sau chuyến đi tương tự đã chọn {{diem_den_goi_y}} cho hành trình tiếp theo. Nhóm demo xin gợi ý một số tour dưới đây.\n\n{{uu_dai}}',
  },
  trip_anniversary: {
    subject: '1 năm trước, {{ten}} đang ở {{diem_den_ky_niem}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nĐúng một năm trước, Quý khách đã cùng Nhóm du lịch demo khám phá {{diem_den_ky_niem}}. Cảm ơn Quý khách đã tin tưởng! Năm nay, Nhóm demo xin gợi ý hành trình đến {{diem_den_goi_y}}.\n\n{{uu_dai}}',
  },
  winback: {
    subject: 'Nhóm demo nhớ Quý khách – ưu đãi dành riêng cho {{ten}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nĐã lâu Nhóm du lịch demo chưa có dịp đồng hành cùng Quý khách. Chúng tôi vừa mở bán nhiều hành trình mới và xin dành tặng Quý khách ưu đãi đặc biệt.\n\n{{uu_dai}}',
  },
  lead_nurture: {
    subject: 'Gợi ý tour {{diem_den_goi_y}} cho {{ten}}',
    body: 'Kính gửi Quý khách {{ten}},\n\nCảm ơn Quý khách đã quan tâm đến tour {{diem_den_goi_y}}. Nhóm demo xin gửi các lịch khởi hành gần nhất để Quý khách tham khảo. Nhân viên {{sale}} luôn sẵn sàng tư vấn chi tiết.\n\n{{uu_dai}}',
  },
  birthday: {
    subject: 'Chúc mừng sinh nhật {{ten}}!',
    body: 'Kính gửi Quý khách {{ten}},\n\nNhóm du lịch demo chúc Quý khách một tuổi mới thật nhiều sức khỏe, niềm vui và những chuyến đi đáng nhớ.\n\n{{uu_dai}}',
  },
};

export const DEFAULTS = {
  smtp: { host: '', port: 465, secure: true, user: '', passEnc: '', from: '' },
  testTo: '',
  tourwell: { url: '', tokenEnc: '', useSample: false },
  publicUrl: 'http://localhost:3030', // địa chỉ công khai cho link hủy nhận tin, đo mở/bấm
  sending: {
    perMinute: 20, // tốc độ gửi (hosting thường giới hạn số email/giờ)
    quietStart: '20:00', // không gửi tin quảng cáo từ giờ này
    quietEnd: '08:00', // đến giờ này
    marketingPerWeek: 2, // tối đa tin quảng cáo mỗi khách mỗi 7 ngày
    subjectPrefix: '', // tiền tố tiêu đề tin quảng cáo nếu quy định yêu cầu [CẦN KIỂM Nghị định 91/2020]
  },
  schedule: { syncTime: '02:00', journeyTime: '09:00' },
  weights: { ...DEFAULT_WEIGHTS } as Weights,
  journeys: {
    enabled: {
      order_confirm: true, payment_received: true, payment_reminder: true, trip_prep: true, flight_checkin: true, survey: true, thank_you: false,
      review_invite: true, tier_up: true, post_trip: true, trip_anniversary: true, winback: true, lead_nurture: true, birthday: true,
      partner_trip_report: true, partner_quarterly: true, partner_season: true,
    } as Record<JourneyKey, boolean>,
    reminderDays: [10, 3],
    prepDays: 3,
    postTripDays: 45,
    templates: DEFAULT_TEMPLATES,
    approvedRecipients: {} as Record<string, boolean>, // quyền gửi từng email hành trình đã được admin duyệt
    custom: [] as { id: string; name: string; description: string; subject: string; body: string; segments: string[]; triggerType: 'segment'|'before_trip'|'payment_due'|'after_trip'|'birthday'|'lead_followup'; offsetDays: number; cooldownDays: number; ownerRule: 'sale'|'marketing'; enabled: boolean; createdAt: string; updatedAt: string }[],
  },
  // Quy trình chăm sóc v1 (docs/Quy-trinh-cham-soc-khach-hang-v1.md)
  flow: {
    leadSlaMinutes: 15, // QT1 1.2: liên hệ lead mới trong N phút (giờ hành chính)
    leadEscalateHours: 2, // QT1 1.3: quá N giờ chưa liên hệ thì báo sếp
    leadFollowDays: [1, 3, 7], // QT1 1.5–1.7: theo đuổi lead đang xử lý
    leadLookbackDays: 30, // chỉ tạo việc cho lead tạo trong N ngày gần đây
    workStart: '08:00',
    workEnd: '17:30',
    crossSellDays: 3, // QT2 2.3: gợi ý bán kèm cho đơn tạo trong N ngày
    unpaidDays: 3, // QT2 2.5: còn N ngày đến ngày đi mà chưa thanh toán đủ thì báo sale, kế toán
    accountingEmail: '', // nhận danh sách đơn sắp đi còn thiếu tiền
    surveyDays: 2, // QT3 3.2: gửi khảo sát N ngày sau ngày về
    reviewUrl: '',
    referralText: '', // nội dung chương trình giới thiệu bạn bè (sếp quyết định)
    callTiers: ['Kim cương', 'Vàng'], // hạng do sale gọi thay vì chỉ gửi email (QT3 3.6, QT4)
    bossTiers: ['Kim cương'], // hạng sếp gọi chúc mừng sinh nhật
    tierBenefits: { 'Tiêu chuẩn': '', Bạc: '', Vàng: '', 'Kim cương': '' } as Record<string, string>,
    koreaSeasons: [
      { name: 'mùa cao điểm đầu năm', months: [1, 2], daysBefore: 14 },
      { name: 'mùa cao điểm hè', months: [4, 5], daysBefore: 14 },
      { name: 'mùa cao điểm cuối năm', months: [8, 9], daysBefore: 14 },
      { name: 'mùa du lịch mùa đông', months: [10, 11], daysBefore: 14 },
    ],
    twReminderDays: 14, // lời nhắc CRM quá hạn quá N ngày chuyển xuống "khi rảnh"
    digestTime: '08:30', // email việc hôm nay cho từng sale
    weeklyDay: 1, // báo cáo tuần cho sếp: 1 = thứ Hai
    weeklyTime: '09:00',
    leadPollMinutes: 5, // đọc lead mới từ CRM mỗi N phút
    alertDays: 14, // cảnh báo không thấy xử lý trên CRM sau N ngày thì đóng là "hết hạn"
    staffEmails: {} as Record<string, string>,
    // Đối tác (đại lý, doanh nghiệp)
    partnerReportDays: 2, // gửi báo cáo sau chuyến đi N ngày sau ngày về
    commissionText: '', // chính sách hoa hồng, ưu đãi đối tác (sếp quyết định; trống thì không đưa vào email)
    partnerSeasons: [
      { name: 'Mùa cao điểm đầu năm', months: [1, 2], daysBefore: 14 },
      { name: 'Mùa hè', months: [3, 4], daysBefore: 14 },
      { name: 'Mùa cao điểm cuối năm', months: [7], daysBefore: 14 },
      { name: 'Mùa du lịch cuối năm, khen thưởng', months: [8, 9], daysBefore: 14 },
      { name: 'Tết Nguyên đán', months: [10, 11], daysBefore: 14 },
    ], // mã nhân sự CRM -> email nhận báo lead mới, cảnh báo (nhân viên không cần đăng nhập)
  },
  // Dịch vụ đặt ngoài CRM: các URL đối tác được hiển thị dưới dạng nút trong email.
  services: [
    { id: 've-may-bay', name: 'Vé máy bay', desc: 'Dịch vụ vé máy bay mẫu.', price: 0, url: '' },
    { id: 'khach-san', name: 'Đặt phòng khách sạn', desc: 'Dịch vụ khách sạn mẫu.', price: 0, url: '' },
    { id: 'thue-xe', name: 'Thuê xe, đưa đón sân bay', desc: 'Tìm dịch vụ thuê xe và đưa đón sân bay qua đối tác mẫu.', price: 0, url: '' },
    { id: 'am-thuc-nha-hang', name: 'Ẩm thực và nhà hàng', desc: 'Khám phá ẩm thực và đặt trải nghiệm nhà hàng qua đối tác mẫu.', price: 0, url: '' },
    { id: 'sim-wifi', name: 'Sim card và Thuê Wifi', desc: 'Tìm sim du lịch và thiết bị phát Wifi qua đối tác mẫu.', price: 0, url: '' },
  ] as { id: string; name: string; desc: string; price: number; url: string }[],
};
export type Settings = typeof DEFAULTS;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export function mergeSettings(base: any, over: any): any {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if(k==='services'&&Array.isArray(base.services)){
      const saved=Array.isArray(v)?v:[],deprecated=new Set(['visa','bao-hiem']),defaults=new Map(base.services.map((item:any)=>[item.id,item]));
      const stored=new Map(saved.filter((item:any)=>item&&typeof item.id==='string').map((item:any)=>[item.id,item]));
      const canonical=base.services.map((item:any)=>({...item,...(stored.get(item.id)||{}),url:item.url}));
      const custom=saved.filter((item:any)=>item&&typeof item.id==='string'&&!defaults.has(item.id)&&!deprecated.has(item.id));
      out.services=[...canonical,...custom];
      continue;
    }
    out[k] = k in base ? mergeSettings(base[k], v) : v;
  }
  return out;
}

export function defaultSettings(): Settings {
  return clone(DEFAULTS);
}

export function publicView(s: Settings) {
  const { passEnc, ...smtp } = s.smtp;
  const { tokenEnc, ...tourwell } = s.tourwell;
  return { ...s, smtp: { ...smtp, hasPassword: !!passEnc }, tourwell: { ...tourwell, hasToken: !!tokenEnc } };
}
