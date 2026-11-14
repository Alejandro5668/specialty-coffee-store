import { Customer } from '../../domain/customer/customer';

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
