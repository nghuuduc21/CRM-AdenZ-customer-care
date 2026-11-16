import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { createCustomerService } from './customer.service.js';

const idFrom = (value: string): number | null => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createCustomerRouter(pool: Pool) {
  const router = Router();
  const service = createCustomerService(pool);

  router.get('/customers', async (request, response) => {
    try {
      const rows = await service.list({
        query: typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : undefined,
        segment: typeof request.query.segment === 'string' ? request.query.segment : undefined,
        propensity: typeof request.query.propensity === 'string' ? request.query.propensity : undefined,
        destination: typeof request.query.dest === 'string' ? request.query.dest : undefined,
        service: typeof request.query.service === 'string' ? request.query.service : undefined,
        tier: typeof request.query.tier === 'string' ? request.query.tier : undefined,
        partner: request.query.partner === '1',
      });
      response.json(rows);
    } catch {
      response.status(500).json({ error: 'Không thể tải danh sách khách hàng.' });
    }
  });

  router.get('/customers/:id', async (request, response) => {
    const id = idFrom(request.params.id);
    if (id === null) {
      response.status(400).json({ error: 'Mã khách hàng không hợp lệ.' });
      return;
    }
    try {
      const profile = await service.getProfile(id);
      if (!profile) {
        response.status(404).json({ error: 'Không tìm thấy khách hàng.' });
        return;
      }
      response.json(profile);
    } catch {
      response.status(500).json({ error: 'Không thể tải hồ sơ khách hàng.' });
    }
  });

  router.post('/customers/:id/optout', async (request,response)=>{
    const id=idFrom(request.params.id),user=response.locals.user as CareUser;
    if(id===null){response.status(400).json({error:'Mã khách hàng không hợp lệ.'});return;}
    if(user.role==='sale'){response.status(403).json({error:'Tài khoản sale không có quyền đổi trạng thái nhận tin.'});return;}
    try{await service.setEmailOptOut(id,request.body?.optOut===true,user.username);response.json({ok:true});}
    catch(error){const status=typeof error==='object'&&error!==null&&'status' in error?Number((error as {status:number}).status):400;response.status(status).json({error:error instanceof Error?error.message:'Không thể cập nhật trạng thái nhận tin.'});}
  });

  return router;
}
