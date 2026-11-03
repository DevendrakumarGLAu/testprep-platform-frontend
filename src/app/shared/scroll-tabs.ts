/**
 * Lets the tab headers be moved like any scrolling strip: the mouse wheel scrolls them sideways, a mouse can drag them, and touch
 * swipes natively (see styles.scss). A chosen tab is brought into view. One set of listeners on the document covers every tab group.
 */
export function scrollableTabs(doc: Document) {
  const strip = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('.mat-mdc-tab-label-container') as HTMLElement | null;

  doc.addEventListener(
    'wheel',
    (e) => {
      const el = strip(e.target);
      if (!el || el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );

  let drag: { el: HTMLElement; x: number; left: number; moved: boolean } | null = null;
  doc.addEventListener('pointerdown', (e) => {
    const el = strip(e.target);
    if (el && e.pointerType === 'mouse' && e.button === 0) drag = { el, x: e.clientX, left: el.scrollLeft, moved: false };
  });
  doc.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) drag.moved = true;
    if (drag.moved) drag.el.scrollLeft = drag.left - dx;
  });
  const end = () => setTimeout(() => (drag = null));
  doc.addEventListener('pointerup', end);
  doc.addEventListener('pointercancel', end);
  // A drag must not count as a click on the tab it ended on.
  doc.addEventListener('click', (e) => { if (drag?.moved) { e.stopPropagation(); e.preventDefault(); } }, true);

  doc.addEventListener('click', () =>
    setTimeout(() => doc.querySelectorAll<HTMLElement>('.mat-mdc-tab-header [aria-selected="true"]').forEach((t) => t.scrollIntoView({ block: 'nearest', inline: 'nearest' })), 50),
  );
}
