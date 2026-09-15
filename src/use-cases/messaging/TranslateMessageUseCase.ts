const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

class TranslateMessageUseCase {
  conversationRepository: any;
  messageRepository: any;
  translationService: any;
  redis: any;

  constructor({ conversationRepository, messageRepository, translationService, redis }) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.translationService = translationService;
    this.redis = redis;
  }

  async execute({ requester, messageId, targetLanguage }: { requester: any; messageId: any; targetLanguage: string }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!this.translationService.configured) {
      throw new Error('Translation is not configured');
    }
    if (!targetLanguage) {
      throw new Error('A target language is required');
    }

    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    if (message.type !== 'text' || !message.body) {
      throw new Error('Only text messages can be translated');
    }

    const isParticipant = await this.conversationRepository.isParticipant(message.conversationId, requester.id);
    if (!isParticipant) {
      throw new Error('You are not a participant of this conversation');
    }

    const cacheKey = `translate:${messageId}:${targetLanguage}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { translatedText: cached };
    }

    const translatedText = await this.translationService.translate(message.body, targetLanguage);
    await this.redis.set(cacheKey, translatedText, 'EX', CACHE_TTL_SECONDS);

    return { translatedText };
  }
}

export { TranslateMessageUseCase };
