import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { createCareTaskRepository } from './care-task.repository.js';

export function createCareTaskRouter(pool: Pool) {
  const router=Router();
  const repository=createCareTaskRepository(pool);
  const userOf=(value:unknown)=>value as CareUser;

  router.get('/today',async(request,response)=>{
    try{
      const user=userOf(response.locals.user);
      const view=String(request.query.view||(user.role==='sale'?'mine':'all'));
      response.json(await repository.today(user,view,new Date()));
    }catch{response.status(500).json({error:'Không thể tải danh sách việc cần chăm sóc.'});}
  });

  router.get('/monitor',async(request,response)=>{
    const days=Math.min(90,Math.max(1,Number(request.query.days)||7));
    try{response.json(await repository.monitor(days,new Date()));}
    catch{response.status(500).json({error:'Không thể tải theo dõi chăm sóc.'});}
  });

  router.get('/kpi',async(request,response)=>{
    const days=Math.min(365,Math.max(1,Number(request.query.days)||7));
    try{
      const monitor=await repository.monitor(days,new Date());
      response.json(monitor.kpi);
    }catch{response.status(500).json({error:'Không thể tải báo cáo chăm sóc.'});}
  });

  router.get('/tasks',async(_request,response)=>{
    try{
      const result=await pool.query(`SELECT t.*,COALESCE(t.kind,t.task_kind) AS kind,t.due AS due_old,
        c.name,c.phone_primary AS phone,c.email_primary AS email,COALESCE(c.member_tier,c.tier) AS tier
        FROM care_tasks t LEFT JOIN customers c ON c.customer_id=t.customer_id
        ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,COALESCE(t.due,t.due_at,t.created_at) LIMIT 500`);
      response.json(result.rows.map(row=>({...row,due:row.due??row.due_at})));
    }catch{response.status(500).json({error:'Không thể tải danh sách công việc.'});}
  });

  router.post('/tasks/:id/outcome',async(request,response)=>{
    const id=Number(request.params.id),user=userOf(response.locals.user);
    if(!Number.isSafeInteger(id)||id<1){response.status(400).json({error:'Mã công việc không hợp lệ.'});return;}
    try{
      const task=await repository.task(id);
      if(!task){response.status(404).json({error:'Không tìm thấy việc.'});return;}
      if(user.role==='sale'&&Number(task.sale_id)!==user.saleId){response.status(403).json({error:'Việc này được giao cho nhân viên khác.'});return;}
      await repository.updateOutcome(id,request.body||{},user.username);
      response.json({ok:true});
    }catch(error){
      const status=typeof error==='object'&&error!==null&&'status' in error?Number((error as {status:number}).status):400;
      response.status(status).json({error:error instanceof Error?error.message:'Không thể cập nhật công việc.'});
    }
  });

  router.post('/kpi/send',(_request,response)=>response.json({emails:0,simulated:true,reason:'Gửi email báo cáo chưa được cấu hình.'}));
  router.post('/digest/send',(_request,response)=>response.json({emails:0,simulated:true,reason:'Gửi email nội bộ chưa được cấu hình.'}));
  router.post('/tasks/:id/done',async(request,response)=>{
    const id=Number(request.params.id),user=userOf(response.locals.user);
    if(!Number.isSafeInteger(id)||id<1){response.status(400).json({error:'Mã công việc không hợp lệ.'});return;}
    try{
      const task=await repository.task(id);if(!task){response.status(404).json({error:'Không tìm thấy việc.'});return;}
      if(user.role==='sale'&&Number(task.sale_id)!==user.saleId){response.status(403).json({error:'Việc này được giao cho nhân viên khác.'});return;}
      const undo=request.body?.undo===true;
      if(undo)await pool.query("UPDATE care_tasks SET status='open',done_at=NULL,completed_at=NULL,done_by=NULL WHERE id=$1",[id]);
      else await repository.updateOutcome(id,{outcome:'Đã xử lý xong'},user.username);
      response.json({ok:true});
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể cập nhật công việc.'});}
  });
  router.post('/queue/process',(_request,response)=>response.status(503).json({error:'Hàng đợi chưa được phép gửi: cấu hình SMTP và chế độ gửi thử chưa hoàn tất.'}));
  router.get('/messages',async(_request,response)=>{
    try{const result=await pool.query(`SELECT m.id,m.campaign_id,m.journey,m.to_addr,m.subject,m.status,m.reason,m.error,m.created_at,m.sent_at,m.opened_at,m.clicked_at,c.name
      FROM messages m LEFT JOIN customers c ON c.customer_id=m.customer_id ORDER BY m.id DESC LIMIT 300`);response.json(result.rows);}
    catch{response.status(500).json({error:'Không thể tải lịch sử gửi.'});}
  });
  router.get('/audit',async(_request,response)=>{
    try{const result=await pool.query(`SELECT id,occurred_at AS at,actor AS by,action,detail FROM care_audit ORDER BY id DESC LIMIT 300`);response.json(result.rows);}
    catch{response.status(500).json({error:'Không thể tải nhật ký thao tác.'});}
  });
  return router;
}
