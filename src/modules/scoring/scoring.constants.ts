export const DEFAULT_WEIGHTS = {
  status_processing: 20,
  status_new: 10,
  status_cancelled: -30,
  has_quote: 15,
  quote_done: 10,
  touch_14d: 20,
  touch_30d: 10,
  source_referral: 15,
  source_ads: 5,
  has_phone_email: 10,
  opened_30d: 5,
  clicked_30d: 15,
  idle_90d: -20,
};

export type Weights = typeof DEFAULT_WEIGHTS;

export const CARE_SEGMENTS = {
  vip:{label:'VIP',kind:'buyer',desc:'Chi nhiều nhất, mua nhiều lần hoặc gần đây'},
  loyal:{label:'Trung thành',kind:'buyer',desc:'Mua từ 2 lần, vẫn còn gắn bó'},
  new:{label:'Khách mới',kind:'buyer',desc:'Mua lần đầu, gần đây'},
  at_risk:{label:'Cần giữ chân',kind:'buyer',desc:'Từng mua nhiều lần nhưng lâu chưa quay lại'},
  one_time:{label:'Mua một lần',kind:'buyer',desc:'Mới mua một lần, đã lâu'},
  dormant:{label:'Ngủ đông',kind:'buyer',desc:'Hơn 2 năm chưa mua'},
  hot:{label:'Tiềm năng nóng',kind:'lead',desc:'Chưa mua, điểm ≥ 70: sắp chốt'},
  warm:{label:'Tiềm năng ấm',kind:'lead',desc:'Chưa mua, điểm 40–69: cần nuôi dưỡng'},
  cold:{label:'Tiềm năng nguội',kind:'lead',desc:'Chưa mua, điểm < 40'},
} as const;
