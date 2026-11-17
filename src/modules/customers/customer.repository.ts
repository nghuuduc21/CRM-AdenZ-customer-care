import type { Pool } from 'pg';

export interface CustomerFilters {
  query?: string;
  segment?: string;
  propensity?: string;
  destination?: string;
  service?: string;
  tier?: string;
  partner?: boolean;
}

const customerListSql = `
  SELECT c.customer_id AS id,c.tourwell_id,c.code,c.name,c.email_primary AS email,
    c.phone_primary AS phone,c.sale_id,c.sale_name,COALESCE(c.member_tier,c.tier) AS tier,
    c.sub_group,c.customer_type,(c.is_b2b OR c.sub_group ILIKE '%đại lý%' OR c.sub_group ILIKE '%doanh nghiệp%') AS is_b2b,
    COALESCE(c.services,'[]'::jsonb) AS services,
    CASE i.customer_kind WHEN 'prospect' THEN 'lead' WHEN 'buyer' THEN 'buyer' ELSE 'none' END AS kind,
    CASE COALESCE(i.segment_code,cs.segment)
      WHEN 'new_buyer' THEN 'new' WHEN 'prospect_hot' THEN 'hot'
      WHEN 'prospect_warm' THEN 'warm' WHEN 'prospect_cold' THEN 'cold'
      ELSE COALESCE(i.segment_code,cs.segment) END AS segment,
    COALESCE(i.r_score,cs.r) AS r,COALESCE(i.f_score,cs.f) AS f,COALESCE(i.m_score,cs.m) AS m,
    COALESCE(i.potential_score,cs.lead_score) AS lead_score,
    COALESCE(i.predicted_purchase,cs.propensity) AS propensity,
    COALESCE(i.suggested_destination,cs.next_destination) AS next_destination,
    COALESCE(i.preferred_travel_month,cs.best_month) AS best_month,
    COALESCE(i.churn_risk,cs.churn_risk) AS churn_risk,
    COALESCE(i.score_reasons,cs.reasons,'[]'::jsonb) AS reasons,
    COALESCE(cs.visited,'[]'::jsonb) AS visited,
    COALESCE(i.predicted_purchase_score,0) AS purchase_score,
    COALESCE((SELECT sum(o.total_amount) FROM orders o WHERE o.customer_id=c.customer_id AND o.is_demo=false AND o.status_title IN ('Thành công','Hoàn tất')),cs.total_spend,0) AS total_spend,
    EXISTS(SELECT 1 FROM care_opt_outs oo WHERE oo.customer_id=c.customer_id AND oo.channel='email')
      OR EXISTS(SELECT 1 FROM customer_contact_preferences cp WHERE cp.customer_id=c.customer_id AND cp.email_marketing_allowed=false) AS opted_out
  FROM customers c
  LEFT JOIN customer_insights i ON i.customer_id=c.customer_id AND i.is_demo=c.is_demo
  LEFT JOIN care_scores cs ON cs.customer_id=c.customer_id`;

export function createCustomerRepository(pool: Pool) {
  return {
    async list(filters: CustomerFilters = {}, limit = 500) {
      const where: string[] = [];
      const values: unknown[] = [];
      const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
      if (filters.segment) {
        const mapped = filters.segment === 'hot' || filters.segment === 'warm' || filters.segment === 'cold'
          ? `prospect_${filters.segment}` : filters.segment === 'new' ? 'new_buyer' : filters.segment;
        values.push(mapped, filters.segment);
        where.push(`(i.segment_code=$${values.length - 1} OR cs.segment=$${values.length})`);
      }
      if (filters.propensity) {
        values.push(filters.propensity, filters.propensity);
        where.push(`(i.predicted_purchase=$${values.length - 1} OR cs.propensity=$${values.length})`);
      }
      if (filters.destination) {
        values.push(filters.destination, `"${filters.destination}"`);
        where.push(`(i.suggested_destination=$${values.length - 1} OR cs.next_destination=$${values.length - 1} OR cs.visited::text LIKE '%' || $${values.length} || '%')`);
      }
      if (filters.query) {
        const term = `%${filters.query}%`;
        values.push(term, term, term, term);
        const n = values.length;
        where.push(`(c.name ILIKE $${n - 3} OR c.code ILIKE $${n - 2} OR c.email_primary ILIKE $${n - 1} OR c.phone_primary ILIKE $${n})`);
      }
      if (filters.service) {
        values.push(`%${filters.service}%`);
        where.push(`(c.services::text ILIKE $${values.length} OR EXISTS(SELECT 1 FROM order_services os JOIN orders o ON o.id=os.order_id WHERE o.customer_id=c.customer_id AND os.service_type ILIKE $${values.length}))`);
      }
      if (filters.tier) { values.push(filters.tier); where.push(`COALESCE(c.member_tier,c.tier)=$${values.length}`); }
      if (filters.partner) where.push('(c.is_b2b OR c.sub_group ILIKE \'%đại lý%\' OR c.sub_group ILIKE \'%doanh nghiệp%\')');
      where.unshift('c.is_demo=false');
      values.push(limit);
      const sql = `${customerListSql}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
        ORDER BY CASE i.customer_kind WHEN 'buyer' THEN 0 WHEN 'prospect' THEN 1 ELSE 2 END,
          COALESCE(i.potential_score,cs.lead_score,0) DESC,COALESCE(i.predicted_purchase_score,0) DESC LIMIT $${values.length}`;
      const result = await pool.query(sql, values);
      return result.rows;
    },

    async getById(id: number) {
      const result = await pool.query(`${customerListSql} WHERE c.is_demo=false AND c.customer_id=$1 LIMIT 1`, [id]);
      return result.rows[0] ?? null;
    },

    async profile(id: number) {
      const customer = await pool.query('SELECT * FROM customers WHERE is_demo=false AND customer_id=$1 LIMIT 1', [id]);
      if (!customer.rows[0]) return null;
      const [score, orders, leads, messages, history, optOut, surveys, tasks, leadOutcomes, receipts] = await Promise.all([
        pool.query('SELECT * FROM care_scores WHERE customer_id=$1', [id]),
        pool.query(`SELECT o.*,o.total_amount AS total,o.paid_amount AS paid,o.remaining_amount AS remaining
          FROM orders o WHERE o.customer_id=$1 AND o.is_demo=false ORDER BY o.departure DESC NULLS LAST,o.order_at DESC`, [id]),
        pool.query('SELECT *,customer_source->>\'code\' AS source_customer_code,state_title AS source_state_title,quotes_source AS source_quotes,sales_person_source AS source_sales_person FROM leads WHERE customer_id=$1 AND is_demo=false ORDER BY created_at DESC', [id]),
        pool.query(`SELECT id,campaign_id,journey,subject,status,reason,created_at,sent_at,opened_at,clicked_at
          FROM messages WHERE customer_id=$1 AND is_demo=false ORDER BY id DESC LIMIT 50`, [id]),
        pool.query(`SELECT changed_at AS at,from_segment,to_segment FROM care_segment_history WHERE customer_id=$1 ORDER BY changed_at DESC`, [id]),
        pool.query(`SELECT channel,opted_out_at AS at,source FROM care_opt_outs WHERE customer_id=$1
          UNION ALL SELECT 'email' AS channel,unsubscribed_at AS at,'consent preference' AS source
          FROM customer_contact_preferences WHERE customer_id=$1 AND email_marketing_allowed=false`, [id]),
        pool.query(`SELECT s.score,s.comment,s.sent_at,s.answered_at,o.code,o.trip_name FROM surveys s
          LEFT JOIN orders o ON o.id=s.order_id WHERE s.customer_id=$1 ORDER BY s.sent_at DESC`, [id]),
        pool.query(`SELECT id,kind,task_kind,title,status,outcome,done_by,done_at,created_at,step
          FROM care_tasks WHERE customer_id=$1 AND is_demo=false ORDER BY id DESC LIMIT 30`, [id]),
        pool.query('SELECT * FROM care_lead_outcomes WHERE customer_id=$1 ORDER BY recorded_at DESC', [id]),
        pool.query('SELECT r.id,r.code,r.transaction_type,r.total_amount_source,r.payment_date,r.approve_status,r.payment_method,r.order_id FROM receipts r WHERE r.customer_id=$1 AND r.is_demo=false ORDER BY r.payment_date DESC NULLS LAST', [id]),
      ]);
      const scoreRow = score.rows[0] ?? null;
        const insights = await pool.query('SELECT * FROM customer_insights WHERE customer_id=$1 AND is_demo=false', [id]);
      const insight = insights.rows[0] ?? null;
      return {
        customer: {
          ...customer.rows[0], id: customer.rows[0].customer_id,
          email: customer.rows[0].email_primary, phone: customer.rows[0].phone_primary,
          source: customer.rows[0].source_name, tier: customer.rows[0].member_tier || customer.rows[0].tier,
          link: customer.rows[0].link_erp || customer.rows[0].link,
        },
        score: scoreRow ? {
          ...scoreRow,
          segment: insight?.segment_code ?? scoreRow.segment,
          r: insight?.r_score ?? scoreRow.r, f: insight?.f_score ?? scoreRow.f, m: insight?.m_score ?? scoreRow.m,
          lead_score: insight?.potential_score ?? scoreRow.lead_score,
          propensity: insight?.predicted_purchase ?? scoreRow.propensity,
          next_destination: insight?.suggested_destination ?? scoreRow.next_destination,
          best_month: insight?.preferred_travel_month ?? scoreRow.best_month,
          churn_risk: insight?.churn_risk ?? scoreRow.churn_risk,
          visited: scoreRow.visited ?? [], reasons: insight?.score_reasons ?? scoreRow.reasons ?? [],
        } : insight ? {
          segment: insight.segment_code, kind: insight.customer_kind === 'prospect' ? 'lead' : 'buyer',
          r: insight.r_score, f: insight.f_score, m: insight.m_score, lead_score: insight.potential_score,
          propensity: insight.predicted_purchase, next_destination: insight.suggested_destination,
          best_month: insight.preferred_travel_month, churn_risk: insight.churn_risk,
          visited: [], reasons: insight.score_reasons ?? [],
        } : null,
        orders: orders.rows, leads: leads.rows, messages: messages.rows, history: history.rows,
        optOut: optOut.rows, surveys: surveys.rows,
        tasks: tasks.rows, leadOutcomes: leadOutcomes.rows, receipts: receipts.rows,
      };
    },

    async destinations() {
      const result = await pool.query(`SELECT DISTINCT destination FROM orders WHERE is_demo=false AND destination IS NOT NULL AND destination<>'Khác'
        UNION SELECT DISTINCT destination FROM products WHERE is_demo=false AND destination IS NOT NULL AND destination<>'Khác'
        ORDER BY destination`);
      return result.rows.map((row) => row.destination as string);
    },

    async services() {
      return pool.query<{ service_type: string }>(`SELECT DISTINCT service_type FROM order_services WHERE is_demo=false AND service_type IS NOT NULL ORDER BY service_type`);
    },

    async setEmailOptOut(id: number, optedOut: boolean, actor: string) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const customer = await client.query('SELECT 1 FROM customers WHERE customer_id=$1 AND is_demo=false FOR UPDATE', [id]);
        if (!customer.rowCount) throw Object.assign(new Error('Không tìm thấy khách hàng.'), { status: 404 });
        if (optedOut) {
          await client.query(`INSERT INTO care_opt_outs(customer_id,channel,source) VALUES($1,'email',$2)
            ON CONFLICT(customer_id,channel) DO UPDATE SET opted_out_at=now(),source=EXCLUDED.source`, [id,`nhân viên ${actor}`]);
        } else {
          await client.query("DELETE FROM care_opt_outs WHERE customer_id=$1 AND channel='email'", [id]);
        }
        await client.query(`INSERT INTO customer_contact_preferences(customer_id,email_marketing_allowed,consent_basis,consented_at,unsubscribed_at,is_demo)
          VALUES($1,$2,'staff_update',CASE WHEN $2 THEN now() ELSE NULL END,CASE WHEN $2 THEN NULL ELSE now() END,false)
          ON CONFLICT(customer_id) DO UPDATE SET email_marketing_allowed=EXCLUDED.email_marketing_allowed,
            consent_basis=EXCLUDED.consent_basis,consented_at=CASE WHEN EXCLUDED.email_marketing_allowed THEN now() ELSE customer_contact_preferences.consented_at END,
            unsubscribed_at=CASE WHEN EXCLUDED.email_marketing_allowed THEN NULL ELSE now() END`, [id,!optedOut]);
        await client.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,$2,$3::jsonb)',[actor,optedOut?'optout.add':'optout.remove',JSON.stringify({customer:id})]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },

  };
}
