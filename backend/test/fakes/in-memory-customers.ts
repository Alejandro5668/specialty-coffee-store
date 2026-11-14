import { Customer } from '../../src/domain/customer/customer';
import { CustomerRepository } from '../../src/application/ports/customer.repository';

export class InMemoryCustomers implements CustomerRepository {
  private readonly byEmail = new Map<string, Customer>();

  async findByEmail(email: string): Promise<Customer | null> {
    return this.byEmail.get(email) ?? null;
  }

  async save(customer: Customer): Promise<void> {
    this.byEmail.set(customer.email, customer);
  }
}
