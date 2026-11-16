import { Router } from 'express';
import type { Pool } from 'pg';
import type { CareUser } from '../auth/auth.types.js';
import { createSettingsService } from '../settings/settings.service.js';
import { JOURNEYS } from '../settings/settings.defaults.js';
import { createJourneyPreviewService } from './journey-preview.service.js';

const canManage = (user: CareUser) => ['admin', 'boss', 'marketing'].includes(user.role);

export function createJourneyRouter(pool: Pool) {
  const router = Router();
  const settingsService = createSettingsService(pool);
  const previewService = createJourneyPreviewService(pool);

  router.get('/journeys', async (_request, response) => {
    try {
      const settings = await settingsService.load();
      const sent = await pool.query(`SELECT journey,count(*)::int AS count FROM messages WHERE status='sent' GROUP BY journey`);
      const sentByJourney = new Map(sent.rows.map((row) => [row.journey, row.count]));
      response.json({ params: {
        reminderDays: settings.journeys.reminderDays, prepDays: settings.journeys.prepDays,
        postTripDays: settings.journeys.postTripDays,
        journeyTime: settings.schedule.journeyTime,
        marketingPerWeek: settings.sending.marketingPerWeek,
        partnerSeasons: settings.flow.partnerSeasons.map(season=>({...season,daysBefore:season.daysBefore||14})),
      }, journeys: Object.entries(JOURNEYS).map(([key, meta]) => ({ key, ...meta,
        enabled: settings.journeys.enabled[key as keyof typeof settings.journeys.enabled] ?? false,
        sent: Number(sentByJourney.get(key) || 0), template: settings.journeys.templates[key as keyof typeof settings.journeys.templates] || null,
      })) });
    } catch { response.status(500).json({ error: 'Không thể tải hành trình chăm sóc.' }); }
  });

  router.put('/journeys', async (request, response) => {
    const user = response.locals.user as CareUser;
    if (!canManage(user)) { response.status(403).json({ error: 'Vai trò hiện tại không được sửa hành trình.' }); return; }
    try {
      const body = request.body || {}, settings = await settingsService.load();
      const enabled: Record<string, boolean> = {};
      for (const key of Object.keys(JOURNEYS)) enabled[key] = body.enabled?.[key] ?? body[key] ?? settings.journeys.enabled[key as keyof typeof settings.journeys.enabled] ?? false;
      const templates = { ...settings.journeys.templates };
      if (body.templates && typeof body.templates === 'object') for (const [key, value] of Object.entries(body.templates)) {
        if (!(key in JOURNEYS) || !value || typeof value !== 'object') continue;
        templates[key as keyof typeof templates] = {
          subject: String((value as any).subject || '').slice(0, 300), body: String((value as any).body || '').slice(0, 12000),
        };
      }
      settings.journeys.enabled = enabled as typeof settings.journeys.enabled;
      settings.journeys.templates = templates;
      settings.journeys.reminderDays = parseDays(body.reminderDays, settings.journeys.reminderDays);
      settings.journeys.prepDays = bounded(body.prepDays, settings.journeys.prepDays, 1, 30);
      settings.journeys.postTripDays = bounded(body.postTripDays, settings.journeys.postTripDays, 1, 365);
      if (body.journeyTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.journeyTime)) settings.schedule.journeyTime = body.journeyTime;
      if(body.partnerSeasonDays!==undefined){
        if(!Array.isArray(body.partnerSeasonDays)||body.partnerSeasonDays.length!==settings.flow.partnerSeasons.length||body.partnerSeasonDays.some((day:unknown)=>![7,14,30].includes(Number(day)))) throw new Error('Chọn mốc gửi mùa vụ là 7, 14 hoặc 30 ngày trước.');
        settings.flow.partnerSeasons=settings.flow.partnerSeasons.map((season,index)=>({...season,daysBefore:Number(body.partnerSeasonDays[index])}));
      }
      await settingsService.save(settings);
      await pool.query('INSERT INTO care_audit(actor,action) VALUES($1,\'journeys.update\')', [user.username]);
      response.json({ ok: true });
    } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Không thể lưu hành trình.' }); }
  });

  router.get('/journeys/custom', async (_request, response) => {
    const settings = await settingsService.load();
    response.json({ items: (settings.journeys.custom || []).map(item=>({...item,triggerType:item.triggerType||'segment',offsetDays:item.offsetDays??0,cooldownDays:item.cooldownDays??30,ownerRule:item.ownerRule||'sale'})), segments: Object.entries((await import('../scoring/scoring.constants.js')).CARE_SEGMENTS).map(([key, value]) => ({ key, label: value.label })) });
  });

  router.get('/journeys/custom/:id', async (request,response) => {
    const settings=await settingsService.load(),item=settings.journeys.custom.find(entry=>entry.id===String(request.params.id));
    if(!item){response.status(404).json({error:'Không tìm thấy nội dung chăm sóc.'});return;}
    response.json({...item,triggerType:item.triggerType||'segment',offsetDays:item.offsetDays??0,cooldownDays:item.cooldownDays??30,ownerRule:item.ownerRule||'sale'});
  });
  router.post('/journeys/custom', saveCustom(pool, settingsService, 'create'));
  router.put('/journeys/custom/:id', saveCustom(pool, settingsService, 'update'));
  router.delete('/journeys/custom/:id', async (request, response) => {
    const user = response.locals.user as CareUser;
    if (!canManage(user)) { response.status(403).json({ error: 'Vai trò hiện tại không được sửa hành trình.' }); return; }
    const settings = await settingsService.load(), id = String(request.params.id), before = settings.journeys.custom.length;
    settings.journeys.custom = settings.journeys.custom.filter((item) => item.id !== id);
    if(settings.journeys.custom.length===before){response.status(404).json({error:'Không tìm thấy nội dung chăm sóc.'});return;}
    for(const key of Object.keys(settings.journeys.approvedRecipients)) if(key.startsWith(`auto:custom:${id}:`)) delete settings.journeys.approvedRecipients[key];
    await settingsService.save(settings);
    await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'journeys.custom.delete\',$2::jsonb)', [user.username, JSON.stringify({ id })]);
    response.json({ ok: true });
  });

  router.get('/journeys/preview', async (request, response) => {
    try {
      const settings = await settingsService.load();
      const requestedDate=typeof request.query.date==='string'?request.query.date:'';
      if(requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)){response.status(400).json({error:'Ngày mô phỏng phải theo định dạng YYYY-MM-DD.'});return;}
      const parsedDate=Date.parse(requestedDate);
      if(requestedDate&&(!Number.isFinite(parsedDate)||new Date(parsedDate).toISOString().slice(0,10)!==requestedDate)){response.status(400).json({error:'Ngày mô phỏng không hợp lệ.'});return;}
      const simulatedDate=settings.tourwell.useSample?requestedDate||undefined:undefined;
      response.json(await previewService.preview(settings,new Date(),simulatedDate));
    } catch (error) { response.status(500).json({ error: error instanceof Error ? error.message : 'Không thể tạo bản xem trước hành trình.' }); }
  });

  router.put('/journeys/recipients', async (request, response) => {
    const user = response.locals.user as CareUser;
    if (!canManage(user)) { response.status(403).json({ error: 'Vai trò hiện tại không được duyệt người nhận.' }); return; }
    const approved = request.body?.approved;
    if (!approved || typeof approved !== 'object' || Array.isArray(approved) || Object.keys(approved).length>500 || Object.entries(approved).some(([key,value])=>!key.startsWith('auto:')||typeof value!=='boolean')) { response.status(400).json({ error: 'Danh sách duyệt không hợp lệ.' }); return; }
    const settings = await settingsService.load();
    for (const [key, value] of Object.entries(approved)) settings.journeys.approvedRecipients[key] = value as boolean;
    await settingsService.save(settings);
    await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,\'journeys.recipients.approve\',$2::jsonb)', [user.username, JSON.stringify({ count: Object.keys(approved).length })]);
    response.json({ ok: true });
  });

  router.post('/journeys/run', async (_request, response) => {
    response.status(503).json({ error: 'Chưa cấu hình bộ gửi email. Không có email nào được gửi.' });
  });
  router.get('/journeys/preview/:i', async (request, response) => {
    const index = Number(request.params.i), keys = Object.keys(JOURNEYS);
    if (!Number.isInteger(index) || index < 0 || index >= keys.length) { response.status(404).json({ error: 'Không tìm thấy hành trình.' }); return; }
    const settings = await settingsService.load(), key = keys[index] as keyof typeof JOURNEYS;
    const template = settings.journeys.templates[key];
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
    const subject=(template?.subject || JOURNEYS[key].label).replaceAll('{{link_danh_gia}}',settings.flow.reviewUrl||'');
    const body=(template?.body || JOURNEYS[key].desc).replaceAll('{{link_danh_gia}}',settings.flow.reviewUrl||'');
    response.type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><body style="font:15px Arial,sans-serif;white-space:pre-wrap;padding:20px"><h3>${escapeHtml(subject)}</h3>${escapeHtml(body)}</body></html>`);
  });
  return router;
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Giá trị phải từ ${min} đến ${max}.`);
  return number;
}
function parseDays(value: unknown, fallback: number[]) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Array.isArray(value) ? value : String(value).split(',');
  const days = parsed.map(Number);
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 90)) throw new Error('Số ngày nhắc thanh toán không hợp lệ.');
  return [...new Set(days)].sort((a, b) => b - a);
}
function saveCustom(pool: Pool, service: ReturnType<typeof createSettingsService>, mode: 'create' | 'update') {
  return async (request: any, response: any) => {
    const user = response.locals.user as CareUser;
    if (!canManage(user)) { response.status(403).json({ error: 'Vai trò hiện tại không được sửa hành trình.' }); return; }
    try {
      const body = request.body || {}, settings = await service.load(), id = mode === 'update' ? String(request.params.id) : `custom-${Date.now()}`;
      const existing = settings.journeys.custom.find((item) => item.id === id);
      if (mode === 'update' && !existing) { response.status(404).json({ error: 'Không tìm thấy nội dung chăm sóc.' }); return; }
      const name = String(body.name || '').trim().slice(0, 120), subject = String(body.subject || '').trim().slice(0, 300), text = String(body.body || '').slice(0, 12000);
      if (!name || !subject || !text) throw new Error('Tên, tiêu đề và nội dung là bắt buộc.');
      const triggers=['segment','before_trip','payment_due','after_trip','birthday','lead_followup'] as const;
      const triggerType=triggers.includes(body.triggerType) ? body.triggerType : 'segment';
      const segments: string[]=Array.isArray(body.segments)?[...new Set<string>(body.segments.map(String).filter((key:string)=>['vip','loyal','new','at_risk','one_time','dormant','hot','warm','cold'].includes(key)))]:[];
      if(!segments.length) throw new Error('Chọn ít nhất một nhóm khách nhận.');
      const item = { id, name, description: String(body.description || '').slice(0, 500), subject, body: text, segments,
        triggerType, offsetDays: bounded(body.offsetDays,0,0,365), cooldownDays: bounded(body.cooldownDays,30,1,365),
        ownerRule: body.ownerRule==='marketing'?'marketing' as const:'sale' as const, enabled: body.enabled === true,
        createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      settings.journeys.custom = mode === 'update' ? settings.journeys.custom.map((x) => x.id === id ? item : x) : [...settings.journeys.custom, item];
      if(mode==='update') for(const key of Object.keys(settings.journeys.approvedRecipients)) if(key.startsWith(`auto:custom:${id}:`)) delete settings.journeys.approvedRecipients[key];
      await service.save(settings);
      await pool.query('INSERT INTO care_audit(actor,action,detail) VALUES($1,$2,$3::jsonb)', [user.username, `journeys.custom.${mode}`, JSON.stringify({ id })]);
      response.json({ id });
    } catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Không thể lưu nội dung chăm sóc.' }); }
  };
}
