import { TranslateMessageUseCase } from '../../../src/use-cases/messaging/TranslateMessageUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    ...overrides,
  };
}

function buildDeps() {
  return {
    conversationRepository: { isParticipant: jest.fn().mockResolvedValue(true) },
    messageRepository: {
      findById: jest.fn().mockResolvedValue({ id: 5, conversationId: 10, type: 'text', body: 'Hello there' }),
    },
    translationService: {
      configured: true,
      translate: jest.fn().mockResolvedValue('Bonjour'),
    },
    redis: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    },
  };
}

describe('TranslateMessageUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const deps = buildDeps();
    const useCase = new TranslateMessageUseCase(deps);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), messageId: 5, targetLanguage: 'fr' })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(deps.messageRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects when translation is not configured', async () => {
    const deps = buildDeps();
    deps.translationService.configured = false;
    const useCase = new TranslateMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' })).rejects.toThrow(
      'not configured'
    );
  });

  it('requires a target language', async () => {
    const deps = buildDeps();
    const useCase = new TranslateMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: '' })).rejects.toThrow(
      'target language is required'
    );
  });

  it('rejects a message that does not exist', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue(null);
    const useCase = new TranslateMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' })).rejects.toThrow(
      'Message not found'
    );
  });

  it('rejects a non-text message', async () => {
    const deps = buildDeps();
    deps.messageRepository.findById.mockResolvedValue({ id: 5, conversationId: 10, type: 'image', body: null });
    const useCase = new TranslateMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' })).rejects.toThrow(
      'Only text messages'
    );
  });

  it('rejects a requester who is not a participant', async () => {
    const deps = buildDeps();
    deps.conversationRepository.isParticipant.mockResolvedValue(false);
    const useCase = new TranslateMessageUseCase(deps);

    await expect(useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' })).rejects.toThrow(
      'not a participant'
    );
    expect(deps.translationService.translate).not.toHaveBeenCalled();
  });

  it('returns a cached translation without calling the translation service', async () => {
    const deps = buildDeps();
    deps.redis.get.mockResolvedValue('Bonjour (cached)');
    const useCase = new TranslateMessageUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' });
    expect(result).toEqual({ translatedText: 'Bonjour (cached)' });
    expect(deps.translationService.translate).not.toHaveBeenCalled();
  });

  it('translates and caches the result when not cached', async () => {
    const deps = buildDeps();
    const useCase = new TranslateMessageUseCase(deps);

    const result = await useCase.execute({ requester: buildRequester(), messageId: 5, targetLanguage: 'fr' });
    expect(result).toEqual({ translatedText: 'Bonjour' });
    expect(deps.translationService.translate).toHaveBeenCalledWith('Hello there', 'fr');
    expect(deps.redis.set).toHaveBeenCalledWith('translate:5:fr', 'Bonjour', 'EX', expect.any(Number));
  });
});
