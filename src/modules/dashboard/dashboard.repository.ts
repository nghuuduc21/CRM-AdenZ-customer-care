import type { Pool } from 'pg';
import { createCustomerRepository } from '../customers/customer.repository.js';
import { CARE_SEGMENTS } from '../scoring/scoring.constants.js';
import { JOURNEYS } from '../settings/settings.defaults.js';

export function createDashboardRepository(pool: Pool) {
  const customers = createCustomerRepository(pool);
  return {
    async status(user: unknown) {
      const [queue, lastSync] = await Promise.all([
        pool.query(`SELECT count(*) FILTER(WHERE status='queued')::int AS queued,
          count(*) FILTER(WHERE status='sent')::int AS sent,count(*) FILTER(WHERE status='failed')::int AS failed FROM messages WHERE is_demo=true`),
        pool.query(`SELECT occurred_at,detail FROM care_audit WHERE action='sync' ORDER BY id DESC LIMIT 1`),
      ]);
      return {
        demo: true,
        sample: false,
        smtpReady: false,
        testTo: '',
        lastSync: lastSync.rows[0] ? { at: lastSync.rows[0].occurred_at, ...lastSync.rows[0].detail } : null,
        nextRuns: {},
        queue: queue.rows[0],
        segments: CARE_SEGMENTS,
        journeys: JOURNEYS,
        user,
        taskKinds: {
          lead_new:{label:'Lead mới'},lead_follow:{label:'Theo đuổi lead'},complaint:{label:'Khách phản hồi chưa hài lòng'},
          boss_call:{label:'Sếp gọi chăm sóc'},tw_reminder:{label:'Nhắc việc từ CRM'},
        },
        lostReasons:['Giá cao','Chưa chốt ngày đi','Chọn công ty khác','Chỉ tham khảo','Không liên lạc được','Lead rác / thử nghiệm'],
        outcomes:['Đã liên hệ, khách quan tâm','Đã liên hệ, khách chưa có nhu cầu','Đã xử lý xong','Khách đã mua thêm','Không liên lạc được'],
        alertDays:14,
      };
    },

    async dashboard() {
      const [segments, kpi, optOut, openTasks, repeat, hot, likely, churn, campaigns] = await Promise.all([
        pool.query(`SELECT COALESCE(i.segment_code,s.segment) AS segment,count(*)::int AS n,
          COALESCE(sum(s.total_spend),0)::numeric AS spend FROM customers c
          LEFT JOIN customer_insights i ON i.customer_id=c.customer_id
          LEFT JOIN care_scores s ON s.customer_id=c.customer_id
          WHERE c.is_demo=true AND (i.customer_kind IS NOT NULL OR s.kind IN ('buyer','lead')) GROUP BY 1 ORDER BY 1`),
        pool.query(`SELECT count(*) FILTER(WHERE customer_kind='buyer')::int AS buyers,
          count(*) FILTER(WHERE customer_kind='prospect')::int AS leads,
          count(*) FILTER(WHERE potential_tier='hot')::int AS hot,
          count(*) FILTER(WHERE customer_kind='buyer' AND churn_risk='high')::int AS churn,
          count(*) FILTER(WHERE predicted_purchase='high')::int AS likely FROM customer_insights WHERE is_demo=true`),
        pool.query(`SELECT count(DISTINCT customer_id)::int AS n FROM (
          SELECT o.customer_id FROM care_opt_outs o JOIN customers c USING(customer_id) WHERE o.channel='email' AND c.is_demo=true
          UNION SELECT p.customer_id FROM customer_contact_preferences p JOIN customers c USING(customer_id) WHERE p.email_marketing_allowed=false AND c.is_demo=true
        ) opted`),
        pool.query("SELECT count(*)::int AS n FROM care_tasks WHERE status='open' AND is_demo=true"),
        pool.query("SELECT count(*)::int AS n FROM customer_insights WHERE customer_kind='buyer' AND f_score >= 3 AND is_demo=true"),
        customers.list({ segment: 'hot' }, 8),
        customers.list({ propensity: 'high' }, 8),
        customers.list({ segment: 'at_risk' }, 20),
        pool.query(`SELECT c.id,c.name,c.status,c.sent_at,
          count(m.id) FILTER(WHERE m.status='sent')::int AS sent,
          count(m.id) FILTER(WHERE m.status='queued')::int AS queued,
          count(m.id) FILTER(WHERE m.status='failed')::int AS failed,
          count(m.id) FILTER(WHERE m.status='skipped')::int AS skipped,
          count(m.id) FILTER(WHERE m.opened_at IS NOT NULL)::int AS opened,
          count(m.id) FILTER(WHERE m.clicked_at IS NOT NULL)::int AS clicked,
          count(m.id) FILTER(WHERE m.status='unsubscribed')::int AS unsubscribed,
          NULL::int AS buyers,NULL::numeric AS revenue
          FROM campaigns c LEFT JOIN messages m ON m.campaign_id=c.id
          WHERE c.is_demo=true
          GROUP BY c.id ORDER BY c.id DESC LIMIT 5`),
      ]);
      return {
        segments: segments.rows,
        kpi: { ...kpi.rows[0], optOut: optOut.rows[0].n, repeatBuyers: repeat.rows[0].n, openTasks: openTasks.rows[0].n },
        hot: hot.map((row) => ({ ...row, reasons: row.reasons ?? [] })),
        likely: likely.filter((row) => row.kind === 'buyer'),
        churn: churn.filter((row) => row.kind === 'buyer').slice(0, 8),
        campaigns: campaigns.rows.map(({ sent,queued,failed,skipped,opened,clicked,unsubscribed,buyers,revenue,...campaign }) => ({
          ...campaign, report: { sent,queued,failed,skipped,opened,clicked,unsubscribed,buyers,revenue },
        })),
      };
    },

  };
}
