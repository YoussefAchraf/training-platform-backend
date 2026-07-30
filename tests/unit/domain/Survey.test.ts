import { Survey } from '../../../src/domain/entities/Survey';

describe('Survey entity', () => {
  const validProps = {
    id: 1,
    sessionId: 10,
    instructorId: 5,
    attendeeId: 2,
    instructorScore: 4,
    npsScore: 9,
    comments: 'Great session',
    submittedAt: new Date().toISOString(),
  };

  it('constructs successfully with valid scores', () => {
    const survey = new Survey(validProps);
    expect(survey.instructorScore).toBe(4);
    expect(survey.npsScore).toBe(9);
  });

  it.each([-1, 6])('rejects instructorScore out of [0,5] range: %i', (instructorScore) => {
    expect(() => new Survey({ ...validProps, instructorScore })).toThrow(
      'instructorScore must be between 0 and 5'
    );
  });

  it.each([-1, 11])('rejects npsScore out of [0,10] range: %i', (npsScore) => {
    expect(() => new Survey({ ...validProps, npsScore })).toThrow('npsScore must be between 0 and 10');
  });

  it('accepts boundary values (0 and max)', () => {
    expect(() => new Survey({ ...validProps, instructorScore: 0, npsScore: 0 })).not.toThrow();
    expect(() => new Survey({ ...validProps, instructorScore: 5, npsScore: 10 })).not.toThrow();
  });
});
