import { DatePipe } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { DOUBT_LABEL, DoubtDetail } from '../coach.models';

/** One doubt as a conversation: the question the student asked about, then the messages in order. Used by students and teachers. */
@Component({
  selector: 'app-doubt-conversation',
  imports: [DatePipe],
  templateUrl: './doubt-conversation.html',
  styleUrl: './doubt-conversation.scss',
  host: { class: 'bs' },
})
export class DoubtConversation {
  doubt = input.required<DoubtDetail>();
  showExplanation = signal(false);
  protected label = DOUBT_LABEL;

  badge(status: string) {
    return status === 'resolved' ? 'text-bg-success' : status === 'answered' ? 'text-bg-primary' : 'text-bg-warning';
  }
}
