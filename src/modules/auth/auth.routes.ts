import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from './auth.types.js';
import { createAuthService } from './auth.service.js';

const cookieName = 'csid';
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure,
  maxAge: 12 * 60 * 60_000,
  path: '/',
});

function readCookie(request: Request, name: string): string | undefined {
  const prefix = `${name}=`;
  const value = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function sendError(response: Response, error: unknown, status = 400): void {
  const message = error instanceof Error ? error.message : 'Yêu cầu chưa thể xử lý.';
  response.status(status).json({ error: message });
}

export function createAuthRouter(pool: Pool, secret: Buffer, secureCookie: boolean) {
  const router = Router();
  const auth = createAuthService(pool, secret);

  router.get('/session', async (_request, response) => {
    const username = auth.readSession(readCookie(_request, cookieName));
    const user = username ? await auth.findUser(username) : null;
    response.json({ user, needsSetup: await auth.needsSetup() });
  });

  router.post('/setup', async (request, response) => {
    if (!localAddresses.has(request.socket.remoteAddress || '') || request.get('x-forwarded-for')) {
      response.status(403).json({ error: 'Tạo tài khoản đầu tiên cần thực hiện trực tiếp trên máy chủ.' });
      return;
    }
    try {
      const user = await auth.createFirstAdmin(request.body || {});
      response.cookie(cookieName, auth.signSession(user.username, Date.now() + auth.sessionDurationMs), cookieOptions(secureCookie));
      response.json({ user });
    } catch (error) {
      sendError(response, error, error instanceof Error && error.message.includes('đã được tạo') ? 403 : 400);
    }
  });

  router.post('/login', async (request, response) => {
    try {
      const user = await auth.login(request.body?.username, request.body?.password);
      response.cookie(cookieName, auth.signSession(user.username, Date.now() + auth.sessionDurationMs), cookieOptions(secureCookie));
      response.json({ user });
    } catch (error) {
      sendError(response, error, 401);
    }
  });

  router.post('/logout', (_request, response) => {
    response.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: secureCookie, path: '/' });
    response.json({ ok: true });
  });

  return { router, auth };
}

export function requireCareUser(auth: ReturnType<typeof createAuthService>): RequestHandler {
  return async (request, response, next) => {
    try {
      const username = auth.readSession(readCookie(request, cookieName));
      const user: CareUser | null = username ? await auth.findUser(username) : null;
      if (!user) {
        response.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
        return;
      }
      response.locals.user = user;
      next();
    } catch {
      response.status(500).json({ error: 'Không thể xác minh phiên đăng nhập.' });
    }
  };
}

export function createUsersRouter(pool:Pool,auth:ReturnType<typeof createAuthService>){
  const router=Router();
  const admin=(response:Response)=>((response.locals.user as CareUser).role==='admin');
  router.get('/users',async(_request,response)=>{
    try{response.json(await auth.listUsers());}
    catch{response.status(500).json({error:'Không thể tải danh sách tài khoản.'});}
  });
  router.post('/users',async(request,response)=>{
    const actor=response.locals.user as CareUser;if(!admin(response)){response.status(403).json({error:'Chỉ Quản trị được thêm tài khoản.'});return;}
    try{const user=await auth.createUser(request.body||{});await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'user.create\',$2::jsonb)',[actor.username,JSON.stringify({user:user.username,role:user.role})]);response.json(user);}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể tạo tài khoản.'});}
  });
  router.put('/users/:username',async(request,response)=>{
    const actor=response.locals.user as CareUser;if(!admin(response)){response.status(403).json({error:'Chỉ Quản trị được sửa tài khoản.'});return;}
    try{const user=await auth.updateUser(request.params.username,request.body||{});if(!user){response.status(404).json({error:'Không tìm thấy tài khoản.'});return;}await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'user.update\',$2::jsonb)',[actor.username,JSON.stringify({user:user.username,role:user.role})]);response.json(user);}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể sửa tài khoản.'});}
  });
  router.put('/users/:username/password',async(request,response)=>{
    const actor=response.locals.user as CareUser;if(!admin(response)){response.status(403).json({error:'Chỉ Quản trị được đặt lại mật khẩu.'});return;}
    try{await auth.setPassword(request.params.username,request.body?.password);await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'user.password.reset\',$2::jsonb)',[actor.username,JSON.stringify({user:request.params.username})]);response.json({ok:true});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể đặt lại mật khẩu.'});}
  });
  router.delete('/users/:username',async(request,response)=>{
    const actor=response.locals.user as CareUser;if(!admin(response)){response.status(403).json({error:'Chỉ Quản trị được gỡ tài khoản.'});return;}
    try{const removed=await auth.removeUser(request.params.username,actor.username);if(!removed){response.status(404).json({error:'Không tìm thấy tài khoản.'});return;}await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'user.delete\',$2::jsonb)',[actor.username,JSON.stringify({user:request.params.username})]);response.json({ok:true});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể gỡ tài khoản.'});}
  });
  router.put('/me/password',async(request,response)=>{
    const user=response.locals.user as CareUser;
    try{await auth.changeOwnPassword(user.username,request.body?.current,request.body?.password);response.json({ok:true});}
    catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể đổi mật khẩu.'});}
  });
  router.get('/staff',async(_request,response)=>{
    try{const result=await pool.query(`SELECT sale_id AS id,MAX(sale_name) AS name FROM customers WHERE sale_id IS NOT NULL GROUP BY sale_id ORDER BY name`);response.json(result.rows);}
    catch{response.status(500).json({error:'Không thể tải nhân viên CRM.'});}
  });
  return router;
}
