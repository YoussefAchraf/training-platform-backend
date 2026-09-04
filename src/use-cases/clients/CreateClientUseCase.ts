import { isSupportedCountry } from 'libphonenumber-js';
import { isValidEmail } from '../../domain/validation/isValidEmail';
import { isValidPhoneForCountry } from '../../domain/validation/isValidPhoneForCountry';

class CreateClientUseCase {
  clientRepository: any;
  auditLogRepository: any;

  constructor({ clientRepository, auditLogRepository }) {
    this.clientRepository = clientRepository;
    this.auditLogRepository = auditLogRepository;
  }

  async execute({ requester, companyName, email, phone, country }: { requester: any; companyName: any; email?: any; phone?: any; country?: any }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can add a client');
    }
    if (!companyName || !companyName.trim()) {
      throw new Error('Company name is required');
    }
    if (email && !isValidEmail(email)) {
      throw new Error('email must be a valid email address');
    }
    if (country && !isSupportedCountry(country)) {
      throw new Error('country must be a valid ISO 3166-1 alpha-2 code');
    }
    if (phone && !isValidPhoneForCountry(phone, country)) {
      throw new Error(country ? `phone is not a valid number for ${country}` : 'phone must be a valid phone number');
    }

    const client = await this.clientRepository.create({
      companyName: companyName.trim(),
      email,
      phone,
      country,
      createdBy: requester.id,
    });

    await this.auditLogRepository.create({
      actorId: requester.id,
      action: 'create',
      entityType: 'Client',
      entityId: client.id,
      after: client,
    });

    return client;
  }
}

export { CreateClientUseCase };
