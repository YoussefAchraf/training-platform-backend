import { extractUrls } from '../../../src/domain/utils/extractUrls';

describe('extractUrls', () => {
  it('returns an empty array for text with no links', () => {
    expect(extractUrls('just a plain message')).toEqual([]);
  });

  it('returns an empty array for null or empty input', () => {
    expect(extractUrls(null)).toEqual([]);
    expect(extractUrls('')).toEqual([]);
  });

  it('extracts a single http or https url', () => {
    expect(extractUrls('check this out: https://example.com/page')).toEqual(['https://example.com/page']);
    expect(extractUrls('http://example.com')).toEqual(['http://example.com']);
  });

  it('extracts multiple urls from the same message', () => {
    expect(extractUrls('see https://a.example.com and https://b.example.com too')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('strips trailing punctuation that is not part of the url', () => {
    expect(extractUrls('is this it: https://example.com/page?')).toEqual(['https://example.com/page']);
    expect(extractUrls('link (https://example.com/page).')).toEqual(['https://example.com/page']);
  });
});
