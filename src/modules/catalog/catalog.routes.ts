import {Router} from 'express';
import type {Pool} from 'pg';
import {createCatalogRepository} from './catalog.repository.js';
import {createSettingsService} from '../settings/settings.service.js';

export function createCatalogRouter(pool:Pool){
  const router=Router(),repository=createCatalogRepository(pool),settings=createSettingsService(pool);
  router.get('/products',async(_request,response)=>{try{response.json(await repository.products());}catch{response.status(500).json({error:'Không thể tải tour và dịch vụ.'});}});
  router.get('/services',async(_request,response)=>{try{const [data,groups]=await Promise.all([settings.load(),repository.serviceGroups()]);response.json({groups:groups.length?groups:['Vé máy bay','Khách sạn','Thuê xe','Ẩm thực','SIM và Wi-Fi'],catalog:data.services});}catch{response.status(500).json({error:'Không thể tải dịch vụ.'});}});
  router.get('/destinations',async(_request,response)=>{try{response.json(await repository.destinations());}catch{response.status(500).json({error:'Không thể tải danh sách điểm đến.'});}});
  return router;
}
