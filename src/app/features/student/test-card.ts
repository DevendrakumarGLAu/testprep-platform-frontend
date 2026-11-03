import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentExam } from './student.models';

const LABELS: Record<string, string> = {
  available: 'Available', upcoming: 'Upcoming', in_progress: 'In progress', completed: 'Completed', missed: 'Missed', locked: 'Premium',
};

@Component({
  selector: 'app-test-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './test-card.html',
  styleUrl: './test-card.scss',
  host: { class: 'bs' },
})
export class TestCard {
  exam = input.required<StudentExam>();
  label = () => LABELS[this.exam().status] ?? this.exam().status;
  typeLine = () => {
    const e = this.exam();
    return e.test_type === 'sectional' && e.subject_name ? `${e.subject_name} only`
      : e.test_type === 'previous_year' && e.year ? `Previous year ${e.year}` : e.test_type_label;
  };
}
