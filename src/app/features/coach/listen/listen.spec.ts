import { ReviseCard } from '../../student/student.models';
import { clipsFor } from './listen';
import { MAX_CHUNK, chunks } from './speech.service';

const card = (over: Partial<ReviseCard> = {}): ReviseCard => ({
  key: 'a', subject: 'GK', exam_title: 'Mock', text: 'Which state has Gir?', text_hi: 'गिर किस राज्य में है?',
  options: [
    { id: 1, text: 'Gujarat', text_hi: 'गुजरात', is_correct: true },
    { id: 2, text: 'Kerala', text_hi: 'केरल', is_correct: false },
  ],
  your_option: 2, explanation: 'Gir is in Gujarat.', explanation_hi: 'गिर गुजरात में है।', ...over,
});

describe('splitting text for speech', () => {
  it('keeps a short text whole', () => {
    expect(chunks('One short sentence.')).toEqual(['One short sentence.']);
  });

  it('splits at sentence ends, including the Hindi danda', () => {
    expect(chunks('पहला वाक्य। दूसरा वाक्य। Third one.')).toEqual(['पहला वाक्य।', 'दूसरा वाक्य।', 'Third one.']);
  });

  it('cuts a very long sentence into pieces no longer than the limit', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ') + '.';
    const parts = chunks(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= MAX_CHUNK)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });

  it('gives nothing for empty text', () => {
    expect(chunks('   ')).toEqual([]);
  });
});

describe('what is read aloud for a revision card', () => {
  it('reads the question, the right answer and the explanation in Hindi', () => {
    const clips = clipsFor(card(), 'hindi', true);
    expect(clips.map((c) => c.lang)).toEqual(['hi', 'hi', 'hi']);
    expect(clips[0].text).toContain('गिर किस राज्य में है?');
    expect(clips[1].text).toContain('गुजरात');
    expect(clips[2].text).toContain('गिर गुजरात में है।');
  });

  it('can leave the question out', () => {
    const clips = clipsFor(card(), 'hindi', false);
    expect(clips.length).toBe(2);
    expect(clips[0].text).toContain('सही उत्तर');
  });

  it('falls back to English for a card with no Hindi, and says so with the English voice', () => {
    const clips = clipsFor(card({ text_hi: '', explanation_hi: '', options: [{ id: 1, text: 'Gujarat', text_hi: '', is_correct: true }] }), 'hindi', true);
    expect(clips.every((c) => c.lang === 'en')).toBe(true);
    expect(clips.map((c) => c.text).join(' ')).toContain('Which state has Gir?');
  });

  it('reads Hindi first and then English when asked for both', () => {
    const clips = clipsFor(card(), 'both', true);
    expect(clips.map((c) => c.lang)).toEqual(['hi', 'hi', 'hi', 'en', 'en', 'en']);
  });

  it('skips the answer when the card has no marked correct option', () => {
    const clips = clipsFor(card({ options: [{ id: 1, text: 'A', text_hi: '', is_correct: false }] }), 'english', true);
    expect(clips.map((c) => c.text).join(' ')).not.toContain('Correct answer');
  });
});
