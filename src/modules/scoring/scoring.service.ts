import type { Pool } from 'pg';
import type { Settings } from '../settings/settings.defaults.js';
import type { Weights } from './scoring.constants.js';

type Fact={customer_id:string;email_primary:string|null;phone_primary:string|null;source_name:string|null;sale_id:string|null;sale_name:string|null;completed_count:number;last_trip:string|null;last_order_at:Date|null;total_spend:string;trip_dates:string[]|null;trip_months:number[]|null;destinations:string[]|null;lead_count:number;lead_status:string|null;status_code:number|null;quote_status:string|null;lead_service:string|null;lead_source:string|null;lead_updated_at:Date|null;last_activity:Date|null;opened_at:Date|null;clicked_at:Date|null;source_type:string|null;source_label:string|null;action_source:string|null;activity_internal:boolean|null;quote_count:number;quote_statuses:string[]|null;latest_quote_at:Date|null};
type Score={id:number;kind:'buyer'|'prospect';r:number|null;f:number|null;m:number|null;spend:number;lastTrip:string|null;leadScore:number|null;propensity:'high'|'medium'|'low';next:string|null;month:number|null;churn:'high'|'medium'|'low'|'insufficient_history';visited:string[];reasons:string[];segment:string;prediction:number};
const DAY=86_400_000;
const age=(date:Date|null,now:Date)=>date?Math.max(0,Math.floor((now.getTime()-date.getTime())/DAY)):Infinity;
const diffDays=(a:string,b:string)=>Math.round((Date.parse(`${b.slice(0,10)}T00:00:00Z`)-Date.parse(`${a.slice(0,10)}T00:00:00Z`))/DAY);
function mode(values:number[]){const count=new Map<number,number>();for(const value of values)count.set(value,(count.get(value)||0)+1);return[...count].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??null;}
function destination(text:string|null){return text?['Nhật Bản','Hàn Quốc','Đài Loan','Trung Quốc','Thái Lan','Singapore','Úc','Mỹ','Châu Âu','Việt Nam'].find(x=>text.toLocaleLowerCase('vi').includes(x.toLocaleLowerCase('vi')))??null:null;}

export function createScoringService(pool:Pool){
  return{
    async recompute(settings:Settings,now=new Date(),includeDemo=false){
      const demoPredicate=includeDemo?'c.is_demo=true':'c.is_demo=false';
      const [result,popularResult]=await Promise.all([
        pool.query<Fact>(`SELECT c.customer_id::text,c.email_primary,c.phone_primary,c.source_name,c.sale_id::text,c.sale_name,
          COALESCE(lc.n,0)::int lead_count,COALESCE(o.n,0)::int completed_count,o.last_trip,o.last_order_at,COALESCE(o.spend,0)::text total_spend,o.trip_dates,o.trip_months,o.destinations,
          l.status_title lead_status,l.status_code,l.quote_status,l.service lead_service,l.source_name lead_source,l.updated_at lead_updated_at,
          a.last_activity,m.opened_at,m.clicked_at,lq.quote_count,lq.quote_statuses,lq.latest_quote_at,
          act.source_type,act.source_label,act.action_source,act.is_internal AS activity_internal
          FROM customers c
          LEFT JOIN LATERAL(SELECT count(*) FILTER(WHERE status_title IN ('Thành công','Hoàn tất')) n,max(departure) FILTER(WHERE status_title IN ('Thành công','Hoàn tất'))::text last_trip,
            max(order_at) FILTER(WHERE status_title IN ('Thành công','Hoàn tất')) last_order_at,
            COALESCE(sum(COALESCE(total,total_amount)) FILTER(WHERE status_title IN ('Thành công','Hoàn tất')),0) spend,
            array_agg(departure::text ORDER BY departure) FILTER(WHERE status_title IN ('Thành công','Hoàn tất') AND departure IS NOT NULL) trip_dates,
            array_agg(extract(month FROM departure)::int ORDER BY departure) FILTER(WHERE status_title IN ('Thành công','Hoàn tất') AND departure IS NOT NULL) trip_months,
            array_agg(destination ORDER BY departure) FILTER(WHERE status_title IN ('Thành công','Hoàn tất') AND departure IS NOT NULL AND destination IS NOT NULL AND destination<>'Khác') destinations
            FROM orders WHERE customer_id=c.customer_id)o ON true
          LEFT JOIN LATERAL(SELECT count(*) n FROM leads WHERE customer_id=c.customer_id) lc ON true
          LEFT JOIN LATERAL(SELECT status_title,status_code,quote_status,service,source_name,COALESCE(updated_at,created_at) updated_at FROM leads WHERE customer_id=c.customer_id ORDER BY COALESCE(updated_at,created_at) DESC,id DESC LIMIT 1) l ON true
          LEFT JOIN LATERAL(SELECT max(COALESCE(at,created_at)) last_activity FROM activities WHERE customer_id=c.customer_id)a ON true
          LEFT JOIN LATERAL(SELECT count(*)::int quote_count,array_agg(DISTINCT item.value->>'status') FILTER(WHERE item.value->>'status' IS NOT NULL) quote_statuses,max(COALESCE(l2.updated_at,l2.created_at)) latest_quote_at FROM leads l2 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(l2.quotes_source)='array' THEN l2.quotes_source ELSE '[]'::jsonb END) AS item(value) WHERE l2.customer_id=c.customer_id)lq ON true
          LEFT JOIN LATERAL(SELECT source_type,source_label,action_source,is_internal FROM activities WHERE customer_id=c.customer_id ORDER BY COALESCE(at,created_at) DESC,id DESC LIMIT 1)act ON true
          LEFT JOIN LATERAL(SELECT max(opened_at) opened_at,max(clicked_at) clicked_at FROM messages WHERE customer_id=c.customer_id)m ON true
          WHERE ${demoPredicate} AND (COALESCE(o.n,0)>0 OR COALESCE(lc.n,0)>0 OR a.last_activity IS NOT NULL OR m.opened_at IS NOT NULL OR m.clicked_at IS NOT NULL)`),
        pool.query<{destination:string}>(`SELECT destination FROM orders WHERE status_title IN ('Thành công','Hoàn tất') AND destination IS NOT NULL AND destination<>'Khác' AND is_demo=$1 GROUP BY destination ORDER BY count(*) DESC,destination LIMIT 30`,[includeDemo]),
      ]);
      const facts=result.rows,popular=popularResult.rows.map(x=>x.destination),buyers=facts.filter(x=>x.completed_count>0).sort((a,b)=>Number(a.total_spend)-Number(b.total_spend));
      const money=new Map<string,number>();buyers.forEach((x,i)=>money.set(x.customer_id,Math.min(5,Math.ceil((i+1)/buyers.length*5))));
      const transitions=new Map<string,Map<string,number>>();
      for(const fact of buyers){const ds=fact.destinations??[];for(let i=1;i<ds.length;i++){if(ds[i]===ds[i-1])continue;const map=transitions.get(ds[i-1])??new Map<string,number>();map.set(ds[i],(map.get(ds[i])||0)+1);transitions.set(ds[i-1],map);}}
      const scores=facts.map(f=>calculate(f,money.get(f.customer_id)??1,popular,transitions,settings.weights as Weights,now));
      const db=await pool.connect();let changed=0;
      try{await db.query('BEGIN');for(const s of scores){
        const old=await db.query<{segment_code:string}>('SELECT segment_code FROM customer_insights WHERE customer_id=$1 FOR UPDATE',[s.id]);
        await db.query(`INSERT INTO care_scores(customer_id,kind,segment,r,f,m,total_spend,last_trip,lead_score,propensity,next_destination,best_month,churn_risk,visited,reasons,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,now()) ON CONFLICT(customer_id) DO UPDATE SET
          kind=EXCLUDED.kind,segment=EXCLUDED.segment,r=EXCLUDED.r,f=EXCLUDED.f,m=EXCLUDED.m,total_spend=EXCLUDED.total_spend,last_trip=EXCLUDED.last_trip,
          lead_score=EXCLUDED.lead_score,propensity=EXCLUDED.propensity,next_destination=EXCLUDED.next_destination,best_month=EXCLUDED.best_month,
          churn_risk=EXCLUDED.churn_risk,visited=EXCLUDED.visited,reasons=EXCLUDED.reasons,updated_at=now()`,[s.id,s.kind==='prospect'?'lead':'buyer',s.segment,s.r,s.f,s.m,s.spend,s.lastTrip,s.leadScore,s.propensity,s.next,s.month,s.churn,JSON.stringify(s.visited),JSON.stringify(s.reasons)]);
        const storedSegment=s.kind==='prospect'?`prospect_${s.segment}`:s.segment,potentialTier=s.kind==='prospect'?s.segment:null;
        await db.query(`INSERT INTO customer_insights(customer_id,customer_kind,r_score,f_score,m_score,potential_score,potential_tier,segment_code,score_reasons,predicted_purchase,predicted_purchase_score,suggested_destination,preferred_travel_month,churn_risk,prediction_method,is_demo,calculated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,'transparent_rules_v1',$15,now()) ON CONFLICT(customer_id) DO UPDATE SET
          customer_kind=EXCLUDED.customer_kind,r_score=EXCLUDED.r_score,f_score=EXCLUDED.f_score,m_score=EXCLUDED.m_score,potential_score=EXCLUDED.potential_score,
          potential_tier=EXCLUDED.potential_tier,segment_code=EXCLUDED.segment_code,score_reasons=EXCLUDED.score_reasons,predicted_purchase=EXCLUDED.predicted_purchase,
          predicted_purchase_score=EXCLUDED.predicted_purchase_score,suggested_destination=EXCLUDED.suggested_destination,preferred_travel_month=EXCLUDED.preferred_travel_month,
          churn_risk=EXCLUDED.churn_risk,prediction_method=EXCLUDED.prediction_method,is_demo=EXCLUDED.is_demo,calculated_at=now()`,[s.id,s.kind,s.r,s.f,s.m,s.leadScore,potentialTier,storedSegment,JSON.stringify(s.reasons),s.propensity,s.prediction,s.next,s.month,s.churn,includeDemo]);
        if(old.rows[0]&&old.rows[0].segment_code!==storedSegment){changed++;await db.query('INSERT INTO care_segment_history(customer_id,from_segment,to_segment) VALUES($1,$2,$3)',[s.id,old.rows[0].segment_code,storedSegment]);}
      }await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
      const bySegment:Record<string,number>={};for(const s of scores)bySegment[s.segment]=(bySegment[s.segment]||0)+1;
      return{scored:scores.length,changed,bySegment,method:'transparent_rules_v1'};
    },
  };
}

function calculate(x:Fact,m:number,popular:string[],transitions:Map<string,Map<string,number>>,w:Weights,now:Date):Score{
  const reasons:string[]=[],past=(x.trip_dates??[]).map(d=>d.slice(0,10)).filter(d=>Date.parse(`${d}T00:00:00Z`)<=now.getTime()),visited=[...new Set(x.destinations??[])];
  const lastDest=visited.at(-1),next=[destination(x.lead_service),...(transitions.get(lastDest??'')?[...transitions.get(lastDest??'')!].sort((a,b)=>b[1]-a[1]).map(a=>a[0]):[]),...popular].find(d=>!!d&&(!visited.includes(d)||d===destination(x.lead_service)))??null;
  const lastTripDate=x.last_trip?new Date(`${x.last_trip.slice(0,10)}T00:00:00Z`):x.last_order_at;
  const elapsed=age(lastTripDate,now),spend=Number(x.total_spend)||0;let kind:Score['kind'],r:number|null=null,f:number|null=null,leadScore:number|null=null,month:number|null=null,churn:Score['churn']='insufficient_history',segment:string,prediction:number;
  if(x.completed_count>0){kind='buyer';r=elapsed<=90?5:elapsed<=180?4:elapsed<=365?3:elapsed<=730?2:1;f=x.completed_count===1?1:x.completed_count===2?3:x.completed_count===3?4:5;
    reasons.push(`R=${r} (${elapsed} ngày từ chuyến đi gần nhất)`,`F=${f} (${x.completed_count} đơn thành công)`,`M=${m} (phân vị chi tiêu)`);
    if(r===1)segment='dormant';else if(m===5&&(f>=3||r>=4))segment='vip';else if(f>=2&&r>=3)segment='loyal';else if(f===1&&r>=4)segment='new';else if(f>=2&&r<=2)segment='at_risk';else segment='one_time';
    month=mode(x.trip_months??[]);const trips=past.sort();if(trips.length>=2){const gaps=trips.slice(1).map((d,i)=>diffDays(trips[i],d)).sort((a,b)=>a-b),mid=Math.floor(gaps.length/2),avg=gaps.length%2?gaps[mid]:Math.round((gaps[mid-1]+gaps[mid])/2);churn=elapsed>avg*1.5?'high':elapsed>avg?'medium':'low';reasons.push(`Khoảng cách giữa các chuyến trung vị ${avg} ngày`);}else{churn='insufficient_history';reasons.push('Chưa đủ hai chuyến thành công để ước tính nguy cơ rời bỏ.');}
    let p=(r===5?30:r===4?20:r===3?10:0)+(f>=4?20:f===3?10:0);if(month){const ahead=(month-(now.getUTCMonth()+1)+12)%12;if(ahead>=1&&ahead<=4){p+=20;reasons.push(`Sắp tới tháng thường đi ${month}`);}}if(churn==='high')p-=20;prediction=Math.max(0,Math.min(100,p));
  }else{kind='prospect';let p=0;const add=(n:number,why:string)=>{if(n){p+=n;reasons.push(`${n>0?'+':''}${n} ${why}`);}};
    if(x.status_code===3||x.lead_status==='Đang xử lý')add(w.status_processing,'lead đang được tư vấn');else if(x.status_code===0||x.lead_status==='Chưa tiếp nhận')add(w.status_new,'lead mới chưa tiếp nhận');else if(x.status_code===2||x.lead_status==='Đã hủy')add(w.status_cancelled,'lead đã hủy');
    if(x.quote_count>0){add(w.has_quote,`có ${x.quote_count} báo giá trong dữ liệu CRM`);if((x.quote_statuses||[]).some(status=>/tính giá xong/i.test(status)))add(w.quote_done,'trạng thái báo giá nguồn là Đã tính giá xong');}
    const lastTouch=x.activity_internal===false?x.last_activity:null;
    const idle=age(lastTouch,now);if(lastTouch&&idle<=14)add(w.touch_14d,`hoạt động CRM không nội bộ cách ${idle} ngày`);else if(lastTouch&&idle<=30)add(w.touch_30d,`hoạt động CRM không nội bộ cách ${idle} ngày`);else if(lastTouch&&idle>90)add(w.idle_90d,`hoạt động CRM gần nhất cách ${idle} ngày`);
    const source=(x.lead_source||x.source_name||'').toLocaleLowerCase('vi');if(/giới thiệu|khách cũ/.test(source))add(w.source_referral,'nguồn lead CRM được nhận diện là giới thiệu');else if(/facebook|google|quảng cáo|ads/.test(source))add(w.source_ads,'nguồn lead CRM được nhận diện là quảng cáo');if(x.opened_at&&age(x.opened_at,now)<=30)add(w.opened_30d,'mở email Care trong 30 ngày');if(x.clicked_at&&age(x.clicked_at,now)<=30)add(w.clicked_30d,'bấm email Care trong 30 ngày');
    leadScore=Math.max(0,Math.min(100,p));segment=leadScore>=70?'hot':leadScore>=40?'warm':'cold';prediction=leadScore;
  }
  if(x.completed_count===0){if(x.activity_internal===true)reasons.push('Hoạt động gần nhất được CRM đánh dấu nội bộ; không tính là khách đã tương tác');if(x.source_type)reasons.push(`Loại nguồn hoạt động CRM: ${x.source_type}`);if(x.source_label)reasons.push(`Nhãn nguồn hoạt động CRM: ${x.source_label}`);if(x.action_source)reasons.push(`Hành động activity CRM: ${x.action_source}`);if(x.lead_count>0&&!x.lead_source&&!x.source_name)reasons.push('Raw không ghi nguồn lead; không cộng/trừ điểm theo nguồn');if(x.lead_count>0&&x.quote_count===0)reasons.push('Chưa thấy báo giá được lưu trong dữ liệu; không cộng điểm báo giá');if(x.lead_count>0&&!x.last_activity)reasons.push('Chưa có hoạt động liên kết để xác định lần chăm sóc khách gần nhất');}
  if(next)reasons.push(`Điểm đến gợi ý ${next} theo lịch sử/nhu cầu lead`);if(month)reasons.push(`Tháng thường đi: ${month}`);
  return{id:Number(x.customer_id),kind,r,f,m:x.completed_count>0?m:null,spend,lastTrip:x.last_trip,leadScore,propensity:prediction>=70?'high':prediction>=40?'medium':'low',next,month,churn,visited,reasons,segment,prediction};
}
