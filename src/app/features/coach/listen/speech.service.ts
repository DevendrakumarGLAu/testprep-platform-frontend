import { Injectable, NgZone, inject, signal } from '@angular/core';

export interface Clip {
  /** What to say. */
  text: string;
  /** hi or en: picks the voice. */
  lang: 'hi' | 'en';
}

/** A spoken sentence is kept short because some phones stop a long one after about fifteen seconds. */
export const MAX_CHUNK = 180;

/** Splits a text into pieces short enough to speak safely, at sentence ends where it can. */
export function chunks(text: string, max = MAX_CHUNK): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?।])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    let rest = part;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(',', max);
      if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
      if (cut < max / 2) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * Reads a playlist of clips aloud with the browser's own text-to-speech (nothing is sent to a server), so it works for Hindi on
 * most phones that have a Hindi voice installed. It can pause, skip, and change speed, and it shows the controls on the phone's
 * lock screen through the Media Session API where the browser supports it.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private zone = inject(NgZone);
  private synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

  readonly supported = !!this.synth && typeof SpeechSynthesisUtterance !== 'undefined';
  readonly hasHindiVoice = signal(false);
  readonly playing = signal(false);
  readonly paused = signal(false);
  readonly index = signal(0);
  readonly rate = signal(1);

  private playlist: Clip[] = [];
  private token = 0; // changes whenever playback is restarted or stopped, so a late "ended" event from the old run is ignored
  private titleOf: (i: number) => string = () => 'Explanation';
  private onItem: ((i: number) => void) | null = null;

  constructor() {
    if (!this.synth) return;
    const update = () => this.hasHindiVoice.set(this.voices().some((v) => v.lang.toLowerCase().startsWith('hi')));
    update();
    this.synth.addEventListener?.('voiceschanged', update);
  }

  private voices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? [];
  }

  private voiceFor(lang: 'hi' | 'en'): SpeechSynthesisVoice | undefined {
    const all = this.voices();
    if (lang === 'hi') return all.find((v) => v.lang.toLowerCase().startsWith('hi'));
    return all.find((v) => v.lang.toLowerCase() === 'en-in') ?? all.find((v) => v.lang.toLowerCase().startsWith('en'));
  }

  /** Starts a playlist from item `start`. `title` names the item on the lock screen; `onItem` is told when each item starts. */
  start(clips: Clip[][], start = 0, title: (i: number) => string = () => 'Explanation', onItem: ((i: number) => void) | null = null) {
    if (!this.synth) return;
    this.stop();
    this.items = clips;
    this.titleOf = title;
    this.onItem = onItem;
    this.index.set(Math.max(0, Math.min(start, clips.length - 1)));
    this.playing.set(true);
    this.paused.set(false);
    this.setupMediaSession();
    this.playItem();
  }

  private items: Clip[][] = [];

  private playItem() {
    const i = this.index();
    const clips = this.items[i];
    if (!clips) {
      this.finish();
      return;
    }
    const token = ++this.token;
    this.onItem?.(i);
    this.updateMediaSession(i);
    this.playlist = clips.flatMap((c) => chunks(c.text).map((t) => ({ text: t, lang: c.lang })));
    this.speakPart(0, token);
  }

  private speakPart(part: number, token: number) {
    if (token !== this.token || !this.synth) return;
    const clip = this.playlist[part];
    if (!clip) {
      this.zone.run(() => this.next(true));
      return;
    }
    const u = new SpeechSynthesisUtterance(clip.text);
    const voice = this.voiceFor(clip.lang);
    u.lang = voice?.lang ?? (clip.lang === 'hi' ? 'hi-IN' : 'en-IN');
    if (voice) u.voice = voice;
    u.rate = this.rate();
    u.onend = () => this.speakPart(part + 1, token);
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.speakPart(part + 1, token); // skip a piece that cannot be spoken rather than stopping the whole list
    };
    this.synth.speak(u);
  }

  pause() {
    if (!this.playing() || this.paused()) return;
    this.synth?.pause();
    this.paused.set(true);
    this.setState('paused');
  }

  resume() {
    if (!this.playing() || !this.paused()) return;
    this.synth?.resume();
    this.paused.set(false);
    this.setState('playing');
  }

  toggle() {
    if (this.paused()) this.resume();
    else this.pause();
  }

  /** Next item. `auto` is true when the previous one simply finished. */
  next(auto = false) {
    if (!this.playing()) return;
    if (this.index() >= this.items.length - 1) {
      if (auto) this.finish();
      return;
    }
    this.synth?.cancel();
    this.index.update((n) => n + 1);
    this.paused.set(false);
    this.playItem();
  }

  previous() {
    if (!this.playing()) return;
    this.synth?.cancel();
    this.index.update((n) => Math.max(0, n - 1));
    this.paused.set(false);
    this.playItem();
  }

  /** A new speed takes effect from the next sentence. */
  setRate(rate: number) {
    this.rate.set(rate);
  }

  stop() {
    this.token++;
    this.synth?.cancel();
    this.playing.set(false);
    this.paused.set(false);
    this.clearMediaSession();
  }

  private finish() {
    this.token++;
    this.playing.set(false);
    this.paused.set(false);
    this.clearMediaSession();
  }

  // ---- lock screen controls (where the browser has them) ----
  private session(): MediaSession | null {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
  }

  private setupMediaSession() {
    const s = this.session();
    if (!s) return;
    const set = (action: MediaSessionAction, fn: () => void) => {
      try {
        s.setActionHandler(action, () => this.zone.run(fn));
      } catch {
        /* this browser does not support that button */
      }
    };
    set('play', () => this.resume());
    set('pause', () => this.pause());
    set('nexttrack', () => this.next());
    set('previoustrack', () => this.previous());
  }

  private updateMediaSession(i: number) {
    const s = this.session();
    if (!s || typeof MediaMetadata === 'undefined') return;
    s.metadata = new MediaMetadata({ title: this.titleOf(i), artist: 'TestPrep audio revision' });
    s.playbackState = 'playing';
  }

  private setState(state: MediaSessionPlaybackState) {
    const s = this.session();
    if (s) s.playbackState = state;
  }

  private clearMediaSession() {
    const s = this.session();
    if (!s) return;
    s.playbackState = 'none';
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]) {
      try {
        s.setActionHandler(a, null);
      } catch {
        /* nothing to clear */
      }
    }
  }
}
