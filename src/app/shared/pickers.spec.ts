import { vi } from 'vitest';
import { installPickerOnClick, openPicker } from './pickers';

function field(type: string, over: Partial<HTMLInputElement> = {}) {
  const input = document.createElement('input');
  input.type = type;
  Object.assign(input, over);
  document.body.appendChild(input);
  return input;
}

describe('date picker helpers', () => {
  let remove: () => void;
  let showPicker: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showPicker = vi.fn();
    (HTMLInputElement.prototype as unknown as { showPicker: unknown }).showPicker = showPicker;
    remove = installPickerOnClick(document);
  });

  afterEach(() => {
    remove();
    document.body.innerHTML = '';
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
  });

  it('opens the picker when a date, date-time or time field is clicked anywhere', () => {
    for (const type of ['date', 'datetime-local', 'time']) field(type).click();
    expect(showPicker).toHaveBeenCalledTimes(3);
  });

  it('ignores ordinary fields, disabled fields and read-only fields', () => {
    field('text').click();
    field('password').click();
    field('date', { disabled: true }).click();
    field('date', { readOnly: true }).click();
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('stops listening once removed', () => {
    remove();
    field('date').click();
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('openPicker calls showPicker', () => {
    openPicker(field('date'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('openPicker falls back to focusing the field when the browser refuses or cannot show a picker', () => {
    const input = field('datetime-local');
    const focus = vi.spyOn(input, 'focus');
    showPicker.mockImplementation(() => {
      throw new DOMException('not allowed', 'NotAllowedError');
    });
    expect(() => openPicker(input)).not.toThrow();
    expect(focus).toHaveBeenCalled();

    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker'); // an older browser
    const other = field('date');
    const focusOther = vi.spyOn(other, 'focus');
    expect(() => openPicker(other)).not.toThrow();
    expect(focusOther).toHaveBeenCalled();
  });
});
