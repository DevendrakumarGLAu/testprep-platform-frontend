import { protectApp, protectExam } from './protect';

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
  document.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('production protection', () => {
  it('does nothing outside production', () => {
    const off = protectApp(document, false);
    expect(press({ key: 'F12' })).toBe(false);
    const exam = protectExam(document, false);
    const copy = new Event('copy', { cancelable: true });
    document.dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(false);
    expect(document.body.classList.contains('exam-locked')).toBe(false);
    off();
    exam();
  });

  it('blocks the developer-tools shortcuts and the context menu, and can be removed', () => {
    const off = protectApp(document, true);
    expect(press({ key: 'F12' })).toBe(true);
    expect(press({ key: 'I', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: 'u', ctrlKey: true })).toBe(true);
    expect(press({ key: 'a' })).toBe(false);
    const menu = new Event('contextmenu', { cancelable: true });
    document.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    off();
    expect(press({ key: 'F12' })).toBe(false);
  });

  it('blocks copying on the exam screen and unlocks when it closes', () => {
    const off = protectExam(document, true);
    expect(document.body.classList.contains('exam-locked')).toBe(true);
    for (const n of ['copy', 'cut', 'selectstart', 'dragstart']) {
      const e = new Event(n, { cancelable: true });
      document.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
    expect(press({ key: 'c', ctrlKey: true })).toBe(true);
    off();
    expect(document.body.classList.contains('exam-locked')).toBe(false);
    const e = new Event('copy', { cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
