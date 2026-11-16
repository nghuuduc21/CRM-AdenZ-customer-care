import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import { createAuthRepository } from './auth.repository.js';
import type { CareRole, CareUser, NewCareUser } from './auth.types.js';

const scrypt = promisify(scryptCallback);
const roles = new Set<CareRole>(['admin', 'boss', 'marketing', 'sale']);
const usernamePattern = /^[a-z0-9._@-]{3,40}$/;
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const lockAfter = 5;
const lockDurationMs = 15 * 60_000;
const sessionDurationMs = 12 * 60 * 60_000;

function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltText, hashText] = stored.split(':');
  if (!saltText || !hashText) return false;
  const salt = Buffer.from(saltText, 'base64');
  const expected = Buffer.from(hashText, 'base64');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function publicUser(user: CareUser): CareUser {
  return user;
}

function validateNewUser(input: Partial<NewCareUser>): NewCareUser {
  const username = normalizeUsername(input.username);
  const name = String(input.name ?? '').trim().slice(0, 80);
  const password = String(input.password ?? '');
  const role = input.role ?? 'admin';
  const email = String(input.email ?? '').trim().toLowerCase();
  const rawSaleId: unknown = input.saleId;
  const saleId = rawSaleId === '' || rawSaleId == null ? null : Number(rawSaleId);

  if (!usernamePattern.test(username)) throw new Error('Tên đăng nhập cần dài 3–40 ký tự, dùng chữ không dấu, số, dấu chấm, @, gạch ngang.');
  if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
  if (!roles.has(role)) throw new Error('Vai trò tài khoản không hợp lệ.');
  if (email && !emailPattern.test(email)) throw new Error('Email không hợp lệ.');
  if (saleId !== null && !Number.isSafeInteger(saleId)) throw new Error('Mã nhân viên CRM phải là số nguyên.');

  return { username, name: name || username, password, role, email: email || undefined, saleId };
}

function validateProfile(input: {name?:unknown;role?:unknown;email?:unknown;saleId?:unknown},current:CareUser){
  const name=input.name===undefined?undefined:String(input.name??'').trim().slice(0,80)||current.name;
  const role=input.role===undefined?undefined:input.role as CareRole;
  if(role&&!roles.has(role))throw new Error('Vai trò tài khoản không hợp lệ.');
  const email=input.email===undefined?undefined:String(input.email??'').trim().toLowerCase();
  if(email&&!emailPattern.test(email))throw new Error('Email không hợp lệ.');
  const rawSaleId:unknown=input.saleId;
  const saleId=rawSaleId===undefined?undefined:rawSaleId===''||rawSaleId===null?null:Number(rawSaleId);
  if(typeof saleId==='number'&&!Number.isSafeInteger(saleId))throw new Error('Mã nhân viên CRM phải là số nguyên.');
  return{name,role,email,saleId};
}

export function createAuthService(pool: Pool, secret: Buffer) {
  const repository = createAuthRepository(pool);
  const sessionKey = createHmac('sha256', secret).update('customer-care-demo-session-v1').digest();

  return {
    async needsSetup(): Promise<boolean> {
      return (await repository.countUsers()) === 0;
    },

    async createFirstAdmin(input: Partial<NewCareUser>): Promise<CareUser> {
      const user = validateNewUser({ ...input, role: 'admin' });
      return repository.createInitialAdmin(user, await hashPassword(user.password));
    },

    async login(usernameInput: unknown, passwordInput: unknown): Promise<CareUser> {
      const username = normalizeUsername(usernameInput);
      const password = String(passwordInput ?? '');
      const failures = await repository.loginFailures(username);
      const now = new Date();
      if (failures.lockedUntil && failures.lockedUntil > now) {
        throw new Error('Tài khoản tạm khóa 15 phút sau nhiều lần đăng nhập sai.');
      }

      const user = await repository.getUserWithHash(username);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        const count = failures.lockedUntil && failures.lockedUntil <= now ? 1 : failures.count + 1;
        const lockedUntil = count >= lockAfter ? new Date(now.getTime() + lockDurationMs) : null;
        await repository.recordLoginFailure(username, count, lockedUntil);
        throw new Error(lockedUntil ? 'Sai quá nhiều lần, tài khoản tạm khóa 15 phút.' : 'Sai tên đăng nhập hoặc mật khẩu.');
      }

      await repository.clearLoginFailure(username);
      return publicUser(user);
    },

    async findUser(username: string): Promise<CareUser | null> {
      return repository.getUser(normalizeUsername(username));
    },

    async listUsers(){return repository.listUsers();},

    async createUser(input:Partial<NewCareUser>){
      const normalized=validateNewUser({...input,role:(input.role||'marketing') as CareRole});
      return repository.insertUser(normalized,await hashPassword(normalized.password));
    },

    async updateUser(username:string,input:{name?:unknown;role?:unknown;email?:unknown;saleId?:unknown}){
      const current=await repository.getUser(normalizeUsername(username));
      if(!current)return null;
      const profile=validateProfile(input,current);
      if(current.role==='admin'&&profile.role&&profile.role!=='admin'&&await repository.countAdmins()<=1)
        throw new Error('Hệ thống cần giữ ít nhất một tài khoản quản trị.');
      return repository.updateUser(current.username,profile);
    },

    async setPassword(username:string,passwordInput:unknown){
      const password=String(passwordInput??'');if(password.length<8)throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
      const ok=await repository.updatePassword(normalizeUsername(username),await hashPassword(password));
      if(!ok)throw Object.assign(new Error('Không tìm thấy tài khoản.'),{status:404});
    },

    async changeOwnPassword(username:string,currentPassword:unknown,newPassword:unknown){
      const user=await repository.getUserWithHash(normalizeUsername(username));
      if(!user||!(await verifyPassword(String(currentPassword??''),user.passwordHash)))throw new Error('Mật khẩu hiện tại không đúng.');
      await this.setPassword(user.username,newPassword);
    },

    async removeUser(username:string,actor:string){
      const normalized=normalizeUsername(username),user=await repository.getUser(normalized);
      if(!user)return false;
      if(normalized===normalizeUsername(actor))throw new Error('Không thể gỡ tài khoản đang đăng nhập.');
      if(user.role==='admin'&&await repository.countAdmins()<=1)throw new Error('Hệ thống phải còn ít nhất một tài khoản quản trị.');
      return repository.removeUser(normalized);
    },

    signSession(username: string, expiresAt: number): string {
      const data = Buffer.from(JSON.stringify({ username, exp: expiresAt })).toString('base64url');
      const signature = createHmac('sha256', sessionKey).update(data).digest('base64url');
      return `${data}.${signature}`;
    },

    readSession(value: string | undefined, now = Date.now()): string | null {
      if (!value) return null;
      const [data, signature] = value.split('.');
      if (!data || !signature) return null;
      const expected = createHmac('sha256', sessionKey).update(data).digest();
      let supplied: Buffer;
      try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      try {
        const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { username?: unknown; exp?: unknown };
        return typeof parsed.username === 'string' && typeof parsed.exp === 'number' && parsed.exp > now
          ? normalizeUsername(parsed.username)
          : null;
      } catch {
        return null;
      }
    },

    sessionDurationMs,
  };
}
