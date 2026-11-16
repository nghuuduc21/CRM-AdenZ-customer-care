import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encryptSecret(key: Buffer, value: string): string {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
}

export function decryptSecret(key: Buffer, value: string | undefined): string {
  if(!value)return '';
  const [version,iv,tag,encrypted]=value.split(':');
  if(version!=='v1'||!iv||!tag||!encrypted)throw new Error('Thông tin bí mật đã mã hóa không hợp lệ.');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted,'base64')),decipher.final()]).toString('utf8');
}
