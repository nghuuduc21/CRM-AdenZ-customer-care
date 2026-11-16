import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { createCampaignRepository } from './campaign.repository.js';
import { createSettingsService } from '../settings/settings.service.js';

const canManage = (user: CareUser) => ['admin','boss','marketing'].includes(user.role);
const idOf = (value: unknown) => { const id=Number(value); if(!Number.isSafeInteger(id)||id<1) throw new Error('Mã chiến dịch không hợp lệ.'); return id; };

export function createCampaignRouter(pool: Pool) {
  const router=Router(), repository=createCampaignRepository(pool), settings=createSettingsService(pool);
  router.get('/campaigns',async(_request,response)=>{try{response.json(await repository.list());}catch{response.status(500).json({error:'Không thể tải chiến dịch.'});}});
  router.get('/campaigns/:id',async(request,response)=>{try{const data=await repository.get(idOf(request.params.id));if(!data){response.status(404).json({error:'Không tìm thấy chiến dịch.'});return;}response.json(data);}catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể tải chiến dịch.'});}});
  router.post('/campaigns',async(request,response)=>save(request,response));
  router.put('/campaigns/:id',async(request,response)=>save(request,response,idOf(request.params.id)));
  router.delete('/campaigns/:id',async(request,response)=>{
    const user=response.locals.user as CareUser;
    if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được xóa chiến dịch.'});return;}
    const id=idOf(request.params.id),client=await pool.connect();
    try{
      await client.query('BEGIN');
      const removed=await client.query("DELETE FROM campaigns c WHERE c.id=$1 AND c.is_demo=true AND c.status IN ('draft','approved') AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.campaign_id=c.id) RETURNING c.id",[id]);
      if(!removed.rowCount){
        const found=await client.query('SELECT status FROM campaigns WHERE id=$1 AND is_demo=true',[id]);
        await client.query('ROLLBACK');
        if(!found.rowCount){response.status(404).json({error:'Không tìm thấy chiến dịch demo.'});return;}
        response.status(409).json({error:'Chỉ xóa được chiến dịch đang soạn/đã duyệt và chưa có lịch sử gửi.'});return;
      }
      await client.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'campaign.delete\',$2::jsonb)',[user.username,JSON.stringify({id})]);
      await client.query('COMMIT');
      response.json({ok:true});
    }catch(error){await client.query('ROLLBACK');response.status(400).json({error:error instanceof Error?error.message:'Không thể xóa chiến dịch.'});}
    finally{client.release();}
  });
  router.post('/audience/preview',async(request,response)=>{
    try{const rows=await repository.recipients(request.body||{}),excluded=rows.filter((row)=>row.opted_out||row.recent_marketing);
      response.json({count:rows.length-excluded.length,excluded:excluded.length,reasons:{'Đã từ chối nhận email':excluded.filter((row)=>row.opted_out).length,'Đã nhận quảng cáo trong 7 ngày':excluded.filter((row)=>!row.opted_out&&row.recent_marketing).length}});
    }catch{response.status(400).json({error:'Không thể tính nhóm người nhận.'});}
  });
  router.post('/audience/recipients',async(request,response)=>{
    const user=response.locals.user as CareUser;
    if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được xem danh sách email chiến dịch.'});return;}
    try{
      const rows=await repository.recipients(request.body||{},{includeNoEmail:true});
      response.json(rows.map((row)=>({id:row.id,name:row.name,email:row.email,segment:row.segment,eligible:Boolean(row.email)&&!row.opted_out&&!row.recent_marketing,
        reason:!row.email?'Chưa có email':row.opted_out?'Đã từ chối nhận email':row.recent_marketing?'Đã nhận quảng cáo trong 7 ngày qua':''})));
    }catch{response.status(400).json({error:'Không thể tải danh sách email khách hàng.'});}
  });
  router.post('/campaigns/preview',async(request,response)=>{
    try{
      const input=request.body||{},rows=await repository.recipients(input.audience||{}),allowed=rows.filter((row)=>!row.opted_out&&!row.recent_marketing);
      const customer=allowed.find((row)=>Number(row.id)===Number(input.customerId))||allowed[0]||{id:null,name:'Quý khách',email:'',segment:null,next_destination:null,sale_name:''},config=await settings.load();
      const productIds=Array.isArray(input.productIds)?input.productIds.map(Number).filter((id:number)=>Number.isSafeInteger(id)&&id>0):[];
      const products=productIds.length?await pool.query(`SELECT name,type,destination,duration,price,url,market FROM products WHERE id=ANY($1::bigint[]) AND active=true AND is_demo=true ORDER BY name`,[productIds]):{rows:[]};
      const serviceIds=Array.isArray(input.serviceIds)?input.serviceIds.map(String):[];
      const services=(config.services||[]).filter((service:any)=>serviceIds.includes(service.id));
      const productCards=products.rows.map((item:any)=>emailCard(
        String(item.destination||marketLabel(item.market)||item.type||'Tour demo'),String(item.name||'Sản phẩm demo'),
        [item.duration,Number(item.price)>0?`từ ${Number(item.price).toLocaleString('vi-VN')} đ`:null].filter(Boolean).join(' · '),item.url,'Xem chi tiết',
      )).join('');
      const serviceCards=services.map((item:any)=>emailCard('Dịch vụ demo',String(item.name||''),String(item.desc||''),item.url,'Khám phá dịch vụ')).join('');
      const productToken='__DEMO_PRODUCT_CARDS_8F42__',serviceToken='__DEMO_SERVICE_CARDS_9C31__';
      let bodyTemplate=String(input.body||'');
      if(products.rows.length&&!bodyTemplate.includes('{{san_pham}}'))bodyTemplate+=`${bodyTemplate.trim()?'\n\n':''}{{san_pham}}`;
      if(services.length&&!bodyTemplate.includes('{{dich_vu}}'))bodyTemplate+=`${bodyTemplate.trim()?'\n\n':''}{{dich_vu}}`;
      const content={san_pham:products.rows.length?productToken:'Chưa chọn sản phẩm CRM.',dich_vu:services.length?serviceToken:'Chưa chọn dịch vụ Nhóm demo.'};
      const subject=render(String(input.subject||''),customer,config),body=render(bodyTemplate,customer,config,content);
      const previewRecipients=allowed.slice(0,200);
      if(!previewRecipients.some((row)=>Number(row.id)===Number(customer.id)))previewRecipients.push(customer);
      const recipientLabel=customer.email?`${escapeHtml(customer.name)} · ${escapeHtml(customer.email)}`:escapeHtml(customer.name);
      const previewBody=body.trim()?body.split(productToken).map(part=>part.split(serviceToken).map(escapeHtml).join(serviceCards)).join(productCards):'<span class="muted">Nội dung email sẽ hiển thị tại đây.</span>';
      response.json({subject,customer,recipients:previewRecipients,html:`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
        *{box-sizing:border-box}body{margin:0;padding:8px;background:#f6f8f5;color:#1b221d;font:14px/1.55 Arial,sans-serif}.mail{max-width:680px;margin:0 auto;border:1px solid #e2e7e1;border-radius:10px;overflow:hidden;background:#fff}.mhead{padding:10px 14px;background:#fbfcfa;border-bottom:1px solid #e2e7e1;color:#6c776e;font-size:12px}.mhead b{color:#1b221d;font-weight:600}.mbody{padding-bottom:18px}.mbrand{height:6px;background:#4db848}.mlogo{padding:16px 20px 6px}.mlogo img{display:block;width:auto;height:24px;max-width:180px;object-fit:contain}.mtext{padding:10px 20px 18px;overflow-wrap:anywhere;line-height:1.7;white-space:pre-wrap}.product{width:100%;margin:10px 0;border:1px solid #e2e7e1;border-radius:10px;background:#fff}.eyebrow{color:#2f7d2a;font-size:13px;font-weight:700;text-transform:uppercase}.pname{font-size:18px;font-weight:700;line-height:1.35}.pdetail{margin-top:3px;color:#6c776e}.pbutton{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:7px;background:#2f7d2a;color:#fff;text-decoration:none;font-weight:600}.muted{color:#89938a}.mfoot{margin:0 20px;padding:12px 0 0;border-top:1px solid #e2e7e1;color:#6c776e;font-size:12px}
        </style></head><body><div class="mail"><div class="mhead">Tới: <b>${recipientLabel}</b></div><div class="mhead">Tiêu đề: <b>${escapeHtml(subject||'(chưa có tiêu đề)')}</b></div><div class="mbody"><div class="mbrand"></div><div class="mlogo"><b>Care Lab</b></div><div class="mtext">${previewBody}</div><div class="mfoot">Customer Care Demo · Đây là bản xem trước nội dung email.</div></div></div></body></html>`});
    }catch{response.status(400).json({error:'Không thể xem trước chiến dịch.'});}
  });
  router.post('/campaigns/:id/approve',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!['admin','boss'].includes(user.role)){response.status(403).json({error:'Chỉ Quản trị hoặc Sếp được duyệt chiến dịch.'});return;}
    try{const id=idOf(request.params.id),result=await pool.query("UPDATE campaigns SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1 AND status='draft' AND is_demo=true RETURNING id",[id,user.username]);if(!result.rowCount){response.status(409).json({error:'Chỉ chiến dịch demo đang soạn mới được duyệt.'});return;}await audit(pool,user.username,'campaign.approve',{id});response.json({ok:true});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể duyệt chiến dịch.'});}
  });
  router.post('/campaigns/:id/duplicate',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được nhân bản chiến dịch.'});return;}
    try{const old=await pool.query('SELECT * FROM campaigns WHERE id=$1 AND is_demo=true',[idOf(request.params.id)]);if(!old.rows[0]){response.status(404).json({error:'Không tìm thấy chiến dịch demo.'});return;}const c=old.rows[0];const result=await pool.query(`INSERT INTO campaigns(name,goal,status,subject,audience,channel,body,product_ids,service_ids,recommend,created_by,is_demo)
      VALUES($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING id`,[`${c.name} (bản sao)`,c.goal,c.subject,c.audience,c.channel,c.body,c.product_ids,c.service_ids,c.recommend,user.username]);response.json({id:Number(result.rows[0].id)});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể nhân bản chiến dịch.'});}
  });
  router.post('/campaigns/:id/cancel',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được dừng chiến dịch.'});return;}
    const result=await pool.query("UPDATE campaigns SET status='cancelled' WHERE id=$1 AND is_demo=true AND status IN ('approved','sending') RETURNING id",[Number(request.params.id)]);
    if(!result.rowCount){response.status(409).json({error:'Chiến dịch không ở trạng thái có thể dừng.'});return;}await audit(pool,user.username,'campaign.cancel',{id:Number(request.params.id)});response.json({ok:true});
  });
  router.post('/campaigns/:id/send',async(request,response)=>{
    const user=response.locals.user as CareUser;
    if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được gửi chiến dịch.'});return;}
    const id=idOf(request.params.id);
    try{
      const found=await pool.query('SELECT status,audience,subject FROM campaigns WHERE id=$1 AND is_demo=true',[id]);
      if(!found.rows[0]){response.status(404).json({error:'Không tìm thấy chiến dịch.'});return;}
      if(found.rows[0].status!=='approved'){response.status(409).json({error:'Chiến dịch cần được duyệt trước khi gửi.'});return;}
      const audience=await repository.recipients(found.rows[0].audience||{});
      const eligible=audience.filter((row)=>!row.opted_out&&!row.recent_marketing&&row.email);
      const seen=new Set<string>(),recipients=eligible.filter((row)=>{const email=String(row.email).trim().toLowerCase();if(seen.has(email))return false;seen.add(email);return true;});
      if(!recipients.length){response.status(400).json({error:'Không có email nào đủ điều kiện gửi.'});return;}
      const demoCheck=await pool.query<{demo_only:boolean}>(`SELECT COALESCE(bool_and(is_demo),false) AS demo_only FROM customers WHERE customer_id=ANY($1::bigint[])`,[recipients.map((row)=>row.id)]);
      if(!demoCheck.rows[0]?.demo_only){response.status(503).json({error:'Chưa cấu hình bộ gửi email. Chiến dịch dữ liệu thật chưa được đưa vào hàng đợi và không có email nào được gửi.'});return;}
      const config=await settings.load(),client=await pool.connect();
      try{
        await client.query('BEGIN');
        const locked=await client.query('SELECT status,subject FROM campaigns WHERE id=$1 AND is_demo=true FOR UPDATE',[id]);
        if(locked.rows[0]?.status!=='approved')throw new Error('Chiến dịch đã được gửi hoặc thay đổi trạng thái.');
        for(const customer of recipients){
          const subject=render(String(locked.rows[0].subject||''),customer,config);
          await client.query(`INSERT INTO messages(campaign_id,customer_id,journey,subject,to_addr,marketing,status,created_at,sent_at,is_demo)
            VALUES($1,$2,'campaign',$3,$4,true,'sent',now(),now(),true)`,[id,customer.id,subject,customer.email]);
        }
        await client.query("UPDATE campaigns SET status='done',sent_at=now() WHERE id=$1",[id]);
        await client.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'campaign.simulate\',$2::jsonb)',[user.username,JSON.stringify({id,recipients:recipients.length})]);
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      response.json({queued:0,sentNow:recipients.length,waiting:0,simulated:true});
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể gửi chiến dịch.'});}
  });
  router.post('/campaigns/:id/test',(_request,response)=>response.status(503).json({error:'Chưa cấu hình email thử. Không có email nào được gửi.'}));
  return router;

  async function save(request:any,response:any,id?:number){
    const user=response.locals.user as CareUser;if(!canManage(user)){response.status(403).json({error:'Vai trò hiện tại không được sửa chiến dịch.'});return;}
    try{const saved=await repository.save(request.body||{},user.username,id);await audit(pool,user.username,id?'campaign.update':'campaign.create',{id:saved});response.json({id:saved});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu chiến dịch.'});}
  }
}
async function audit(pool:Pool,actor:string,action:string,detail:unknown){await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,$2,$3::jsonb)',[actor,action,JSON.stringify(detail)]);}
function render(value:string,customer:any,settings:any,extra:Record<string,string>={}){const replacements:Record<string,string>={ten:customer.name||'',sale:customer.sale_name||'',diem_den_goi_y:customer.next_destination||'',uu_dai:'',chinh_sach:settings.flow.commissionText||'',diem_den_da_di:'',diem_den_ky_niem:customer.next_destination||'',link_danh_gia:settings.flow.reviewUrl||'',...extra};return value.replace(/\{\{([\w]+)\}\}/g,(_match,key)=>replacements[key]??'');}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function webUrl(value:unknown):string|null{if(typeof value!=='string'||!value.trim())return null;try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)?url.toString():null;}catch{return null;}}
function marketLabel(value:unknown):string|null{return ({domestic:'Nội địa',outbound:'Outbound',inbound:'Inbound'} as Record<string,string>)[String(value||'').toLowerCase()]||null;}
function emailCard(category:string,title:string,detail:string,url:unknown,buttonLabel:string){
  const href=webUrl(url);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:10px 0;border:1px solid #e2e7e1;border-radius:10px;background:#ffffff"><tr><td style="padding:14px 18px;font-family:Arial,sans-serif"><div style="color:#2f7d2a;font-size:13px;font-weight:700;text-transform:uppercase">${escapeHtml(category)}</div><div style="color:#1b221d;font-size:18px;font-weight:700;line-height:1.35">${escapeHtml(title)}</div>${detail?`<div style="margin-top:3px;color:#6c776e;font-size:14px">${escapeHtml(detail)}</div>`:''}${href?`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;padding:8px 16px;border-radius:7px;background:#2f7d2a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(buttonLabel)}</a>`:'<div style="margin-top:8px;color:#6c776e;font-size:13px">Liên kết chi tiết chưa được cung cấp.</div>'}</td></tr></table>`;
}
