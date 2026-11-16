import 'dotenv/config';
import { pool } from '../db/pool.js';

export async function seedDemo(): Promise<Record<string, number>> {
  const client = await pool.connect();
  const counts: Record<string, number> = {};
  try {
    await client.query('BEGIN');
    for (const table of ['messages', 'surveys', 'care_tasks', 'passengers', 'order_services', 'activities', 'leads', 'orders', 'campaigns', 'products', 'customer_insights', 'customer_contact_preferences', 'customers']) {
      await client.query(`DELETE FROM ${table} WHERE is_demo = true`);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const date = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const timestamp = (offset: number, hour = 9) => `${date(offset)}T${String(hour).padStart(2, '0')}:00:00+07:00`;
    const customerIds = new Map<string, number>();
    const tiers = ['Kim cương', 'Vàng', 'Bạc', 'Tiêu chuẩn', null];
    const destinations = ['Nhật Bản', 'Hàn Quốc', 'Đài Loan', 'Thái Lan', 'Úc', 'Châu Âu', 'Phú Quốc', 'Đà Nẵng'];
    const sources = ['Facebook', 'Khách cũ giới thiệu', 'Website', 'Zalo', 'Quảng cáo Google'];
    const sales = [
      { id: 901, name: 'Sale Demo 1' },
      { id: 902, name: 'Sale Demo 2' },
      { id: 903, name: 'Sale Demo 3' },
    ];

    for (let i = 1; i <= 74; i++) {
      const key = `customer-${String(i).padStart(3, '0')}`;
      const partner = i >= 45 && i <= 50;
      const segment = i <= 50 ? 'buyer' : 'prospect';
      const sale = sales[(i - 1) % sales.length];
      const result = await client.query<{ customer_id: string }>(
        `INSERT INTO customers (
          tourwell_id, demo_key, demo_scenario, is_demo, code, name, link_erp,
          phone_primary, phone_primary_code, email_primary, email_secondary,
          sub_group, customer_type, customer_status, member_tier,
          source_id, source_name, sale_id, sale_name, birthday, tourwell_created_at, last_synced_at
        ) VALUES (NULL,$1,$2,true,$3,$4,NULL,$5,NULL,$6,NULL,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
        ON CONFLICT (demo_key) WHERE demo_key IS NOT NULL DO UPDATE SET
          demo_scenario=EXCLUDED.demo_scenario, code=EXCLUDED.code, name=EXCLUDED.name,
          phone_primary=EXCLUDED.phone_primary, email_primary=EXCLUDED.email_primary,
          sub_group=EXCLUDED.sub_group, customer_type=EXCLUDED.customer_type,
          customer_status=EXCLUDED.customer_status, member_tier=EXCLUDED.member_tier,
          source_id=EXCLUDED.source_id, source_name=EXCLUDED.source_name,
          sale_id=EXCLUDED.sale_id, sale_name=EXCLUDED.sale_name,
          birthday=EXCLUDED.birthday, last_synced_at=now()
        RETURNING customer_id`,
        [
          key, segment, `DEMO-CUST-${String(i).padStart(3, '0')}`, `Khách Demo ${String(i).padStart(2, '0')}`,
          i % 10 === 0 ? null : `SAMPLE-PHONE-${String(i).padStart(3, '0')}`,
          i % 8 === 0 ? null : `khach${String(i).padStart(2, '0')}@example.com`,
          partner ? (i % 2 ? 'Đại lý/Đối tác' : 'Doanh nghiệp') : 'Cá nhân',
          partner ? 'Đối tác' : i > 50 ? 'Tiềm năng' : 'Khách lẻ',
          i > 50 ? 'Tiếp cận' : 'Đang hoạt động', tiers[Math.floor((i - 1) / 7)] || null,
          (i % sources.length) + 1, sources[(i - 1) % sources.length], sale.id, sale.name,
          date(-((i * 37) % 16000)), timestamp(-((i * 13) % 1400)),
        ],
      );
      customerIds.set(key, Number(result.rows[0].customer_id));
      await client.query(
        `INSERT INTO customer_contact_preferences (customer_id,email_marketing_allowed,consent_basis,consented_at,unsubscribed_at,is_demo)
         VALUES ($1,$2,'synthetic_demo',now(),$3,true)`,
        [Number(result.rows[0].customer_id), i % 13 !== 0, i % 13 === 0 ? timestamp(-i) : null],
      );
    }
    counts.customers = customerIds.size;

    const products = [
      ['Tour Nhật Bản 5N4Đ', 'Tour trọn gói', 'Nhật Bản', 32000000],
      ['Tour Hàn Quốc mùa hoa', 'Tour trọn gói', 'Hàn Quốc', 18900000],
      ['Tour Đài Loan 5N4Đ', 'Tour trọn gói', 'Đài Loan', 15900000],
      ['Tour Thái Lan 5N4Đ', 'Tour trọn gói', 'Thái Lan', 9900000],
      ['Tour Úc 7N6Đ', 'Tour trọn gói', 'Úc', 48900000],
      ['Tour Châu Âu 10N9Đ', 'Tour trọn gói', 'Châu Âu', 75900000],
      ['Vé máy bay quốc tế', 'Vé máy bay', 'Khác', 8500000],
      ['Visa Hàn Quốc nhiều lần', 'Visa, hộ chiếu', 'Hàn Quốc', 4500000],
      ['Khách sạn Tokyo', 'Khách sạn', 'Nhật Bản', 6200000],
      ['Bảo hiểm du lịch quốc tế', 'Bảo hiểm', 'Khác', 1200000],
      ['Tour Phú Quốc 4N3Đ', 'Tour trọn gói', 'Phú Quốc', 6900000],
      ['Tour Đà Nẵng 4N3Đ', 'Tour trọn gói', 'Đà Nẵng', 5900000],
      ['Tour Singapore 4N3Đ', 'Tour trọn gói', 'Singapore', 12900000],
      ['Tour Malaysia 4N3Đ', 'Tour trọn gói', 'Malaysia', 10900000],
      ['Tour Indonesia 5N4Đ', 'Tour trọn gói', 'Indonesia', 17900000],
      ['Tour Dubai 6N5Đ', 'Tour trọn gói', 'Dubai', 38900000],
      ['Visa Nhật Bản', 'Visa, hộ chiếu', 'Nhật Bản', 3200000],
      ['Thuê xe du lịch', 'Thuê xe', 'Việt Nam', 2500000],
      ['Vé máy bay nội địa', 'Vé máy bay', 'Việt Nam', 3200000],
      ['Combo nghỉ dưỡng', 'Combo', 'Phú Quốc', 14500000],
    ] as const;
    for (let i = 0; i < products.length; i++) {
      const [name, type, destination, price] = products[i];
      await client.query(
        `INSERT INTO products (demo_key,name,product_type,destination,duration,price,url,active,created_at,is_demo,demo_scenario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,true,$9)`,
        [`product-${String(i + 1).padStart(3, '0')}`, name, type, destination, i < 6 ? '5 ngày 4 đêm' : 'Dịch vụ lẻ', price,
          `https://example.invalid/demo/products/${i + 1}`, timestamp(-i * 14), i % 3 === 0 ? 'new' : 'standard'],
      );
    }
    counts.products = products.length;

    const orderIds = new Map<string, number>();
    const orderCustomerIds = new Map<string, number>();
    const orderDestinations = destinations;
    const completedAssignments: number[] = [];
    for (let customer = 1; customer <= 10; customer++) completedAssignments.push(customer, customer, customer);
    for (let customer = 11; customer <= 20; customer++) completedAssignments.push(customer, customer);
    for (let customer = 21; customer <= 24; customer++) completedAssignments.push(customer);
    for (let customer = 25; customer <= 34; customer++) completedAssignments.push(customer, customer);
    for (let customer = 35; customer <= 50; customer++) completedAssignments.push(customer);

    for (let i = 1; i <= 105; i++) {
      const key = `order-${String(i).padStart(3, '0')}`;
      const customerIndex = i <= completedAssignments.length
        ? completedAssignments[i - 1]
        : ((i - completedAssignments.length - 1) % 50) + 1;
      const customerKey = `customer-${String(customerIndex).padStart(3, '0')}`;
      const customerId = customerIds.get(customerKey)!;
      const canceled = i >= 97;
      const upcoming = i >= 91 && i <= 96;
      const depOffset = upcoming
        ? (i - 90) * 10
        : customerIndex <= 10 ? -((i * 7) % 75 + 5)
          : customerIndex <= 20 ? -((i * 9) % 165 + 10)
            : customerIndex <= 24 ? -((i * 5) % 75 + 5)
              : customerIndex <= 34 ? -((i * 11) % 330 + 400)
                : customerIndex <= 40 ? -((i * 13) % 480 + 180)
                  : -((i * 17) % 750 + 800);
      const returnOffset = depOffset + (i % 2 ? 4 : 5);
      const total = customerIndex <= 10 ? 45_000_000 + i * 1_250_000
        : customerIndex <= 20 ? 18_000_000 + i * 500_000
          : 7_000_000 + i * 350_000;
      const paid = canceled ? 0 : upcoming && i % 2 === 0 ? Math.round(total * 0.45) : total;
      const status = canceled ? 'Đã hủy' : upcoming ? 'Đã xác nhận' : 'Hoàn tất';
      const destination = upcoming
        ? ['Nhật Bản', 'Châu Âu', 'Thái Lan', 'Nhật Bản', 'Hàn Quốc', 'Úc'][i - 91]
        : orderDestinations[(i - 1) % orderDestinations.length];
      const result = await client.query<{ id: string }>(
        `INSERT INTO orders (
          demo_key,code,customer_id,status_code,status_title,order_at,departure,return_date,
          total_amount,paid_amount,remaining_amount,trip_name,destination,sale_id,sale_name,
          source_name,is_b2b,is_demo,demo_scenario
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,$18) RETURNING id`,
        [key, `DEMO-ORD-${String(i).padStart(4, '0')}`, customerId, canceled ? 2 : 1, status,
          timestamp(-((i * 11) % 180), 10), date(depOffset), date(returnOffset), total, paid, total - paid,
          `Hành trình ${destination}`, destination,
          sales[(i - 1) % sales.length].id, sales[(i - 1) % sales.length].name, sources[(i - 1) % sources.length], customerIndex >= 45 && customerIndex <= 50, upcoming ? 'upcoming' : canceled ? 'cancelled' : 'completed'],
      );
      orderIds.set(key, Number(result.rows[0].id));
      orderCustomerIds.set(key, customerId);
      const serviceKinds = i % 4 === 0 ? ['Tour trọn gói', 'Vé máy bay'] : i % 5 === 0 ? ['Vé máy bay', 'Visa'] : ['Tour trọn gói'];
      for (let j = 0; j < serviceKinds.length; j++) {
        await client.query(
          `INSERT INTO order_services (demo_key,order_id,service_type,item_name,description,departure,return_date,is_demo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
          [`service-${i}-${j + 1}`, Number(result.rows[0].id), serviceKinds[j], `${serviceKinds[j]} mẫu`, `Dòng dịch vụ giả lập ${j + 1}`, date(depOffset), date(returnOffset)],
        );
      }
    }
    counts.orders = orderIds.size;
    counts.order_services = await client.query('SELECT count(*)::int AS n FROM order_services WHERE is_demo=true').then((r) => r.rows[0].n);

    const leadStates = [
      ['Chưa tiếp nhận', 0], ['Đang xử lý', 3], ['Đã hủy', 2], ['Đang xử lý', 3], ['Chưa tiếp nhận', 0], ['Đã hủy', 2],
    ] as const;
    const leadIds = new Map<string, number>();
    for (let i = 1; i <= 24; i++) {
      const key = `lead-${String(i).padStart(3, '0')}`;
      const customerIndex = 51 + ((i - 1) % 24);
      const customerKey = `customer-${String(customerIndex).padStart(3, '0')}`;
      const state = leadStates[(i - 1) % leadStates.length];
      const sale = sales[(i - 1) % sales.length];
      const result = await client.query<{ id: string }>(
        `INSERT INTO leads (demo_key,code,customer_id,status_code,status_title,source_name,service,quote_status,created_at,updated_at,sale_id,sale_name,is_demo,demo_scenario)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13) RETURNING id`,
        [key, `DEMO-LEAD-${String(i).padStart(4, '0')}`, customerIds.get(customerKey), state[1], state[0], sources[(i - 1) % sources.length],
          `Tư vấn tour ${destinations[(i - 1) % destinations.length]}`, i % 4 === 0 ? 'Đã tính giá xong' : i % 3 === 0 ? 'Đã gửi báo giá' : null,
          timestamp(-((i * 3) % 30), 11), timestamp(-((i * 2) % 12), 15), sale.id, sale.name, state[0].toLowerCase().replaceAll(' ', '_')],
      );
      leadIds.set(key, Number(result.rows[0].id));
    }
    counts.leads = leadIds.size;

    for (let i = 1; i <= 42; i++) {
      const customerIndex = ((i * 7 - 1) % 74) + 1;
      const customerKey = `customer-${String(customerIndex).padStart(3, '0')}`;
      const sale = sales[(i - 1) % sales.length];
      const reminderOffset = i % 4 === 0 ? -2 : i % 3 === 0 ? 1 : 5;
      await client.query(
        `INSERT INTO activities (demo_key,customer_id,order_id,activity_type,title,created_at,remind_at,status,sale_id,sale_name,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
        [`activity-${String(i).padStart(3, '0')}`, customerIds.get(customerKey), i <= 20 ? orderIds.get(`order-${String(i).padStart(3, '0')}`) || null : null,
          i % 2 ? 'call' : 'email', `Liên hệ chăm sóc mẫu ${i}`, timestamp(-((i * 2) % 28), 14), i % 5 === 0 ? null : timestamp(reminderOffset, 10),
          i % 4 === 0 ? '1' : '0', sale.id, sale.name],
      );
    }
    counts.activities = 42;

    for (let i = 1; i <= 210; i++) {
      const orderNumber = Math.ceil(i / 2);
      const orderKey = `order-${String(orderNumber).padStart(3, '0')}`;
      const nationality = i % 23 === 0 ? 'Hoa Kỳ' : 'Việt Nam';
      await client.query(
        `INSERT INTO passengers (demo_key,order_id,customer_id,name,nationality,is_leader,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [`passenger-${String(i).padStart(3, '0')}`, orderIds.get(orderKey), orderCustomerIds.get(orderKey),
          `Hành khách Demo ${String(i).padStart(3, '0')}`, nationality, i % 2 === 1],
      );
    }
    counts.passengers = 210;

    for (let i = 1; i <= 16; i++) {
      const leadKey = `lead-${String(i).padStart(3, '0')}`;
      const orderKey = `order-${String(((i - 1) % 20) + 1).padStart(3, '0')}`;
      const customerKey = `customer-${String(51 + ((i - 1) % 24)).padStart(3, '0')}`;
      await client.query(
        `INSERT INTO care_tasks (demo_key,customer_id,order_id,lead_id,task_kind,priority,title,detail,due_at,status,created_at,completed_at,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`,
        [`task-${String(i).padStart(3, '0')}`, customerIds.get(customerKey), orderIds.get(orderKey), leadIds.get(leadKey) || null,
          ['lead_new','lead_follow','complaint','unpaid','followup'][i % 5], i % 3 === 0 ? 'urgent' : i % 3 === 1 ? 'today' : 'later',
          `Việc demo cần xử lý ${i}`, 'Nội dung và thông tin trong tác vụ này hoàn toàn giả lập.', timestamp((i % 4) - 1, 16), i % 4 === 0 ? 'done' : 'open', timestamp(-3, 9), i % 4 === 0 ? timestamp(-1, 16) : null],
      );
    }
    counts.care_tasks = await client.query('SELECT count(*)::int AS n FROM care_tasks WHERE is_demo=true').then((result) => result.rows[0].n);

    const scores = [3, 5, 6, 7, 8, 9, 10, 10];
    for (let i = 1; i <= scores.length; i++) {
      const orderKey = `order-${String(i).padStart(3, '0')}`;
      const order = await client.query<{ id: string; customer_id: string }>('SELECT id,customer_id FROM orders WHERE demo_key=$1', [orderKey]);
      await client.query(
        `INSERT INTO surveys (demo_key,customer_id,order_id,score,comment,sent_at,answered_at,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        [`survey-${String(i).padStart(3, '0')}`, Number(order.rows[0].customer_id), Number(order.rows[0].id), scores[i - 1],
          i % 2 ? 'Phản hồi khảo sát mẫu.' : null, timestamp(-10, 9), timestamp(-8, 12)],
      );
    }
    counts.surveys = scores.length;

    const campaignNames = ['Gợi ý tour theo điểm đến', 'Chăm sóc khách cũ', 'Bản tin mùa du lịch'];
    const campaignIds = new Map<number, number>();
    for (let i = 0; i < campaignNames.length; i++) {
      const key = `campaign-${String(i + 1).padStart(3, '0')}`;
      const result = await client.query<{ id: string }>(
        `INSERT INTO campaigns (demo_key,name,goal,status,subject,created_at,scheduled_at,sent_at,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id`,
        [key,campaignNames[i],['engagement','retention','seasonal'][i],i === 0 ? 'done' : i === 1 ? 'approved' : 'scheduled',
          `Email demo ${i + 1}`,timestamp(-20, 8),i === 2 ? timestamp(2, 9) : null,i < 2 ? timestamp(-18, 9) : null],
      );
      campaignIds.set(i + 1, Number(result.rows[0].id));
    }
    counts.campaigns = campaignNames.length;

    for (let i = 1; i <= 36; i++) {
      const customerIndex = 51 + ((i - 1) % 24);
      const campaignIndex = ((i - 1) % 3) + 1;
      const hasEmail = customerIndex % 8 !== 0;
      const wasSent = campaignIndex !== 3 && hasEmail;
      const opened = wasSent && i % 3 !== 0;
      const clicked = opened && i % 4 === 0;
      await client.query(
        `INSERT INTO messages (demo_key,campaign_id,customer_id,journey,subject,to_addr,marketing,status,created_at,sent_at,opened_at,clicked_at,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,true)`,
        [`message-${String(i).padStart(3, '0')}`,campaignIds.get(campaignIndex),customerIds.get(`customer-${String(customerIndex).padStart(3, '0')}`),
          'campaign_demo',`Tin demo ${i}`,hasEmail ? `khach${String(customerIndex).padStart(2, '0')}@example.com` : null,
          wasSent ? 'sent' : campaignIndex === 3 ? 'queued' : 'skipped',timestamp(-20 + i % 10, 9),
          wasSent ? timestamp(-18 + i % 8, 9) : null,opened ? timestamp(-17 + i % 8, 10) : null,clicked ? timestamp(-16 + i % 8, 11) : null],
      );
    }
    counts.messages = 36;

    const factResult = await client.query<{
      customer_id: string;
      email_primary: string | null;
      phone_primary: string | null;
      source_name: string | null;
      completed_count: number;
      last_trip: string | null;
      total_spend: string;
      trip_dates: string[] | null;
      trip_months: number[] | null;
      visited_destinations: string[] | null;
      lead_status: string | null;
      quote_status: string | null;
      lead_service: string | null;
      last_activity: string | null;
      opened_count: number;
      clicked_count: number;
    }>(`
      SELECT c.customer_id,c.email_primary,c.phone_primary,c.source_name,
        COALESCE(o.completed_count,0)::int AS completed_count,o.last_trip,o.total_spend,
        o.trip_dates,o.trip_months,o.visited_destinations,l.status_title AS lead_status,l.quote_status,l.service AS lead_service,
        a.last_activity,COALESCE(m.opened_count,0)::int AS opened_count,COALESCE(m.clicked_count,0)::int AS clicked_count
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE status_title='Hoàn tất') AS completed_count,
          (max(departure) FILTER (WHERE status_title='Hoàn tất'))::text AS last_trip,
          COALESCE(sum(total_amount) FILTER (WHERE status_title='Hoàn tất'),0)::text AS total_spend,
          array_agg(departure::text ORDER BY departure) FILTER (WHERE status_title='Hoàn tất') AS trip_dates,
          array_agg(extract(month FROM departure)::int ORDER BY departure) FILTER (WHERE status_title='Hoàn tất') AS trip_months,
          array_agg(destination ORDER BY departure) FILTER (WHERE status_title='Hoàn tất') AS visited_destinations
        FROM orders WHERE customer_id=c.customer_id AND is_demo=true
      ) o ON true
      LEFT JOIN LATERAL (
        SELECT status_title,quote_status,service FROM leads WHERE customer_id=c.customer_id AND is_demo=true
        ORDER BY created_at DESC,id DESC LIMIT 1
      ) l ON true
      LEFT JOIN LATERAL (
        SELECT max(created_at)::text AS last_activity FROM activities WHERE customer_id=c.customer_id AND is_demo=true
      ) a ON true
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE opened_at IS NOT NULL) AS opened_count,
          count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked_count
        FROM messages WHERE customer_id=c.customer_id AND is_demo=true
      ) m ON true
      WHERE c.is_demo=true
    `);

    const facts = factResult.rows;
    const buyersBySpend = facts.filter((fact) => fact.completed_count > 0)
      .sort((a, b) => Number(a.total_spend) - Number(b.total_spend));
    const monetaryScores = new Map<string, number>();
    buyersBySpend.forEach((fact, index) => {
      monetaryScores.set(fact.customer_id, Math.min(5, Math.ceil(((index + 1) / buyersBySpend.length) * 5)));
    });
    const destinationPopularity = await client.query<{ destination: string }>(
      `SELECT destination FROM orders WHERE is_demo=true AND status_title='Hoàn tất' AND destination IS NOT NULL
       GROUP BY destination ORDER BY count(*) DESC,destination LIMIT 20`,
    );
    const popularDestinations = destinationPopularity.rows.map((row) => row.destination);
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
    let scored = 0;

    for (const fact of facts) {
      const customerId = Number(fact.customer_id);
      const isBuyer = fact.completed_count > 0;
      let rScore: number | null = null;
      let fScore: number | null = null;
      let mScore: number | null = null;
      let potentialScore: number | null = null;
      let potentialTier: 'hot' | 'warm' | 'cold' | null = null;
      let segmentCode: string;
      let predictedPurchase: 'high' | 'medium' | 'low';
      let predictedPurchaseScore: number;
      let churnRisk: 'high' | 'medium' | 'low' | 'insufficient_history' = 'insufficient_history';
      const reasons: string[] = [];
      const tripMonths = (fact.trip_months ?? []).map(Number);
      const monthFrequency = new Map<number, number>();
      tripMonths.forEach((month) => monthFrequency.set(month, (monthFrequency.get(month) ?? 0) + 1));
      const preferredMonth = [...monthFrequency.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
      const visited = [...new Set(fact.visited_destinations ?? [])];
      const suggestedFromLead = !isBuyer
        ? destinations.find((destination) => fact.lead_service?.includes(destination))
        : undefined;
      const suggestedDestination = suggestedFromLead
        ?? popularDestinations.find((destination) => !visited.includes(destination))
        ?? popularDestinations[0]
        ?? null;

      if (isBuyer) {
        const elapsed = fact.last_trip ? Math.max(0, Math.floor((Date.now() - new Date(`${fact.last_trip}T00:00:00Z`).getTime()) / 86_400_000)) : 0;
        rScore = elapsed <= 90 ? 5 : elapsed <= 180 ? 4 : elapsed <= 365 ? 3 : elapsed <= 730 ? 2 : 1;
        fScore = fact.completed_count === 1 ? 1 : fact.completed_count === 2 ? 3 : fact.completed_count === 3 ? 4 : 5;
        mScore = monetaryScores.get(fact.customer_id) ?? 1;
        if (rScore === 1) segmentCode = 'dormant';
        else if (mScore === 5 && (fScore >= 3 || rScore >= 4)) segmentCode = 'vip';
        else if (fScore >= 2 && rScore >= 3) segmentCode = 'loyal';
        else if (fScore === 1 && rScore >= 4) segmentCode = 'new_buyer';
        else if (fScore >= 2 && rScore <= 2) segmentCode = 'at_risk';
        else segmentCode = 'one_time';
        reasons.push(`R=${rScore} (lần đi gần nhất cách ${elapsed} ngày)`, `F=${fScore} (${fact.completed_count} đơn hoàn tất)`, `M=${mScore} (phân vị chi tiêu)`);
        const monthsToPreferred = preferredMonth === null ? null : (preferredMonth - currentMonth + 12) % 12;
        const seasonBonus = monthsToPreferred !== null && monthsToPreferred <= 2 ? 10 : 0;
        predictedPurchaseScore = Math.min(100, rScore * 10 + fScore * 6 + mScore * 4 + seasonBonus);
        reasons.push(`Điểm dự đoán demo = R×10 + F×6 + M×4${seasonBonus ? ' + 10 điểm mùa vụ' : ''}; cao từ 70, trung bình từ 40.`);
        if (seasonBonus) reasons.push(`+10 mùa đi thường lệ sắp tới (tháng ${preferredMonth})`);
        predictedPurchase = predictedPurchaseScore >= 70 ? 'high' : predictedPurchaseScore >= 40 ? 'medium' : 'low';
        const tripDates = (fact.trip_dates ?? []).map((value) => String(value).slice(0, 10)).sort();
        if (fact.completed_count >= 2 && tripDates.length >= 2 && fact.last_trip) {
          const gaps = tripDates.slice(1).map((value, index) => daysBetween(tripDates[index], value)).sort((a, b) => a - b);
          const middle = Math.floor(gaps.length / 2);
          const intervalDays = Math.max(1, gaps.length % 2 ? gaps[middle] : Math.round((gaps[middle - 1] + gaps[middle]) / 2));
          churnRisk = elapsed > intervalDays * 1.5 ? 'high' : elapsed > intervalDays ? 'medium' : 'low';
          reasons.push(`Nguy cơ rời bỏ so với trung vị khoảng cách giữa các chuyến mẫu (${intervalDays} ngày)`);
        }
      } else {
        let raw = 0;
        const add = (points: number, reason: string) => { raw += points; reasons.push(`${points > 0 ? '+' : ''}${points} ${reason}`); };
        if (fact.lead_status === 'Đang xử lý') add(20, 'lead đang được tư vấn');
        else if (fact.lead_status === 'Chưa tiếp nhận') add(10, 'lead mới chưa tiếp nhận');
        else if (fact.lead_status === 'Đã hủy') add(-30, 'lead đã hủy');
        if (fact.quote_status === 'Đã tính giá xong') { add(15, 'đã có báo giá'); add(10, 'báo giá đã tính xong'); }
        else if (fact.quote_status) add(15, 'đã có báo giá');
        if (fact.last_activity) {
          const activityAge = Math.max(0, Math.floor((Date.now() - new Date(fact.last_activity).getTime()) / 86_400_000));
          if (activityAge <= 14) add(20, 'tương tác trong 14 ngày');
          else if (activityAge <= 30) add(10, 'tương tác trong 30 ngày');
          else if (activityAge > 90) add(-20, 'không tương tác quá 90 ngày');
        } else add(-20, 'chưa có tương tác ghi nhận');
        if (fact.source_name?.toLocaleLowerCase('vi').includes('giới thiệu')) add(15, 'nguồn khách giới thiệu');
        else if (/facebook|google|quảng cáo/i.test(fact.source_name ?? '')) add(5, 'nguồn quảng cáo');
        if (fact.email_primary && fact.phone_primary) add(10, 'có cả số điện thoại và email');
        if (fact.opened_count > 0) add(5, 'đã mở email');
        if (fact.clicked_count > 0) add(15, 'đã bấm xem nội dung');
        potentialScore = Math.max(0, Math.min(100, raw));
        potentialTier = potentialScore >= 70 ? 'hot' : potentialScore >= 40 ? 'warm' : 'cold';
        segmentCode = `prospect_${potentialTier}`;
        predictedPurchaseScore = potentialScore;
        predictedPurchase = potentialTier === 'hot' ? 'high' : potentialTier === 'warm' ? 'medium' : 'low';
        reasons.push('Điểm và ngưỡng tiềm năng theo quy tắc demo.');
      }

      if (suggestedDestination) reasons.push('Gợi ý điểm đến là dữ liệu demo theo nhu cầu lead hoặc điểm đến hoàn tất phổ biến chưa đi.');
      await client.query(
        `INSERT INTO customer_insights (
          customer_id,customer_kind,r_score,f_score,m_score,potential_score,potential_tier,segment_code,
          score_reasons,predicted_purchase,predicted_purchase_score,suggested_destination,preferred_travel_month,
          churn_risk,prediction_method,is_demo,calculated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,'transparent_demo_rules_v1',true,now())
        ON CONFLICT (customer_id) DO UPDATE SET customer_kind=EXCLUDED.customer_kind,r_score=EXCLUDED.r_score,
          f_score=EXCLUDED.f_score,m_score=EXCLUDED.m_score,potential_score=EXCLUDED.potential_score,
          potential_tier=EXCLUDED.potential_tier,segment_code=EXCLUDED.segment_code,score_reasons=EXCLUDED.score_reasons,
          predicted_purchase=EXCLUDED.predicted_purchase,predicted_purchase_score=EXCLUDED.predicted_purchase_score,
          suggested_destination=EXCLUDED.suggested_destination,preferred_travel_month=EXCLUDED.preferred_travel_month,
          churn_risk=EXCLUDED.churn_risk,prediction_method=EXCLUDED.prediction_method,is_demo=true,calculated_at=now()`,
        [customerId,isBuyer?'buyer':'prospect',rScore,fScore,mScore,potentialScore,potentialTier,segmentCode,
          JSON.stringify(reasons),predictedPurchase,predictedPurchaseScore,suggestedDestination,preferredMonth,churnRisk],
      );
      scored += 1;
    }
    counts.customer_insights = scored;
    counts.unsubscribed_customers = await client.query(
      'SELECT count(*)::int AS n FROM customer_contact_preferences WHERE is_demo=true AND email_marketing_allowed=false',
    ).then((result) => result.rows[0].n);

    await client.query('COMMIT');
    return counts;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
