import { isProtected, loadProtection, protectApp, protectExam } from './protect';

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

describe('protection switch', () => {
  const file = (body: unknown, ok = true) => () => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

  it('follows the build when there is no flags file', async () => {
    expect(await loadProtection(true, file(null, false))).toBe(true);
    expect(await loadProtection(false, file(null, false))).toBe(false);
    expect(isProtected()).toBe(false);
  });

  it('lets the deployment turn protection off in production', async () => {
    expect(await loadProtection(true, file({ protect: false }))).toBe(false);
    expect(isProtected()).toBe(false);
  });

  it('lets the deployment turn protection on outside production', async () => {
    expect(await loadProtection(false, file({ protect: true }))).toBe(true);
  });

  it('ignores a file it cannot read, such as the app page served for a missing file', async () => {
    const html = () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('not json')) } as Response);
    expect(await loadProtection(true, html)).toBe(true);
    expect(await loadProtection(true, () => Promise.reject(new Error('offline')))).toBe(true);
  });
});
