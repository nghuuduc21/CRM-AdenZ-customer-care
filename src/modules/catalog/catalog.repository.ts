import type { Pool } from 'pg';

export function createCatalogRepository(pool:Pool){
  return{
    async products(){
      const result=await pool.query(`SELECT id,tourwell_id,code,name,COALESCE(type,product_type) AS type,destination,duration,price,
        COALESCE(image,image_url) AS image,url,active,created_at,(created_at>=now()-interval '30 days') AS is_new
        FROM products WHERE active=true AND is_demo=true ORDER BY created_at DESC NULLS LAST,name`);
      return result.rows;
    },
    async destinations(){
      const result=await pool.query(`SELECT destination FROM (
        SELECT destination FROM orders WHERE is_demo=true AND destination IS NOT NULL AND destination<>'' AND destination<>'Khác'
        UNION SELECT destination FROM products WHERE is_demo=true AND destination IS NOT NULL AND destination<>'' AND destination<>'Khác'
      ) destinations ORDER BY destination`);
      return result.rows.map((row)=>row.destination as string);
    },
    async serviceGroups(){
      const result=await pool.query(`SELECT DISTINCT service_type FROM order_services WHERE is_demo=true AND service_type IS NOT NULL AND btrim(service_type)<>'' ORDER BY service_type`);
      return result.rows.map((row)=>row.service_type as string);
    },
  };
}
