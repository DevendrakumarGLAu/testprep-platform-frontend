import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotifyService } from '../../../core/notify.service';
import { QuestionForm } from './question-form';
import { QuestionBankService } from './qb.service';

describe('QuestionForm languages', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<QuestionForm>>;
  let c: QuestionForm;
  let api: { saveQuestion: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { saveQuestion: vi.fn(() => of({ id: 1 })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/questions', children: [] }]),
        {
          provide: QuestionBankService,
          useValue: { saveQuestion: api.saveQuestion, subjects: () => of({ results: [{ id: 1, name: 'Maths', is_active: true }] }), topics: () => of({ results: [] }), checkDuplicates: () => of([]) },
        },
      ],
    });
    fixture = TestBed.createComponent(QuestionForm);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fill = (field: 'text' | 'text_hi', stem: string, opts: string[]) => {
    c.form.controls[field].setValue(stem);
    opts.forEach((v, i) => c.options.at(i).controls[field].setValue(v));
  };

  it('asks for at least one language', () => {
    expect(c.languageProblem()).toContain('English, Hindi, or both');
    c.save();
    expect(api.saveQuestion).not.toHaveBeenCalled();
  });

  it('accepts a question written only in Hindi', () => {
    fill('text_hi', 'प्रश्न', ['क', 'ख', 'ग', 'घ']);
    expect(c.status('hi')).toBe('complete');
    expect(c.status('en')).toBe('empty');
    expect(c.languageProblem()).toBe('');
  });

  it('does not accept a half-written language', () => {
    fill('text', 'Question', ['a', 'b', 'c', 'd']);
    c.form.controls.text_hi.setValue('प्रश्न');
    expect(c.status('hi')).toBe('incomplete');
    expect(c.languageProblem()).toContain('Hindi version is unfinished');
  });

  it('sends both languages when saving', () => {
    fill('text', 'Question', ['a', 'b', 'c', 'd']);
    fill('text_hi', 'प्रश्न', ['क', 'ख', 'ग', 'घ']);
    c.form.patchValue({ subject: 1 });
    c.setCorrect(0);
    c.save();
    const body = api.saveQuestion.mock.calls[0][0];
    expect(body.text_hi).toBe('प्रश्न');
    expect(body.options.map((o: { text_hi: string }) => o.text_hi)).toEqual(['क', 'ख', 'ग', 'घ']);
  });
});


describe('QuestionForm picture', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<QuestionForm>>;
  let c: QuestionForm;
  let api: { uploadImage: ReturnType<typeof vi.fn>; removeImage: ReturnType<typeof vi.fn> };
  let error: ReturnType<typeof vi.fn>;

  const file = (type: string, size = 100, name = 'fig') => new File([new Uint8Array(size)], name, { type });

  function open(id?: string) {
    api = { uploadImage: vi.fn(() => of({ id: 5, image_url: 'https://cdn.example/storage/questions/new.png' })), removeImage: vi.fn(() => of({})) };
    error = vi.fn();
    const existing = {
      id: 5, text: 'Q', text_hi: '', options: [{ text: 'a', text_hi: '', is_correct: true }, { text: 'b', text_hi: '', is_correct: false }],
      tags: [], subject: 1, topic: null, difficulty: 'medium', marks: '1', negative_marks: '0', explanation: '', explanation_hi: '',
      is_active: true, review_status: 'approved', image_url: null, question_date: null,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/questions', children: [] }]),
        { provide: NotifyService, useValue: { error, success: vi.fn() } },
        {
          provide: QuestionBankService,
          useValue: {
            ...api, saveQuestion: vi.fn(() => of({ id: 1 })), subjects: () => of({ results: [{ id: 1, name: 'Maths', is_active: true }] }),
            topics: () => of({ results: [] }), checkDuplicates: () => of([]), question: vi.fn(() => of(existing)), getQuestion: vi.fn(() => of(existing)),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(QuestionForm);
    if (id) fixture.componentRef.setInput('id', id);
    c = fixture.componentInstance;
    fixture.detectChanges();
  }

  const paste = (files: File[]) => {
    const ev = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(ev, 'clipboardData', { value: { files } });
    document.dispatchEvent(ev);
    return ev;
  };

  it('only offers real picture types in the file chooser', () => {
    open();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp,image/gif');
    expect(fixture.nativeElement.textContent).toContain('You can also paste a screenshot with Ctrl+V');
  });

  it('a pasted screenshot is uploaded for a question that already exists', () => {
    open('5');
    const f = file('image/png');
    const ev = paste([f]);
    expect(api.uploadImage).toHaveBeenCalledWith(5, f);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('a pasted screenshot on a new question waits and is shown as a preview until the question is saved', () => {
    open();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    paste([file('image/png')]);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(c.pendingPreview()).toBe('blob:preview');
  });

  it('pasting text, or anything that is not a picture, is left alone', () => {
    open('5');
    const ev = paste([file('text/plain')]);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    expect(paste([]).defaultPrevented).toBe(false);
  });

  it('refuses a picture of a type the server does not take', () => {
    open('5');
    c.pickImage({ target: { files: [file('image/bmp')], value: 'x' } } as unknown as Event);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Use a JPG, PNG, WebP or GIF picture.');
  });

  it('refuses a picture over 2 MB before sending it', () => {
    open('5');
    c.pickImage({ target: { files: [file('image/png', 2 * 1024 * 1024 + 1)], value: 'x' } } as unknown as Event);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Image must be 2 MB or smaller.');
  });

  it('shows the address the server gives back after an upload', () => {
    open('5');
    c.pickImage({ target: { files: [file('image/png')], value: 'x' } } as unknown as Event);
    expect(c.imageUrl()).toBe('https://cdn.example/storage/questions/new.png');
  });

  it('lets the same file be chosen again after it was picked', () => {
    open('5');
    const input = { files: [file('image/png')], value: 'C:\\fakepath\\fig.png' };
    c.pickImage({ target: input } as unknown as Event);
    expect(input.value).toBe('');
  });
});
