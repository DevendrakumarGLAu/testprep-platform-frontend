import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
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
