import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { encryptSecret } from '../../shared/security/secret-box.js';
import { createSettingsService } from './settings.service.js';
import { publicView, type Settings } from './settings.defaults.js';
import { createScoringService } from '../scoring/scoring.service.js';

const emailPattern=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
const manager=(user:CareUser)=>['admin','boss','marketing'].includes(user.role);
const integer=(value:unknown,min:number,max:number,label:string)=>{
  const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} từ ${min} đến ${max}.`);return n;
};

export function createSettingsRouter(pool:Pool,key:Buffer){
  const router=Router();
  const service=createSettingsService(pool);
  const scoring=createScoringService(pool);

  router.get('/settings',async(_request,response)=>{
    try{response.json(publicView(await service.load()));}
    catch{response.status(500).json({error:'Không thể tải cài đặt.'});}
  });

  router.put('/settings/smtp',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!manager(user)){response.status(403).json({error:'Vai trò hiện tại không được đổi cài đặt email.'});return;}
    try{
      const body=request.body||{},host=String(body.host||'').trim(),username=String(body.user||'').trim(),port=Number(body.port);
      if(!/^[\w.-]+$/.test(host))throw new Error('Máy chủ SMTP không hợp lệ.');
      if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Cổng SMTP không hợp lệ.');
      if(!emailPattern.test(username))throw new Error('Email đăng nhập SMTP không hợp lệ.');
      const testTo=String(body.testTo||'').trim();if(testTo&&!emailPattern.test(testTo))throw new Error('Email nhận thử không hợp lệ.');
      const settings=await service.load();
      let from=String(body.from||'').replace(/["\r\n]/g,'').trim();if(from&&!from.includes('@'))from=`"${from.slice(0,60)}" <${username}>`;
      settings.smtp={...settings.smtp,host,port,secure:body.secure===true,user:username,from};
      if(body.password)settings.smtp.passEnc=encryptSecret(key,String(body.password).replace(/\s+/g,''));
      settings.testTo=testTo;
      await service.save(settings);
      await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'settings.smtp\',$2::jsonb)',[user.username,JSON.stringify({host,port,username})]);
      response.json(publicView(settings));
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu cài đặt SMTP.'});}
  });

  router.put('/settings/tourwell',(_request,response)=>response.status(403).json({error:'Kết nối CRM bên ngoài đã tắt trong bản học tập dùng dữ liệu demo.'}));

  router.put('/settings/sending',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!manager(user)){response.status(403).json({error:'Vai trò hiện tại không được đổi chính sách gửi.'});return;}
    try{
      const b=request.body||{};if(!timePattern.test(b.quietStart)||!timePattern.test(b.quietEnd))throw new Error('Khung giờ yên lặng dạng HH:MM.');
      const settings=await service.load();settings.sending={perMinute:integer(b.perMinute,1,200,'Tốc độ gửi'),quietStart:b.quietStart,quietEnd:b.quietEnd,marketingPerWeek:integer(b.marketingPerWeek,0,14,'Số tin quảng cáo mỗi tuần'),subjectPrefix:String(b.subjectPrefix||'').slice(0,20)};
      if(b.publicUrl){if(!/^https?:\/\/[\w.-]+(:\d+)?\/?$/.test(b.publicUrl))throw new Error('Địa chỉ công khai không hợp lệ.');settings.publicUrl=String(b.publicUrl).replace(/\/+$/,'');}
      if(b.syncTime&&timePattern.test(b.syncTime))settings.schedule.syncTime=b.syncTime;
      await service.save(settings);await pool.query('INSERT INTO care_audit(actor,action) VALUES($1,\'settings.sending\')',[user.username]);
      response.json(publicView(settings));
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu chính sách gửi.'});}
  });

  router.put('/settings/weights',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!manager(user)){response.status(403).json({error:'Vai trò hiện tại không được đổi trọng số.'});return;}
    try{
      const settings=await service.load(),weights={...settings.weights};
      for(const name of Object.keys(weights) as (keyof typeof weights)[])weights[name]=integer(request.body?.[name],-100,100,`Trọng số ${name}`);
      settings.weights=weights;await service.save(settings);
      const result=await scoring.recompute(settings);
      await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'settings.weights\',$2::jsonb)',[user.username,JSON.stringify(weights)]);
      response.json({ok:true,...result,note:'Đã lưu trọng số và chấm lại khách hàng bằng quy tắc minh bạch.'});
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu trọng số.'});}
  });

  router.put('/settings/flow',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!manager(user)){response.status(403).json({error:'Vai trò hiện tại không được đổi quy trình.'});return;}
    try{
      const b=request.body||{},settings=await service.load(),f=settings.flow;
      if(b.leadSlaMinutes!=null)f.leadSlaMinutes=integer(b.leadSlaMinutes,1,240,'Hạn liên hệ lead (phút)');
      if(b.leadEscalateHours!=null)f.leadEscalateHours=integer(b.leadEscalateHours,1,48,'Báo sếp sau (giờ)');
      if(b.surveyDays!=null)f.surveyDays=integer(b.surveyDays,1,14,'Gửi khảo sát sau (ngày)');
      for(const name of ['workStart','workEnd','digestTime','weeklyTime'] as const)if(b[name]!=null){if(!timePattern.test(b[name]))throw new Error('Giờ cần theo dạng HH:MM.');f[name]=b[name];}
      if(b.weeklyDay!=null)f.weeklyDay=integer(b.weeklyDay,0,6,'Ngày báo cáo tuần');
      if(b.reviewUrl!==undefined){if(b.reviewUrl&&!/^https:\/\/\S+$/.test(b.reviewUrl))throw new Error('Link đánh giá cần bắt đầu bằng https://.');f.reviewUrl=b.reviewUrl||'';}
      if(b.referralText!==undefined)f.referralText=String(b.referralText).slice(0,500);
      if(b.accountingEmail!==undefined){if(b.accountingEmail&&!emailPattern.test(b.accountingEmail))throw new Error('Email kế toán không hợp lệ.');f.accountingEmail=b.accountingEmail||'';}
      if(b.tierBenefits)for(const name of Object.keys(f.tierBenefits))if(name in b.tierBenefits)f.tierBenefits[name]=String(b.tierBenefits[name]||'').slice(0,500);
      if(b.staffEmails&&typeof b.staffEmails==='object'){const emails:Record<string,string>={};for(const [id,email] of Object.entries(b.staffEmails)){const value=String(email||'').trim().toLowerCase();if(!/^\d+$/.test(id))continue;if(value&&!emailPattern.test(value))throw new Error(`Email nhân viên #${id} không hợp lệ.`);if(value)emails[id]=value;}f.staffEmails=emails;}
      if(b.alertDays!=null)f.alertDays=integer(b.alertDays,3,60,'Cảnh báo hết hạn sau (ngày)');
      if(b.partnerReportDays!=null)f.partnerReportDays=integer(b.partnerReportDays,1,14,'Báo cáo đối tác sau (ngày)');
      if(b.commissionText!==undefined)f.commissionText=String(b.commissionText).slice(0,1000);
      await service.save(settings);await pool.query('INSERT INTO care_audit(actor,action) VALUES($1,\'settings.flow\')',[user.username]);response.json(publicView(settings));
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu quy trình.'});}
  });

  router.put('/settings/services',async(request,response)=>{
    const user=response.locals.user as CareUser;if(!manager(user)){response.status(403).json({error:'Vai trò hiện tại không được sửa dịch vụ.'});return;}
    try{
      const items=Array.isArray(request.body)?request.body:[];if(items.length>30)throw new Error('Tối đa 30 dịch vụ.');
      const settings=await service.load();settings.services=items.map((item:any,index:number)=>{
        const name=String(item.name||'').trim().slice(0,120);if(!name)throw new Error(`Dòng ${index+1}: nhập tên dịch vụ.`);
        const url=String(item.url||'').trim();if(url&&!/^https:\/\/\S+$/.test(url))throw new Error(`${name}: đường dẫn phải bắt đầu bằng https://.`);
        const id=String(item.id||name.toLowerCase().replace(/[^a-z0-9]+/g,'-')).slice(0,80);
        const price=Number(String(item.price||0).replace(/[^\d]/g,''))||0;
        return{id,name,desc:String(item.desc||'').slice(0,300),price,url};
      });
      await service.save(settings);await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'settings.services\',$2::jsonb)',[user.username,JSON.stringify({count:items.length})]);response.json(settings.services);
    }catch(error){response.status(400).json({error:error instanceof Error?error.message:'Không thể lưu danh sách dịch vụ.'});}
  });

  return router;
}
