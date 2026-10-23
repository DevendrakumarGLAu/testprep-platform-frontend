/**
 * Deterrents for the production build. They stop the usual ways of copying a question or opening the browser tools, but a
 * browser cannot truly lock them: the server must never rely on this (it does not; answers are checked and scored there).
 */
type Teardown = () => void;

const BLOCKED_KEYS = (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  return (
    e.key === 'F12' ||
    (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || // developer tools, inspector, console
    (mod && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) || // the same on macOS
    (mod && k === 'u') // view source
  );
};

/** Blocks the developer-tools shortcuts and the right-click menu across the whole app. */
export function protectApp(doc: Document, production: boolean): Teardown {
  if (!production) return () => undefined;
  const key = (e: KeyboardEvent) => BLOCKED_KEYS(e) && (e.preventDefault(), e.stopPropagation());
  const menu = (e: Event) => e.preventDefault();
  doc.addEventListener('keydown', key, true);
  doc.addEventListener('contextmenu', menu, true);
  return () => {
    doc.removeEventListener('keydown', key, true);
    doc.removeEventListener('contextmenu', menu, true);
  };
}

/** On the exam screen: no copying, cutting, selecting, dragging, printing or saving of the questions. */
export function protectExam(doc: Document, production: boolean): Teardown {
  if (!production) return () => undefined;
  const stop = (e: Event) => e.preventDefault();
  const key = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && ['c', 'x', 'a', 's', 'p'].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key === 'PrintScreen') doc.defaultView?.navigator.clipboard?.writeText('').catch(() => undefined);
  };
  const events = ['copy', 'cut', 'selectstart', 'dragstart'] as const;
  events.forEach((n) => doc.addEventListener(n, stop, true));
  doc.addEventListener('keydown', key, true);
  doc.body.classList.add('exam-locked');
  return () => {
    events.forEach((n) => doc.removeEventListener(n, stop, true));
    doc.removeEventListener('keydown', key, true);
    doc.body.classList.remove('exam-locked');
  };
}
