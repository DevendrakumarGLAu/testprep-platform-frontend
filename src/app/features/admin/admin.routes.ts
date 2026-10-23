import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards';
import { Shell } from '../../layout/shell';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'profile', loadComponent: () => import('../profile/profile').then((m) => m.Profile) },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'users',
        loadComponent: () => import('./users/user-list').then((m) => m.UserList),
      },
      {
        path: 'students',
        loadComponent: () => import('./students/student-list').then((m) => m.StudentList),
      },
      {
        path: 'students/:id',
        loadComponent: () => import('./students/student-profile').then((m) => m.StudentProfile),
      },
      {
        path: 'subjects',
        loadComponent: () => import('./question-bank/subjects-topics').then((m) => m.SubjectsTopics),
      },
      {
        path: 'notifications',
        loadComponent: () => import('../notifications/notifications-page').then((m) => m.NotificationsPage),
      },
      {
        path: 'announcements',
        loadComponent: () => import('./content/announcements').then((m) => m.Announcements),
      },
      {
        path: 'insights',
        loadComponent: () => import('./insights/insights').then((m) => m.InsightsPage),
      },
      {
        path: 'study-notes',
        loadComponent: () => import('./content/study-notes').then((m) => m.StudyNotes),
      },
      {
        path: 'test-series',
        loadComponent: () => import('./content/test-series').then((m) => m.TestSeriesPage),
      },
      {
        path: 'question-reports',
        loadComponent: () => import('./question-bank/question-reports').then((m) => m.QuestionReports),
      },
      {
        path: 'questions',
        loadComponent: () => import('./question-bank/question-list').then((m) => m.QuestionList),
      },
      {
        path: 'questions/new',
        loadComponent: () => import('./question-bank/question-form').then((m) => m.QuestionForm),
      },
      {
        path: 'questions/import',
        loadComponent: () => import('./imports/import-wizard').then((m) => m.ImportWizard),
      },
      {
        path: 'questions/:id',
        loadComponent: () => import('./question-bank/question-form').then((m) => m.QuestionForm),
      },
      {
        path: 'tests',
        loadComponent: () => import('./exams/exam-list').then((m) => m.ExamList),
      },
      {
        path: 'tests/new',
        loadComponent: () => import('./exams/exam-form').then((m) => m.ExamForm),
      },
      {
        path: 'tests/:id/results',
        loadComponent: () => import('./exams/exam-results').then((m) => m.ExamResults),
      },
      {
        path: 'attempts/:id',
        loadComponent: () => import('./exams/attempt-review').then((m) => m.AttemptReview),
      },
      {
        path: 'tests/:id/preview',
        loadComponent: () => import('./exams/exam-preview').then((m) => m.ExamPreviewPage),
      },
      {
        path: 'tests/:id',
        loadComponent: () => import('./exams/exam-form').then((m) => m.ExamForm),
      },
      {
        path: 'exams',
        loadComponent: () => import('./exams/exam-catalogue').then((m) => m.ExamCatalogue),
      },
      {
        path: 'batches',
        loadComponent: () => import('./exams/batches').then((m) => m.Batches),
      },
      {
        path: 'settings',
        canActivate: [roleGuard('super_admin')],
        loadComponent: () => import('./platform-settings').then((m) => m.PlatformSettings),
      },
      {
        path: 'activity',
        canActivate: [roleGuard('super_admin')],
        loadComponent: () => import('./activity-log').then((m) => m.ActivityLogPage),
      },
    ],
  },
];
