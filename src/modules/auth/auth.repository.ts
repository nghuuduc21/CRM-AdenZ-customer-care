import type { Pool } from 'pg';
import type { CareRole, CareUser, NewCareUser } from './auth.types.js';

interface UserRow {
  username: string;
  name: string;
  role: CareRole;
  email: string | null;
  sale_id: string | null;
  created_at: Date;
  password_hash?: string;
}

function toUser(row: UserRow): CareUser {
  return {
    username: row.username,
    name: row.name,
    role: row.role,
    email: row.email,
    saleId: row.sale_id === null ? null : Number(row.sale_id),
    createdAt: row.created_at.toISOString(),
  };
}

export function createAuthRepository(pool: Pool) {
  return {
    async countUsers(): Promise<number> {
      const result = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM care_users');
      return Number(result.rows[0]?.count ?? 0);
    },

    async listUsers(): Promise<CareUser[]> {
      const result = await pool.query<UserRow>(
        'SELECT username,name,role,email,sale_id,created_at FROM care_users ORDER BY username',
      );
      return result.rows.map(toUser);
    },

    async getUser(username: string): Promise<CareUser | null> {
      const result = await pool.query<UserRow>(
        'SELECT username,name,role,email,sale_id,created_at FROM care_users WHERE username=$1',
        [username],
      );
      return result.rows[0] ? toUser(result.rows[0]) : null;
    },

    async getUserWithHash(username: string): Promise<(CareUser & { passwordHash: string }) | null> {
      const result = await pool.query<UserRow>(
        'SELECT username,name,role,email,sale_id,created_at,password_hash FROM care_users WHERE username=$1',
        [username],
      );
      const row = result.rows[0];
      return row?.password_hash ? { ...toUser(row), passwordHash: row.password_hash } : null;
    },

    async insertUser(user: NewCareUser, passwordHash: string): Promise<CareUser> {
      const result = await pool.query<UserRow>(
        `INSERT INTO care_users(username,name,role,email,sale_id,password_hash)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING username,name,role,email,sale_id,created_at`,
        [user.username, user.name, user.role, user.email || null, user.saleId ?? null, passwordHash],
      );
      return toUser(result.rows[0]);
    },

    async createInitialAdmin(user: NewCareUser, passwordHash: string): Promise<CareUser> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [1_417_202_604]);
        const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM care_users');
        if (Number(count.rows[0]?.count) > 0) throw new Error('Tài khoản quản trị đã được tạo.');
        const result = await client.query<UserRow>(
          `INSERT INTO care_users(username,name,role,email,sale_id,password_hash)
           VALUES($1,$2,$3,$4,$5,$6)
           RETURNING username,name,role,email,sale_id,created_at`,
          [user.username, user.name, user.role, user.email || null, user.saleId ?? null, passwordHash],
        );
        await client.query('COMMIT');
        return toUser(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async loginFailures(username: string): Promise<{ count: number; lockedUntil: Date | null }> {
      const result = await pool.query<{ failure_count: number; locked_until: Date | null }>(
        'SELECT failure_count,locked_until FROM care_login_failures WHERE username=$1', [username],
      );
      return result.rows[0]
        ? { count: result.rows[0].failure_count, lockedUntil: result.rows[0].locked_until }
        : { count: 0, lockedUntil: null };
    },

    async recordLoginFailure(username: string, count: number, lockedUntil: Date | null): Promise<void> {
      await pool.query(
        `INSERT INTO care_login_failures(username,failure_count,locked_until) VALUES($1,$2,$3)
         ON CONFLICT(username) DO UPDATE SET failure_count=EXCLUDED.failure_count,locked_until=EXCLUDED.locked_until`,
        [username, count, lockedUntil],
      );
    },

    async clearLoginFailure(username: string): Promise<void> {
      await pool.query('DELETE FROM care_login_failures WHERE username=$1', [username]);
    },

    async updateUser(username:string,input:{name?:string;role?:CareRole;email?:string|null;saleId?:number|null}):Promise<CareUser|null>{
      const result=await pool.query<UserRow>(`UPDATE care_users SET
        name=COALESCE($2,name),role=COALESCE($3,role),email=CASE WHEN $4::boolean THEN $5 ELSE email END,
        sale_id=CASE WHEN $6::boolean THEN $7 ELSE sale_id END
        WHERE username=$1 RETURNING username,name,role,email,sale_id,created_at`,
      [username,input.name??null,input.role??null,input.email!==undefined,input.email??null,input.saleId!==undefined,input.saleId??null]);
      return result.rows[0]?toUser(result.rows[0]):null;
    },

    async updatePassword(username:string,passwordHash:string):Promise<boolean>{
      const result=await pool.query('UPDATE care_users SET password_hash=$2 WHERE username=$1',[username,passwordHash]);
      return Boolean(result.rowCount);
    },

    async removeUser(username:string):Promise<boolean>{
      const result=await pool.query('DELETE FROM care_users WHERE username=$1',[username]);
      return Boolean(result.rowCount);
    },

    async countAdmins():Promise<number>{
      const result=await pool.query<{count:string}>("SELECT count(*)::text AS count FROM care_users WHERE role='admin'");
      return Number(result.rows[0]?.count??0);
    },
  };
}
