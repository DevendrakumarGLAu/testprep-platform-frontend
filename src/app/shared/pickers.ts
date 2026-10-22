const PICKER_TYPES = ['date', 'datetime-local', 'time'];

/** Opens the browser's own date/time picker. Falls back to focusing the field where that is not supported. */
export function openPicker(input: HTMLInputElement): void {
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}

/**
 * Makes a click anywhere on a date or time field open its picker, not only a click on the tiny built-in icon
 * (which some browsers hide or style away). Returns a function that removes the listener.
 */
export function installPickerOnClick(doc: Document): () => void {
  const handler = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && PICKER_TYPES.includes(t.type) && !t.disabled && !t.readOnly) openPicker(t);
  };
  doc.addEventListener('click', handler);
  return () => doc.removeEventListener('click', handler);
}
