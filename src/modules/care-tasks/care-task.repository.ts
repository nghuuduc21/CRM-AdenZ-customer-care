import type { Pool } from 'pg';

const taskSelect = `SELECT t.*,COALESCE(t.kind,t.task_kind) AS kind,t.due AS due_old,
  c.name,c.phone_primary AS phone,c.email_primary AS email,COALESCE(c.member_tier,c.tier) AS tier,
  o.code AS order_code,COALESCE(NULLIF(o.link,''),NULLIF(l.link,''),c.link_erp,c.link) AS tw_link
  FROM care_tasks t LEFT JOIN customers c ON c.customer_id=t.customer_id
  LEFT JOIN orders o ON o.id=t.order_id LEFT JOIN leads l ON l.id=t.lead_id`;

export function createCareTaskRepository(pool: Pool) {
  return {
    async today(user: { role: string; saleId: number | null }, view: string, now: Date) {
      const values: unknown[] = [now];
      let filter = "t.status='open' AND (t.snooze_until IS NULL OR t.snooze_until <= $1)";
      if (user.role === 'sale' || view === 'mine') {
        values.push(user.saleId ?? -1);
        filter += ` AND t.sale_id=$${values.length}`;
      } else if (view === 'boss') {
        filter += " AND (t.sale_id IS NULL OR COALESCE(t.kind,t.task_kind) IN ('complaint','boss_call'))";
      } else if (view.startsWith('sale:')) {
        values.push(Number(view.slice(5)) || -1);
        filter += ` AND t.sale_id=$${values.length}`;
      }
      const dayStart = new Date(now.getTime() + 7 * 60 * 60_000);
      dayStart.setUTCHours(0,0,0,0);
      const dayStartUtc = new Date(dayStart.getTime() - 7 * 60 * 60_000);
      const [tasks, done, journeys, staff] = await Promise.all([
        pool.query(`${taskSelect} WHERE ${filter} ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,COALESCE(t.due,t.due_at,t.created_at) LIMIT 500`, values),
        pool.query(`SELECT t.id,t.title,t.outcome,t.done_by,t.done_at,c.name FROM care_tasks t
          LEFT JOIN customers c ON c.customer_id=t.customer_id WHERE t.status='done' AND COALESCE(t.done_at,t.completed_at)>=$1
          ${user.role==='sale' ? 'AND t.sale_id=$2' : ''} ORDER BY COALESCE(t.done_at,t.completed_at) DESC LIMIT 50`, user.role==='sale' ? [dayStartUtc,user.saleId ?? -1] : [dayStartUtc]),
        pool.query(`SELECT journey,count(*)::int AS n FROM messages WHERE journey IS NOT NULL AND status IN ('sent','queued') AND created_at>=$1 GROUP BY journey`, [dayStartUtc]),
        user.role==='sale' ? Promise.resolve({rows:[] as Record<string,unknown>[]}) : pool.query(`SELECT sale_id AS id,COALESCE(MAX(sale_name),'') AS name,count(*)::int AS n FROM care_tasks WHERE status='open' AND sale_id IS NOT NULL GROUP BY sale_id ORDER BY n DESC`),
      ]);
      return {
        view: user.role==='sale' ? 'mine' : view,
        tasks: tasks.rows.map((row) => ({ ...row, due: row.due ?? row.due_at })),
        done: done.rows, auto: journeys.rows, staff: staff.rows,
        noSaleId: user.role==='sale' && !Number.isInteger(user.saleId),
      };
    },

    async monitor(days: number, now: Date) {
      const from = new Date(now.getTime() - days * 86_400_000);
      const [alerts, handled, partners, messages, responses, daily, sales, effect] = await Promise.all([
        pool.query(`${taskSelect} WHERE t.status='open' ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,COALESCE(t.due,t.due_at,t.created_at) LIMIT 300`),
        pool.query(`SELECT t.id,t.title,t.outcome,t.done_by,t.done_at,t.status,c.name FROM care_tasks t
          LEFT JOIN customers c ON c.customer_id=t.customer_id WHERE t.status IN ('done','expired') AND COALESCE(t.done_at,t.completed_at)>=$1
          ORDER BY COALESCE(t.done_at,t.completed_at) DESC LIMIT 40`, [from]),
        pool.query(`SELECT p.*,c.name,c.sub_group,c.sale_name,t.status AS task_status,t.outcome FROM care_partner_requests p
          LEFT JOIN customers c ON c.customer_id=p.customer_id LEFT JOIN care_tasks t ON t.dedupe_key='partner_req:'||p.id::text
          ORDER BY p.id DESC LIMIT 30`),
        pool.query(`SELECT count(*) FILTER(WHERE status='sent')::int AS sent,
          count(*) FILTER(WHERE status='sent' AND opened_at IS NOT NULL)::int AS opened,
          count(*) FILTER(WHERE status='sent' AND clicked_at IS NOT NULL)::int AS clicked
          FROM messages WHERE sent_at >= $1`, [from]),
        pool.query(`SELECT count(*) FILTER(WHERE answered_at IS NOT NULL)::int AS answered,count(*)::int AS sent,
          round(avg(score)::numeric,1) AS average,count(*) FILTER(WHERE score<=6)::int AS low
          FROM surveys WHERE sent_at >= $1`, [from]),
        pool.query(`SELECT d.day::date AS day,coalesce(m.sent,0)::int AS sent,coalesce(m.opened,0)::int AS opened,
          coalesce(m.clicked,0)::int AS clicked,coalesce(o.buyers,0)::int AS buyers
          FROM generate_series($1::date,$2::date,'1 day') d(day)
          LEFT JOIN LATERAL (SELECT count(*)::int AS sent,count(*) FILTER(WHERE opened_at IS NOT NULL)::int AS opened,
            count(*) FILTER(WHERE clicked_at IS NOT NULL)::int AS clicked FROM messages WHERE status='sent' AND sent_at::date=d.day) m ON true
          LEFT JOIN LATERAL (SELECT count(DISTINCT customer_id)::int AS buyers FROM orders WHERE status_code<>2 AND order_at::date=d.day) o ON true
          ORDER BY d.day`, [from.toISOString().slice(0,10),now.toISOString().slice(0,10)]),
        pool.query(`SELECT coalesce(nullif(sale_name,''),'(chưa giao)') AS sale,count(*)::int AS open,
          count(*) FILTER(WHERE coalesce(due,due_at)<$1)::int AS late FROM care_tasks WHERE status='open' GROUP BY sale_id,sale_name ORDER BY open DESC`, [now]),
        pool.query(`SELECT c.name AS campaign,m.journey AS key,count(*)::int AS sent,
          count(*) FILTER(WHERE m.opened_at IS NOT NULL)::int AS opened,
          count(*) FILTER(WHERE m.clicked_at IS NOT NULL)::int AS clicked,
          NULL::text AS result,NULL::int AS results
          FROM messages m LEFT JOIN campaigns c ON c.id=m.campaign_id
          WHERE m.status='sent' AND m.sent_at >= $1
          GROUP BY m.campaign_id,m.journey,c.name ORDER BY sent DESC`, [from]),
      ]);
      const msg=messages.rows[0],sv=responses.rows[0];
      const pct=(a:number,b:number)=>b?Math.round(a/b*100):null;
      const rows=[
        {key:'sent',group:'Khách nhận và tương tác',label:'Email chăm sóc đã gửi',value:msg.sent,target:''},
        {key:'open',group:'Khách nhận và tương tác',label:'Tỷ lệ khách mở email',value:pct(msg.opened,msg.sent),unit:'%',target:'≥ 30%',note:'Một số ứng dụng email chặn ảnh nên số liệu mở có thể thấp hơn thực tế.'},
        {key:'click',group:'Khách nhận và tương tác',label:'Tỷ lệ khách bấm xem tour, dịch vụ',value:pct(msg.clicked,msg.sent),unit:'%',target:'≥ 3%'},
        {key:'optout',group:'Khách nhận và tương tác',label:'Khách hủy nhận tin',value:null,target:'dưới 0,5% số tin'},
        {key:'survey',group:'Khách nhận và tương tác',label:'Khách trả lời khảo sát sau chuyến đi',value:pct(sv.answered,sv.sent),unit:'%',target:'≥ 20%',note:`${sv.answered}/${sv.sent} khảo sát`},
        {key:'score',group:'Khách nhận và tương tác',label:'Điểm hài lòng trung bình',value:sv.average,unit:'/10',target:'≥ 8,5',note:`${sv.low} khách chấm 0–6`},
        {key:'conv',group:'Kết quả trên CRM',label:'Khách đặt đơn trong 30 ngày sau khi nhận tin chăm sóc',value:null,target:'tăng dần'},
        {key:'pay',group:'Kết quả trên CRM',label:'Đơn được nhắc thanh toán đã trả đủ',value:null,unit:'%',target:'≥ 90%'},
        {key:'pickup',group:'Kết quả trên CRM',label:'Thời gian tiếp nhận lead (trung vị)',value:null,unit:' phút',target:'≤ 15 phút'},
        {key:'untouched',group:'Kết quả trên CRM',label:'Lead "Chưa tiếp nhận" quá 1 ngày (tổng)',value:null,target:'0'},
        {key:'kmv',group:'Kết quả trên CRM',label:'Lead KMV thành đơn (tổng)',value:'—',target:'theo dõi hằng tuần'},
        {key:'alerts',group:'Kết quả trên CRM',label:'Cảnh báo được xử lý trên CRM',value:pct(handled.rows.length,handled.rows.length+alerts.rows.length),unit:'%',target:'≥ 85%'},
        {key:'twOverdue',group:'Kết quả trên CRM',label:'Lời nhắc chăm sóc trên CRM quá hạn',value:null,target:'dưới 5'},
        {key:'partner',group:'Đối tác',label:'Yêu cầu của đối tác được xử lý trên CRM',value:`${partners.rows.filter(x=>x.task_status==='done').length}/${partners.rowCount}`,target:'tất cả'},
        {key:'multi',group:'Kinh doanh',label:'Đơn có từ 2 dịch vụ (90 ngày)',value:null,unit:'%',target:'15%'},
        {key:'repeat',group:'Kinh doanh',label:'Khách mua lại (12 tháng)',value:null,unit:'%',target:'35%'},
      ];
      return {
        alerts:alerts.rows.map(row=>({...row,due:row.due??row.due_at})),handled:handled.rows,partners:partners.rows,
        feed:[],effect:effect.rows,kpi:{from:from.toISOString(),to:now.toISOString(),days,rows,bySale:sales.rows,trend:daily.rows},
      };
    },

    async task(id: number) {
      const result=await pool.query('SELECT * FROM care_tasks WHERE id=$1',[id]);
      return result.rows[0]??null;
    },

    async updateOutcome(id: number, input: {action?:string;until?:string;reason?:string;note?:string;outcome?:string}, actor: string) {
      const task=await this.task(id);
      if(!task) throw Object.assign(new Error('Không tìm thấy việc.'),{status:404});
      const note=String(input.note??'').trim().slice(0,500);
      if(input.action==='snooze'){
        const until=new Date(input.until??''); if(Number.isNaN(until.getTime())) throw new Error('Chọn thời gian nhắc lại.');
        await pool.query('UPDATE care_tasks SET snooze_until=$1 WHERE id=$2',[until,id]);
      }else if(input.action==='reopen'){
        await pool.query(`UPDATE care_tasks SET status='open',done_at=NULL,completed_at=NULL,done_by=NULL,outcome=NULL WHERE id=$1`,[id]);
      }else{
        if(input.action==='lost'){
          if(!task.lead_id) throw new Error('Chỉ dùng kết quả chưa mua cho việc liên quan lead.');
          const reason=String(input.reason??'').slice(0,100);
          if(!reason) throw new Error('Chọn lý do khách chưa mua.');
          await pool.query(`INSERT INTO care_lead_outcomes(lead_id,customer_id,reason,note,recorded_by,nurture_until)
            VALUES($1,$2,$3,$4,$5,current_date+182) ON CONFLICT(lead_id) DO UPDATE SET reason=EXCLUDED.reason,note=EXCLUDED.note,recorded_by=EXCLUDED.recorded_by,recorded_at=now(),nurture_until=EXCLUDED.nurture_until`,[task.lead_id,task.customer_id,reason,note,actor]);
        }
        const result=input.action==='lost'?`Chưa mua: ${input.reason}${note?` · ${note}`:''}`:`${String(input.outcome||'Đã xử lý xong').slice(0,100)}${note?` · ${note}`:''}`;
        await pool.query(`UPDATE care_tasks SET status='done',done_at=now(),completed_at=now(),done_by=$1,outcome=$2 WHERE id=$3`,[actor,result,id]);
      }
      await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,$2,$3::jsonb)',[actor,`task.${input.action||'done'}`,JSON.stringify({id,kind:task.kind??task.task_kind})]);
    },
  };
}
