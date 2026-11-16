import type { Pool } from 'pg';
import { createCustomerRepository, type CustomerFilters } from './customer.repository.js';

export function createCustomerService(pool: Pool) {
  const repository = createCustomerRepository(pool);
  return {
    list(filters: CustomerFilters) { return repository.list(filters); },
    getProfile(id: number) { return repository.profile(id); },
    destinations() { return repository.destinations(); },
    services() { return repository.services(); },
    setEmailOptOut(id: number, optedOut: boolean, actor: string) { return repository.setEmailOptOut(id,optedOut,actor); },
  };
}
