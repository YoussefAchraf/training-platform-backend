import crypto from 'crypto';
import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

const VALID_TYPES = ['image', 'voice', 'file'];

class InitiateUploadUseCase {
  conversationRepository: any;
  attachmentStorageService: any;

  constructor({ conversationRepository, attachmentStorageService }) {
    this.conversationRepository = conversationRepository;
    this.attachmentStorageService = attachmentStorageService;
  }

  async execute({
    requester,
    conversationId,
    type,
    originalName,
    sizeBytes,
  }: {
    requester: any;
    conversationId: any;
    type: string;
    originalName: string;
    sizeBytes: number;
  }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }
    if (!VALID_TYPES.includes(type)) {
      throw new Error('Invalid attachment type');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    const size = Number(sizeBytes);
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Invalid file size');
    }
    if (size > this.attachmentStorageService.limitFor(type)) {
      throw new Error(`This ${type} exceeds the maximum allowed size`);
    }

    const uploadId = crypto.randomUUID();
    const chunkSize = this.attachmentStorageService.chunkSizeBytes;
    const chunkCount = Math.ceil(size / chunkSize);

    await this.attachmentStorageService.ensureUploadDir(uploadId);
    await this.attachmentStorageService.writeUploadMeta(uploadId, {
      conversationId: Number(conversationId),
      userId: requester.id,
      type,
      originalName,
      sizeBytes: size,
      chunkSize,
      chunkCount,
      createdAt: new Date().toISOString(),
    });

    return { uploadId, chunkSize, chunkCount };
  }
}

export { InitiateUploadUseCase };
