import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { createSettingsService } from '../settings/settings.service.js';
import { createScoringService } from './scoring.service.js';

export function createScoringRouter(pool:Pool){
  const router=Router(),settings=createSettingsService(pool),scoring=createScoringService(pool);
  router.post('/scoring/recompute',async(_request,response)=>{
    const user=response.locals.user as CareUser;
    if(!['admin','boss','marketing'].includes(user.role)){response.status(403).json({error:'Vai trò hiện tại không được chấm điểm khách hàng.'});return;}
    try{const result=await scoring.recompute(await settings.load());await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'scoring.recompute\',$2::jsonb)',[user.username,JSON.stringify(result)]);response.json(result);}
    catch{response.status(500).json({error:'Không thể chấm điểm. Kiểm tra migration PostgreSQL và schema đơn hàng/lead.'});}
  });
  return router;
}
