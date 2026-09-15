const MODEL = 'gemini-3.5-flash-lite';

const LANGUAGE_NAMES = { en: 'English', fr: 'French' };

function languageNameFor(code) {
  return LANGUAGE_NAMES[code] || code;
}

class TranslationService {
  configured: boolean;
  clientPromise: Promise<any> | null;

  constructor() {
    this.configured = Boolean(process.env.GEMINI_API_KEY);
    this.clientPromise = null;
  }

  async getClient() {
    this.clientPromise ??= import('@google/genai').then(
      ({ GoogleGenAI }) => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
    );
    return this.clientPromise;
  }

  async translate(text, targetLanguageCode) {
    if (!this.configured) {
      throw new Error('Translation is not configured');
    }

    const client = await this.getClient();
    const targetLanguage = languageNameFor(targetLanguageCode);
    const response = await client.models.generateContent({
      model: MODEL,
      contents: `Translate the following message into ${targetLanguage}. Reply with only the translated text, no quotes, no explanation, no extra commentary.\n\n${text}`,
    });

    const translated = response.text?.trim();
    if (!translated) {
      throw new Error('Translation failed');
    }
    return translated;
  }
}

export { TranslationService };
