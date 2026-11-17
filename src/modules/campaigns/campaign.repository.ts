import type { Pool } from 'pg';

type Audience = { segments?: string[]; visited?: string[]; nextDestination?: string[]; propensity?: string[]; services?: string[]; notServices?: string[]; tiers?: string[]; leadSources?: string[]; partners?: boolean; subGroups?: string[]; manualRecipients?: boolean; selectedCustomerIds?: number[] };

export function createCampaignRepository(pool: Pool) {
  const audienceWhere = (audience: Audience, includeNoEmail = false) => {
    const clauses: string[] = [], values: unknown[] = [];
    const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
    if (audience.segments?.length) {
      const mapped = audience.segments.map((segment) => segment === 'new' ? 'new_buyer' : ['hot','warm','cold'].includes(segment) ? `prospect_${segment}` : segment);
      values.push(mapped, audience.segments); clauses.push(`(i.segment_code=ANY($${values.length-1}::text[]) OR cs.segment=ANY($${values.length}::text[]))`);
    }
    if (audience.visited?.length) add(`EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(cs.visited,'[]'::jsonb)) AS visited(destination) WHERE destination=ANY(?::text[]))`, audience.visited);
    if (audience.nextDestination?.length) { values.push(audience.nextDestination); const n=values.length; clauses.push(`(i.suggested_destination=ANY($${n}::text[]) OR cs.next_destination=ANY($${n}::text[]))`); }
    if (audience.propensity?.length) {
      values.push(audience.propensity, audience.propensity); clauses.push(`(i.predicted_purchase=ANY($${values.length-1}::text[]) OR cs.propensity=ANY($${values.length}::text[]))`);
    }
    if (audience.tiers?.length) add(`COALESCE(c.member_tier,c.tier)=ANY(?::text[])`, audience.tiers);
    if (audience.partners) clauses.push(`(c.is_b2b OR c.sub_group ILIKE '%đại lý%' OR c.sub_group ILIKE '%doanh nghiệp%' OR c.sub_group ILIKE '%cơ quan%')`);
    if (audience.subGroups?.length) add(`c.sub_group=ANY(?::text[])`, audience.subGroups);
    if (audience.manualRecipients) {
      const selected=(audience.selectedCustomerIds||[]).map(Number).filter((id)=>Number.isSafeInteger(id)&&id>0);
      if(!selected.length) clauses.push('FALSE');
      else add(`c.customer_id=ANY(?::bigint[])`,selected);
    }
    if (audience.leadSources?.length) add(`EXISTS(SELECT 1 FROM leads l WHERE l.customer_id=c.customer_id AND l.source_name=ANY(?::text[]))`, audience.leadSources);
    if (audience.services?.length) add(`EXISTS(SELECT 1 FROM order_services os JOIN orders o ON o.id=os.order_id WHERE o.customer_id=c.customer_id AND os.service_type=ANY(?::text[]))`, audience.services);
    if (audience.notServices?.length) add(`NOT EXISTS(SELECT 1 FROM order_services os JOIN orders o ON o.id=os.order_id WHERE o.customer_id=c.customer_id AND os.service_type=ANY(?::text[]))`, audience.notServices);
    clauses.push(`c.is_demo=false`);
    if (!includeNoEmail) clauses.push(`c.email_primary IS NOT NULL AND btrim(c.email_primary)<>''`);
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
  };
  const recipients = async (audience: Audience, options: { includeNoEmail?: boolean } = {}) => {
    const filter = audienceWhere(audience, options.includeNoEmail === true);
    const query = await pool.query(`SELECT c.customer_id AS id,c.name,c.email_primary AS email,c.sale_name,
      COALESCE(i.segment_code,cs.segment) AS segment,COALESCE(i.suggested_destination,cs.next_destination) AS next_destination,
      COALESCE(i.predicted_purchase,cs.propensity) AS propensity,COALESCE(i.score_reasons,cs.reasons,'[]'::jsonb) AS reasons,
      EXISTS(SELECT 1 FROM care_opt_outs x WHERE x.customer_id=c.customer_id AND x.channel='email') OR
        EXISTS(SELECT 1 FROM customer_contact_preferences x WHERE x.customer_id=c.customer_id AND x.email_marketing_allowed=false) AS opted_out,
      EXISTS(SELECT 1 FROM messages m WHERE m.customer_id=c.customer_id AND m.marketing AND m.created_at>now()-interval '7 days') AS recent_marketing
      FROM customers c LEFT JOIN customer_insights i ON i.customer_id=c.customer_id AND i.is_demo=c.is_demo
        LEFT JOIN care_scores cs ON cs.customer_id=c.customer_id
      ${filter.where} ORDER BY c.name LIMIT 5000`, filter.values);
    return query.rows;
  };
  const report = async (id: number) => {
    const result = await pool.query(`SELECT count(*) FILTER(WHERE status='sent')::int AS sent,
      count(*) FILTER(WHERE status='queued')::int AS queued,count(*) FILTER(WHERE status='failed')::int AS failed,
      count(*) FILTER(WHERE status='skipped')::int AS skipped,count(*) FILTER(WHERE opened_at IS NOT NULL)::int AS opened,
      count(*) FILTER(WHERE clicked_at IS NOT NULL)::int AS clicked,0::int AS unsubscribed,0::int AS buyers,0::numeric AS revenue
      FROM messages WHERE campaign_id=$1`, [id]);
    return result.rows[0];
  };
  return {
    async list() {
      const result = await pool.query('SELECT id,name,goal,status,created_by,created_at,approved_by,approved_at,sent_at,scheduled_at FROM campaigns WHERE is_demo=false ORDER BY id DESC LIMIT 500');
      return Promise.all(result.rows.map(async (campaign) => ({ ...campaign, report: await report(Number(campaign.id)) })));
    },
    async get(id: number) {
      const result = await pool.query('SELECT * FROM campaigns WHERE id=$1 AND is_demo=false', [id]);
      if (!result.rows[0]) return null;
      const campaign = result.rows[0], audience = await recipients(campaign.audience || {});
      const excluded = audience.filter((row) => row.opted_out || row.recent_marketing).map((row) => ({ name: row.name, reason: row.opted_out ? 'Đã từ chối nhận email' : 'Đã nhận tin quảng cáo trong 7 ngày qua' }));
      return { campaign, audience: { count: audience.length-excluded.length, excluded }, report: await report(id) };
    },
    recipients,
    async save(input: any, actor: string, id?: number) {
      const name = String(input.name || '').trim().slice(0, 150), subject = String(input.subject || '').trim().slice(0, 300), body = String(input.body || '').slice(0, 20000);
      if (!name || !subject || !body) throw new Error('Tên chiến dịch, tiêu đề và nội dung là bắt buộc.');
      const audience = input.audience && typeof input.audience === 'object' ? input.audience : {};
      const validDate = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (validDate && !Number.isFinite(validDate.getTime())) throw new Error('Thời gian hẹn gửi không hợp lệ.');
      if (id) {
        const existing = await pool.query('SELECT status FROM campaigns WHERE id=$1 AND is_demo=false', [id]);
        if (!existing.rows[0]) throw new Error('Không tìm thấy chiến dịch.');
        if (!['draft','approved'].includes(existing.rows[0].status)) throw new Error('Chiến dịch đã bắt đầu hoặc đã dừng, không thể sửa.');
        await pool.query(`UPDATE campaigns SET name=$2,goal=$3,audience=$4::jsonb,subject=$5,body=$6,product_ids=$7::jsonb,service_ids=$8::jsonb,
          recommend=$9,scheduled_at=$10,status='draft',approved_by=NULL,approved_at=NULL WHERE id=$1`,
        [id,name,String(input.goal||'').slice(0,1000),JSON.stringify(audience),subject,body,JSON.stringify(numbers(input.productIds)),JSON.stringify(strings(input.serviceIds)),input.recommend===true,validDate]);
        return id;
      }
      const result = await pool.query(`INSERT INTO campaigns(name,goal,audience,channel,subject,body,product_ids,service_ids,recommend,status,created_by,scheduled_at,is_demo)
        VALUES($1,$2,$3::jsonb,'email',$4,$5,$6::jsonb,$7::jsonb,$8,'draft',$9,$10,false) RETURNING id`,
      [name,String(input.goal||'').slice(0,1000),JSON.stringify(audience),subject,body,JSON.stringify(numbers(input.productIds)),JSON.stringify(strings(input.serviceIds)),input.recommend===true,actor,validDate]);
      return Number(result.rows[0].id);
    },
  };
}
function numbers(value: unknown) { return Array.isArray(value) ? value.map(Number).filter((x) => Number.isSafeInteger(x) && x > 0) : []; }
function strings(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0,100) : []; }
