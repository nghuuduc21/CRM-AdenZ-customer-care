import type { Pool } from 'pg';
import type { Settings } from '../settings/settings.defaults.js';
import { JOURNEYS, type JourneyKey } from '../settings/settings.defaults.js';

type Candidate = {
  journey: string; label: string; key: string; event_key: string; customer_id: number;
  name: string; email: string | null; to?: string | null; subject: string | null; body?:string|null; handler: string | null; order_id: number | null;
  order_code: string | null; trip_name?:string|null; departure?:string|null; return_date?:string|null; total_amount?:string|number|null; paid_amount?:string|number|null; remaining_amount?:string|number|null; due_at: Date | string | null; reason: string;
  blocked?: boolean; approved?: boolean; eligible?: boolean; blockReason?: string | null; marketing?: boolean;
};
type DbCandidate = Omit<Candidate,'journey'|'label'|'key'|'blocked'|'approved'|'eligible'|'blockReason'|'subject'|'body'|'to'>;

const DATE_RULES: Partial<Record<JourneyKey,string>> = {
  order_confirm: 'Đơn được tạo hôm nay; xác nhận dịch vụ và số tiền theo đơn.',
  payment_received: 'Có phiếu thu được duyệt hôm nay; xác nhận khoản thanh toán với khách.',
  payment_reminder: 'Còn khoản phải trả và còn đúng số ngày nhắc trước khởi hành đã cấu hình.',
  trip_prep: 'Đơn sắp khởi hành đúng mốc chuẩn bị; gửi thông tin hành trình.',
  flight_checkin: 'Đơn có dịch vụ vé máy bay và khởi hành ngày mai; nhắc check-in.',
  survey: 'Đã đến mốc gửi khảo sát sau ngày về theo cấu hình.',
  review_invite: 'Khách chấm khảo sát từ 9/10 hôm nay; mời đánh giá công khai.',
  partner_trip_report: 'Đối tác vừa kết thúc chuyến đi; gửi báo cáo và xin góp ý.',
  post_trip: 'Đã đến mốc gợi ý chuyến tiếp theo sau ngày về.',
  trip_anniversary: 'Hôm nay là ngày kỷ niệm chuyến đi; gửi lời nhắc theo lịch sử đơn.',
  winback: 'Nhóm RFM Cần giữ chân/Ngủ đông đến kỳ chăm sóc theo quý.',
  lead_nurture: 'Lead đang xử lý, thuộc nhóm Tiềm năng ấm và chưa được nhắc trong 30 ngày.',
  birthday: 'Ngày/tháng sinh trong CRM trùng hôm nay; năm sinh demo được ẩn.',
  tier_up: 'Hạng thành viên được ghi nhận tăng hôm nay.',
  partner_quarterly: 'Đầu quý mới; đối tác có đơn trong quý trước.',
  partner_season: 'Gửi trước mùa vụ 7, 14 hoặc 30 ngày đã chọn; đối tác có đơn trong 12 tháng.',
};

export function createJourneyPreviewService(pool: Pool) {
  return {
    async preview(settings: Settings, now = new Date(), simulatedDate?: string) {
      const demo = settings.tourwell.useSample;
      const vnNow = new Date(now.getTime() + 7 * 60 * 60_000);
      const today = simulatedDate || vnNow.toISOString().slice(0,10);
      const runTime=settings.schedule.journeyTime||'09:00';
      const scheduledAt=new Date(`${today}T${runTime}:00+07:00`).toISOString();
      const cycleQuarter = `${today.slice(0,4)}-Q${Math.floor((Number(today.slice(5,7))-1)/3)+1}`;
      const candidates: Candidate[] = [];
      const unready: Record<string,string> = {};
      const add = async (key: JourneyKey, sql: string, values: unknown[] = []) => {
        const result = await pool.query<DbCandidate>(sql, [demo, today, ...values]);
        for (const row of result.rows) {
          const eventKey = String(row.event_key);
          const candidateKey = `auto:${key}:${eventKey}`;
          candidates.push({ ...row, journey:key, label:JOURNEYS[key].label, event_key:eventKey,
            key:candidateKey, to:row.email, subject:renderSubject(settings.journeys.templates[key]?.subject||JOURNEYS[key].label,row), body:renderSubject(settings.journeys.templates[key]?.body||JOURNEYS[key].desc,row), due_at:scheduledAt, marketing:JOURNEYS[key].marketing, approved:settings.journeys.approvedRecipients[candidateKey] === true });
        }
      };
      const orderBase = `SELECT 'order:'||o.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          COALESCE(o.sale_name,c.sale_name) AS handler,o.id AS order_id,o.code AS order_code,o.trip_name,o.departure::text AS departure,o.return_date::text AS return_date,
          o.total_amount::text AS total_amount,o.paid_amount::text AS paid_amount,o.remaining_amount::text AS remaining_amount,now() AS due_at,`;
      const customerPartition = `c.is_demo=$1 AND o.is_demo=$1`;
      const activeOrder = `o.status_title IN ('Thành công','Hoàn tất','Đang xử lý')`;
      const todayExpr = `$2::date`;

      if(settings.journeys.enabled.order_confirm) await add('order_confirm', `${orderBase} 'Đơn '||o.code||' vừa được tạo; xác nhận tour, tổng tiền và khoản còn lại.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND ${activeOrder} AND o.order_at IS NOT NULL
          AND (o.order_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=${todayExpr}`);

      if(settings.journeys.enabled.payment_received) await add('payment_received', `SELECT 'receipt:'||r.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          COALESCE(o.sale_name,c.sale_name) AS handler,o.id AS order_id,o.code AS order_code,o.trip_name,o.departure::text AS departure,o.return_date::text AS return_date,
          o.total_amount::text AS total_amount,o.paid_amount::text AS paid_amount,o.remaining_amount::text AS remaining_amount,now() AS due_at,
          'Phiếu thu '||r.code||' đã được duyệt hôm nay ('||COALESCE(r.payment_method,'chưa rõ phương thức')||').' AS reason
        FROM receipts r JOIN customers c ON c.customer_id=r.customer_id LEFT JOIN orders o ON o.id=r.order_id
        WHERE r.is_demo=$1 AND c.is_demo=$1 AND COALESCE(r.approve_status,'')='Đã duyệt' AND r.payment_date IS NOT NULL
          AND (r.payment_date AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=${todayExpr} AND r.transaction_type='Khách thanh toán'`);

      const reminderBase=orderBase.replace("'order:'||o.id::text AS event_key","'order:'||o.id::text||':reminder:'||(o.departure-$2::date)::text AS event_key");
      if(settings.journeys.enabled.payment_reminder) await add('payment_reminder', `${reminderBase} 'Đơn '||o.code||' còn nợ '||to_char(o.remaining_amount,'FM999,999,999,990')||' VND; còn '||(o.departure-${todayExpr})||' ngày đến khởi hành.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND ${activeOrder}
          AND o.remaining_amount>0 AND o.departure-${todayExpr}=ANY($3::int[])`, [settings.journeys.reminderDays]);

      if(settings.journeys.enabled.trip_prep) await add('trip_prep', `${orderBase} 'Đơn '||o.code||' khởi hành sau '||(o.departure-${todayExpr})||' ngày; rà soát thông tin chuyến đi.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND ${activeOrder}
          AND o.departure-${todayExpr}=$3::int`, [settings.journeys.prepDays]);

      if(settings.journeys.enabled.flight_checkin) await add('flight_checkin', `${orderBase} 'Đơn '||o.code||' có dịch vụ vé máy bay và khởi hành ngày mai; nhắc khách kiểm tra thông tin check-in.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND ${activeOrder} AND o.departure-${todayExpr}=1
          AND EXISTS(SELECT 1 FROM order_services os WHERE os.order_id=o.id AND os.is_demo=$1 AND os.service_type ILIKE ANY(ARRAY['%vé máy bay%','%vé bay%','%flight%']))`);

      if(settings.journeys.enabled.survey) await add('survey', `${orderBase} 'Đơn '||o.code||' kết thúc chuyến đi cách đây '||$3::int||' ngày; gửi khảo sát sau chuyến đi.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND o.status_title IN ('Thành công','Hoàn tất')
          AND o.return_date+($3::int)=${todayExpr}`, [settings.flow.surveyDays]);

      if(settings.journeys.enabled.review_invite) await add('review_invite', `SELECT 'survey:'||s.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          c.sale_name AS handler,s.order_id,o.code AS order_code,o.trip_name,o.departure::text AS departure,o.return_date::text AS return_date,o.total_amount::text AS total_amount,o.paid_amount::text AS paid_amount,o.remaining_amount::text AS remaining_amount,now() AS due_at,
          'Khách chấm '||s.score||'/10 hôm nay; đủ điều kiện mời đánh giá Google Maps.' AS reason
        FROM surveys s JOIN customers c ON c.customer_id=s.customer_id LEFT JOIN orders o ON o.id=s.order_id
        WHERE s.is_demo=$1 AND c.is_demo=$1 AND s.score>=9 AND s.answered_at IS NOT NULL
          AND (s.answered_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=${todayExpr}`);

      if(settings.journeys.enabled.post_trip) await add('post_trip', `${orderBase} 'Đã đến mốc '||$3::int||' ngày sau khi đơn '||o.code||' kết thúc; gợi ý hành trình tiếp theo.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND o.status_title IN ('Thành công','Hoàn tất')
          AND o.return_date+$3::int=${todayExpr}`, [settings.journeys.postTripDays]);

      if(settings.journeys.enabled.trip_anniversary) await add('trip_anniversary', `SELECT 'anniversary:'||o.id::text||':'||extract(year from $2::date)::int::text AS event_key,c.customer_id,c.name,c.email_primary AS email,COALESCE(o.sale_name,c.sale_name) AS handler,o.id AS order_id,o.code AS order_code,o.trip_name,o.departure::text AS departure,o.return_date::text AS return_date,o.total_amount::text AS total_amount,o.paid_amount::text AS paid_amount,o.remaining_amount::text AS remaining_amount,now() AS due_at,'Hôm nay tròn ngày kỷ niệm chuyến đi của đơn '||o.code||'.' AS reason FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND o.status_title IN ('Thành công','Hoàn tất') AND o.departure IS NOT NULL AND o.departure<${todayExpr} AND to_char(o.departure,'MM-DD')=to_char(${todayExpr},'MM-DD')`);

      if(settings.journeys.enabled.winback && today === `${today.slice(0,4)}-${String(Math.floor((Number(today.slice(5,7))-1)/3)*3+1).padStart(2,'0')}-01`)
        await add('winback', `SELECT 'customer:'||c.customer_id::text||':'||$3::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          c.sale_name AS handler,NULL::bigint AS order_id,NULL::text AS order_code,now() AS due_at,
          'RFM xếp khách vào nhóm '||cs.segment||'; đến kỳ chăm sóc tối đa một lần/quý.' AS reason
        FROM customers c JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE c.is_demo=$1 AND cs.kind='buyer'
          AND cs.segment IN ('at_risk','dormant') AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.customer_id=c.customer_id
            AND m.is_demo=$1 AND m.journey='winback' AND m.status IN ('sent','queued') AND m.created_at>=${todayExpr}::timestamptz-interval '90 days')`, [cycleQuarter]);

      if(settings.journeys.enabled.lead_nurture) await add('lead_nurture', `SELECT 'lead:'||l.id::text||':'||to_char($2::date,'YYYY-MM') AS event_key,c.customer_id,c.name,c.email_primary AS email,
          COALESCE(l.sale_name,c.sale_name) AS handler,NULL::bigint AS order_id,l.code AS order_code,now() AS due_at,
          'Lead '||l.code||' đang ở trạng thái CRM “'||l.status_title||'”, thuộc nhóm ưu tiên '||cs.segment||'; chưa có email nuôi dưỡng trong 30 ngày.' AS reason
        FROM leads l JOIN customers c ON c.customer_id=l.customer_id JOIN care_scores cs ON cs.customer_id=c.customer_id AND cs.kind='lead'
        WHERE l.is_demo=$1 AND c.is_demo=$1 AND l.status_title IN ('Chưa tiếp nhận','Đang xử lý') AND cs.segment IN ('hot','warm')
          AND l.id=(SELECT l2.id FROM leads l2 WHERE l2.customer_id=c.customer_id AND l2.is_demo=$1 ORDER BY COALESCE(l2.updated_at,l2.created_at) DESC,l2.id DESC LIMIT 1)
          AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.customer_id=c.customer_id AND m.is_demo=$1 AND m.journey='lead_nurture'
            AND m.status IN ('sent','queued') AND m.created_at>=${todayExpr}::timestamptz-interval '30 days')`);

      if(settings.journeys.enabled.birthday) await add('birthday', `SELECT 'birthday:'||c.customer_id::text||':'||$2::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          c.sale_name AS handler,NULL::bigint AS order_id,NULL::text AS order_code,now() AS due_at,
          'Ngày sinh trong hồ sơ trùng hôm nay; năm sinh không hiển thị trong email demo.' AS reason FROM customers c
        WHERE c.is_demo=$1 AND c.birthday IS NOT NULL AND to_char(c.birthday,'MM-DD')=to_char($2::date,'MM-DD')`);

      unready.tier_up='Raw snapshot chỉ có hạng hiện tại, không có lịch sử tăng hạng để xác định ngày gửi.';



      if(settings.journeys.enabled.partner_trip_report) await add('partner_trip_report', `${orderBase} 'Đối tác vừa kết thúc đơn '||o.code||'; gửi báo cáo chuyến đi và xin góp ý.' AS reason
        FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE ${customerPartition} AND o.status_title IN ('Thành công','Hoàn tất')
          AND (c.is_b2b OR c.sub_group ILIKE '%đại lý%' OR c.sub_group ILIKE '%doanh nghiệp%')
          AND o.return_date+$3::int=${todayExpr}`, [settings.flow.partnerReportDays]);

      if(settings.journeys.enabled.partner_quarterly && today.endsWith('-01') && ['01-01','04-01','07-01','10-01'].includes(today.slice(4)))
        await add('partner_quarterly', `SELECT 'partner-quarter:'||c.customer_id::text||':'||$3::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          c.sale_name AS handler,NULL::bigint AS order_id,NULL::text AS order_code,now() AS due_at,
          'Đối tác có đơn trong quý trước; đến kỳ tổng kết hợp tác.' AS reason FROM customers c WHERE c.is_demo=$1
          AND (c.is_b2b OR c.sub_group ILIKE '%đại lý%' OR c.sub_group ILIKE '%doanh nghiệp%') AND EXISTS(SELECT 1 FROM orders o
            WHERE o.customer_id=c.customer_id AND o.is_demo=$1 AND o.order_at>=date_trunc('quarter',$2::date)-interval '3 months'
              AND o.order_at<date_trunc('quarter',$2::date))`, [cycleQuarter]);

      const seasonDue=settings.flow.partnerSeasons.map(season=>{const days=[7,14,30].includes(Number(season.daysBefore))?Number(season.daysBefore):14;const future=new Date(Date.parse(`${today}T00:00:00+07:00`)+days*86_400_000+7*60*60_000).toISOString().slice(0,10);const firstMonth=Math.min(...season.months);return future.endsWith('-01')&&Number(future.slice(5,7))===firstMonth?{season,future,days}:null;}).find(Boolean);
      if(settings.journeys.enabled.partner_season&&seasonDue) await add('partner_season', `SELECT 'partner-season:'||c.customer_id::text||':'||$3::text||':'||$4::text AS event_key,c.customer_id,c.name,c.email_primary AS email,
          c.sale_name AS handler,NULL::bigint AS order_id,NULL::text AS order_code,now() AS due_at,
          'Đối tác nhận trước mùa '||$3::text||' bắt đầu ngày '||$4::date::text||' '||$5::int||' ngày; có đơn trong 12 tháng gần đây.' AS reason
        FROM customers c WHERE c.is_demo=$1 AND (c.is_b2b OR c.sub_group ILIKE '%đại lý%' OR c.sub_group ILIKE '%doanh nghiệp%')
          AND EXISTS(SELECT 1 FROM orders o WHERE o.customer_id=c.customer_id AND o.is_demo=$1 AND o.order_at>=($2::date-interval '12 months'))`, [seasonDue.season.name,seasonDue.future,seasonDue.days]);

      // The legacy thank-you email is intentionally not scheduled; the survey journey replaces it.

      if(settings.journeys.enabled.thank_you) unready.thank_you = 'Không dùng: hành trình cũ đã được thay bằng Cảm ơn + khảo sát sau chuyến đi.';
      await this.addCustom(settings, demo, today, candidates);
      const customerIds=[...new Set(candidates.map(x=>x.customer_id))];
      const optOuts=customerIds.length?await pool.query<{customer_id:number;blocked:boolean}>(`SELECT c.customer_id,EXISTS(SELECT 1 FROM care_opt_outs o WHERE o.customer_id=c.customer_id AND o.channel='email') OR EXISTS(SELECT 1 FROM customer_contact_preferences p WHERE p.customer_id=c.customer_id AND p.email_marketing_allowed=false) AS blocked FROM customers c WHERE c.customer_id=ANY($1::bigint[])`,[customerIds]):{rows:[]};
      const blockedIds=new Set(optOuts.rows.filter(x=>x.blocked).map(x=>Number(x.customer_id)));
      const marketingIds=[...new Set(candidates.filter(x=>x.marketing).map(x=>x.customer_id))];
      const marketingHistory=marketingIds.length?await pool.query<{customer_id:number;sent:number}>(`SELECT customer_id,count(*)::int AS sent FROM messages WHERE is_demo=$1 AND marketing=true AND status IN ('sent','queued') AND created_at>=$2::date::timestamptz-interval '7 days' AND customer_id=ANY($3::bigint[]) GROUP BY customer_id`,[demo,today,marketingIds]):{rows:[]};
      const weeklyLimitIds=new Set(marketingHistory.rows.filter(x=>x.sent>=settings.sending.marketingPerWeek).map(x=>Number(x.customer_id)));
      const dedupeKeys = candidates.map(x=>x.key);
      const sent = dedupeKeys.length ? await pool.query<{dedupe_key:string}>(`SELECT dedupe_key FROM messages WHERE is_demo=$1 AND dedupe_key=ANY($2::text[]) AND status IN ('sent','queued')`,[demo,dedupeKeys]) : {rows:[]};
      const already = new Set(sent.rows.map(x=>x.dedupe_key));
      const filtered = candidates.filter(x=>!already.has(x.key));
      const blocked = filtered.map(row=>({ ...row,
        blocked: !row.email || (row.marketing===true && (blockedIds.has(Number(row.customer_id)) || weeklyLimitIds.has(Number(row.customer_id)))),
        blockReason: !row.email ? 'Không có email trong dữ liệu.' : row.marketing && blockedIds.has(Number(row.customer_id)) ? 'Khách đang chặn nhận tin chăm sóc trong Care.' : row.marketing && weeklyLimitIds.has(Number(row.customer_id)) ? `Đã đạt giới hạn ${settings.sending.marketingPerWeek} email chăm sóc trong 7 ngày.` : null,
        eligible: Boolean(row.email) && !(row.marketing===true && (blockedIds.has(Number(row.customer_id)) || weeklyLimitIds.has(Number(row.customer_id)))),
        approved: row.approved===true,
        due: true,
      }));
      const byJourney = Object.keys(JOURNEYS).map(key=>({key,label:JOURNEYS[key as JourneyKey].label,
        rule:unready[key] || DATE_RULES[key as JourneyKey] || '', count:blocked.filter(x=>x.journey===key).length,
        eligible:blocked.filter(x=>x.journey===key&&x.eligible).length, blocked:blocked.filter(x=>x.journey===key&&x.blocked).length,
        ready:!unready[key], enabled:settings.journeys.enabled[key as JourneyKey]}));
      for(const item of (settings.journeys.custom||[]).filter(x=>x.enabled)) byJourney.push({
        key:`custom:${item.id}`,label:item.name,rule:ruleText(item.triggerType,item.offsetDays,item.cooldownDays),
        count:blocked.filter(x=>x.journey===`custom:${item.id}`).length,
        eligible:blocked.filter(x=>x.journey===`custom:${item.id}`&&x.eligible).length,
        blocked:blocked.filter(x=>x.journey===`custom:${item.id}`&&x.blocked).length,ready:true,enabled:true,
      });
      const items = blocked.filter(x=>x.eligible);
      return { items, recipients:blocked, skipped:blocked.filter(x=>x.blocked).map(x=>({label:x.label,name:x.name,reason:x.blockReason})),
        total:blocked.length, schedulerReady:true, demo, today, byJourney,
        reason: demo ? 'Đang tính trên partition raw demo; không gửi email trong bước xem trước.' : 'Đang tính trên dữ liệu Care hiện hành; không gửi email trong bước xem trước.' };
    },

    async addCustom(settings: Settings, demo: boolean, today: string, out: Candidate[]) {
      for(const item of (settings.journeys.custom||[]).filter(x=>x.enabled)) {
        const days=Math.max(0,Number(item.offsetDays)||0), cooldown=Math.max(1,Number(item.cooldownDays)||30), triggerType=item.triggerType||'segment';
        const common=`SELECT c.customer_id,c.name,c.email_primary AS email,c.sale_name AS handler,
          NULL::bigint AS order_id,NULL::text AS order_code,now() AS due_at`;
        const segmentClause=`c.is_demo=$1 AND cs.customer_id=c.customer_id AND cs.segment=ANY($4::text[])`;
        let sql='';
        switch(triggerType){
          case 'before_trip': sql=`SELECT 'custom-before:'||o.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,COALESCE(o.sale_name,c.sale_name) handler,o.id order_id,o.code order_code,now() due_at,'Đơn '||o.code||' còn đúng '||$3::int||' ngày đến khởi hành; nội dung do quản trị viên cấu hình.' reason FROM orders o JOIN customers c ON c.customer_id=o.customer_id JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE c.is_demo=$1 AND o.is_demo=$1 AND cs.segment=ANY($4::text[]) AND o.status_title IN ('Thành công','Hoàn tất','Đang xử lý') AND o.departure-$2::date=$3::int`; break;
          case 'payment_due': sql=`SELECT 'custom-payment:'||o.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,COALESCE(o.sale_name,c.sale_name) handler,o.id order_id,o.code order_code,now() due_at,'Đơn '||o.code||' còn nợ '||to_char(o.remaining_amount,'FM999,999,999,990')||' VND; quy tắc do quản trị viên cấu hình.' reason FROM orders o JOIN customers c ON c.customer_id=o.customer_id JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE c.is_demo=$1 AND o.is_demo=$1 AND cs.segment=ANY($4::text[]) AND o.remaining_amount>0 AND o.departure-$2::date=$3::int`; break;
          case 'after_trip': sql=`SELECT 'custom-after:'||o.id::text AS event_key,c.customer_id,c.name,c.email_primary AS email,COALESCE(o.sale_name,c.sale_name) handler,o.id order_id,o.code order_code,now() due_at,'Đơn '||o.code||' đã về đúng '||$3::int||' ngày; nội dung do quản trị viên cấu hình.' reason FROM orders o JOIN customers c ON c.customer_id=o.customer_id JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE c.is_demo=$1 AND o.is_demo=$1 AND cs.segment=ANY($4::text[]) AND o.status_title IN ('Thành công','Hoàn tất') AND o.return_date+$3::int=$2::date`; break;
          case 'birthday': sql=`${common},'birthday:'||c.customer_id::text||':'||$2::text event_key,'Ngày sinh trong hồ sơ trùng hôm nay; nội dung do quản trị viên cấu hình.' reason FROM customers c JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE ${segmentClause} AND c.birthday IS NOT NULL AND to_char(c.birthday,'MM-DD')=to_char($2::date,'MM-DD')`; break;
          case 'segment': sql=`${common},'segment:'||c.customer_id::text||':'||to_char($2::date,'YYYY-MM') event_key,'Khách thuộc nhóm đã chọn; chưa có sự kiện đơn hàng riêng.' reason FROM customers c JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE ${segmentClause}`; break;
          case 'lead_followup': sql=`SELECT 'custom-lead:'||l.id::text||':'||to_char($2::date,'YYYY-MM') event_key,c.customer_id,c.name,c.email_primary AS email,COALESCE(l.sale_name,c.sale_name) handler,NULL::bigint order_id,l.code order_code,now() due_at,'Lead '||l.code||' đang ở trạng thái '||l.status_title||'; nhắc theo quy tắc đã cấu hình.' reason FROM leads l JOIN customers c ON c.customer_id=l.customer_id JOIN care_scores cs ON cs.customer_id=c.customer_id WHERE l.is_demo=$1 AND c.is_demo=$1 AND cs.segment=ANY($4::text[]) AND l.status_title IN ('Chưa tiếp nhận','Đang xử lý') AND COALESCE(l.updated_at,l.created_at)::date<=$2::date-$3::int AND l.id=(SELECT ll.id FROM leads ll WHERE ll.customer_id=c.customer_id AND ll.is_demo=$1 ORDER BY COALESCE(ll.updated_at,ll.created_at) DESC,ll.id DESC LIMIT 1)`; break;
        }
        if(!sql) continue;
        const journey=`custom:${item.id}`;
        // Keep $3 typed for triggers such as `segment` and `birthday` that do not
        // otherwise use offsetDays. PostgreSQL rejects an untyped parameter gap.
        const guardedSql=`${sql} AND $3::int IS NOT NULL AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.is_demo=$1 AND m.customer_id=c.customer_id AND m.journey=$5::text AND m.status IN ('sent','queued') AND m.created_at>=$2::date::timestamptz-make_interval(days=>$6::int))`;
        const result=await pool.query<DbCandidate>(guardedSql,[demo,today,days,item.segments||[],journey,cooldown]);
        for(const row of result.rows) {
          const eventKey=String(row.event_key),key=`auto:${journey}:${eventKey}`;
          out.push({...row,journey,label:item.name,event_key:eventKey,key,approved:settings.journeys.approvedRecipients[key]===true,blocked:false,marketing:true,subject:renderSubject(item.subject,row),body:renderSubject(item.body,row),reason:item.description?`${row.reason} ${item.description}`:row.reason,handler:item.ownerRule==='marketing'?'Marketing / Chăm sóc':row.handler});
        }
      }
    },
  };
}

function ruleText(trigger: string, offset: number, cooldown: number) {
  const names:Record<string,string>={segment:'Khi thuộc nhóm khách đã chọn',before_trip:`${offset} ngày trước khởi hành`,payment_due:`${offset} ngày trước khởi hành khi còn nợ`,after_trip:`${offset} ngày sau ngày về`,birthday:'Đúng ngày sinh',lead_followup:`Lead chưa tiếp nhận/đang xử lý quá ${offset} ngày`};
  return `${names[trigger]||'Chưa chọn điều kiện'}; lặp lại tối đa ${cooldown} ngày/lần.`;
}

function renderSubject(template:string,row:DbCandidate){
  const date=(value:string|null|undefined)=>value?new Date(`${value.slice(0,10)}T00:00:00+07:00`).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'';
  const money=(value:string|number|null|undefined)=>value==null?'':`${Math.round(Number(value)||0).toLocaleString('vi-VN')} đ`;
  const vars:Record<string,string>={ten:row.name||'',sale:row.handler||'Customer Care Demo',ma_don:row.order_code||'',ten_chuyen:row.trip_name||'',ngay_di:date(row.departure),ngay_ve:date(row.return_date),tong_tien:money(row.total_amount),da_tra:money(row.paid_amount),con_lai:money(row.remaining_amount)};
  return template.replace(/\{\{([a-z_]+)\}\}/g,(match,key:string)=>key in vars?vars[key]:match);
}
