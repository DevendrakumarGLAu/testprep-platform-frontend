/** A picture of a student's score to share with friends: drawn on a canvas in the browser, never sent to a server. */

export interface ShareCardData {
  platform: string;
  title: string;
  score: string;
  totalMarks: string;
  percent: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  rank?: number | null;
  participants?: number | null;
}

export const CARD_SIZE = 1080;

/** The lines of text on the card, top to bottom (kept separate from drawing so they can be checked without a canvas). */
export function cardLines(d: ShareCardData): { text: string; size: number; weight: number; color: string }[] {
  const lines = [
    { text: d.platform, size: 44, weight: 700, color: '#ffffff' },
    { text: d.title, size: 56, weight: 600, color: '#ffffff' },
    { text: `${d.score} / ${d.totalMarks}`, size: 200, weight: 800, color: '#ffffff' },
    { text: d.percent === null ? 'marks' : `${d.percent}% score`, size: 54, weight: 500, color: '#cfe0ff' },
  ];
  if (d.rank && d.participants) lines.push({ text: `Rank #${d.rank} of ${d.participants}`, size: 60, weight: 700, color: '#ffd54f' });
  lines.push({ text: `${d.correct} correct · ${d.incorrect} wrong · ${d.unanswered} skipped`, size: 42, weight: 500, color: '#ffffff' });
  return lines;
}

/** Draws the card on a 2D canvas context. */
export function drawCard(ctx: CanvasRenderingContext2D, d: ShareCardData, size = CARD_SIZE) {
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#1a73e8');
  grad.addColorStop(1, '#0b3d91');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = cardLines(d);
  const gaps = [150, 130, 120, 110, 100, 100];
  let y = 140;
  lines.forEach((l, i) => {
    ctx.fillStyle = l.color;
    ctx.font = `${l.weight} ${l.size}px Roboto, Arial, sans-serif`;
    ctx.fillText(l.text, size / 2, y, size - 120);
    y += i === 2 ? 190 : gaps[Math.min(i + 1, gaps.length - 1)];
  });
}

export function cardFileName(d: ShareCardData): string {
  return `${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'score'}-score.png`;
}

/** Shares the card through the phone's share sheet when it can, and otherwise downloads the picture. */
export async function shareCard(d: ShareCardData): Promise<'shared' | 'downloaded' | 'failed'> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'failed';
  drawCard(ctx, d);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], cardFileName(d), { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: `${d.title}: ${d.score} / ${d.totalMarks}` });
      return 'shared';
    } catch {
      return 'failed'; // the person closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
