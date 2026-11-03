import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CoachService } from '../coach.service';
import { AskDoubt } from './ask-doubt';

function open(askDoubt: unknown) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CoachService, useValue: { askDoubt } }] });
  const f = TestBed.createComponent(AskDoubt);
  f.componentRef.setInput('attemptId', 'att1');
  f.componentRef.setInput('number', 4);
  f.detectChanges();
  return f;
}

const type = (f: ReturnType<typeof open>, text: string) => {
  f.componentInstance.message = text;
  f.detectChanges();
};

const click = (f: ReturnType<typeof open>, label: string) => {
  const b = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((x) => x.textContent!.trim().startsWith(label));
  b!.click();
  f.detectChanges();
};

describe('AskDoubt', () => {
  it('names the question in its title', () => {
    expect(open(vi.fn()).nativeElement.textContent).toContain('Ask a doubt about question 4');
  });

  it('does not send a message that is too short', () => {
    const ask = vi.fn();
    const f = open(ask);
    type(f, 'why');
    click(f, 'Send doubt');
    expect(ask).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('at least 5 characters');
  });

  it('sends the message and then thanks the student with a link to the doubt', () => {
    const ask = vi.fn(() => of({ id: 17 }));
    const f = open(ask);
    type(f, '  Why is option B correct?  ');
    click(f, 'Send doubt');
    expect(ask).toHaveBeenCalledWith('att1', 4, 'Why is option B correct?');
    expect(f.nativeElement.textContent).toContain('Your doubt was sent');
    expect((f.nativeElement.querySelector('a[href="/student/doubts/17"]') as HTMLAnchorElement | null)).not.toBeNull();
  });

  it('shows the server\'s reason when it refuses', () => {
    const f = open(vi.fn(() => throwError(() => ({ error: { detail: 'You already have 10 doubts waiting for an answer.' } }))));
    type(f, 'Please explain this one');
    click(f, 'Send doubt');
    expect(f.nativeElement.textContent).toContain('already have 10 doubts');
    expect(f.nativeElement.textContent).not.toContain('Your doubt was sent');
  });

  it('asks its page to close when Cancel is pressed', () => {
    const f = open(vi.fn());
    const closed = vi.fn();
    f.componentInstance.closed.subscribe(closed);
    click(f, 'Cancel');
    expect(closed).toHaveBeenCalled();
  });
});
