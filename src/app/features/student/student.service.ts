import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ResultData } from '../../shared/result.models';
import {
  AnswerPatch, AttemptState, Dashboard, DailyQuizStatus, HistoryRow, LeaderboardData, LiveExam, PracticeStart, PrepExam, PrepHubData, PrepResponse,
  MyReport, SavedList, SavedQuestion, StudentExam, SubmitResponse, WeakTopic, WeakTopicsData, WeeklySummary, ReviseData,
} from './student.models';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/student`;

  saveQuestion(attemptId: string, number: number, note = '') {
    return this.http.post<SavedQuestion>(`${this.api}/attempts/${attemptId}/questions/${number}/save/`, { note });
  }

  unsaveQuestion(attemptId: string, number: number) {
    return this.http.delete<void>(`${this.api}/attempts/${attemptId}/questions/${number}/save/`);
  }

  saved(subject = '') {
    return this.http.get<SavedList>(`${this.api}/saved/`, { params: subject ? { subject } : {} });
  }

  updateSaved(id: number, note: string) {
    return this.http.patch<SavedQuestion>(`${this.api}/saved/${id}/`, { note });
  }

  deleteSaved(id: number) {
    return this.http.delete<void>(`${this.api}/saved/${id}/`);
  }

  /** With a picture the report goes as a form, without one as plain JSON. */
  reportQuestion(attemptId: string, number: number, reason: string, message: string, image: File | null = null) {
    let body: FormData | { reason: string; message: string } = { reason, message };
    if (image) {
      body = new FormData();
      body.append('reason', reason);
      body.append('message', message);
      body.append('image', image);
    }
    return this.http.post<{ id: number; status: string; updated: boolean; image_url: string | null }>(
      `${this.api}/attempts/${attemptId}/questions/${number}/report/`, body,
    );
  }

  myReports() {
    return this.http.get<{ results: MyReport[] }>(`${this.api}/reports/`);
  }

  weakTopics() {
    return this.http.get<WeakTopicsData>(`${this.api}/weak-topics/`);
  }

  practiceWeak(topics: Pick<WeakTopic, 'topic_id' | 'subject_id'>[], count: number) {
    return this.http.post<PracticeStart>(`${this.api}/practice/weak/`, { topics, count });
  }

  practiceMistakes(attemptId: string, includeUnanswered = true) {
    return this.http.post<PracticeStart>(`${this.api}/attempts/${attemptId}/practice-wrong/`, { include_unanswered: includeUnanswered });
  }

  revise(source: 'saved' | 'mistakes', limit = 20, exam = '') {
    return this.http.get<ReviseData>(`${this.api}/revise/`, { params: { source, limit, ...(exam ? { exam } : {}) } });
  }

  weeklySummary() {
    return this.http.get<WeeklySummary>(`${this.api}/weekly-summary/`);
  }

  dailyQuiz() {
    return this.http.get<DailyQuizStatus>(`${this.api}/daily-quiz/`);
  }

  startDailyQuiz() {
    return this.http.post<PracticeStart>(`${this.api}/daily-quiz/`, {});
  }

  leaderboard(examId: string) {
    return this.http.get<LeaderboardData>(`${this.api}/exams/${examId}/leaderboard/`);
  }

  dashboard() {
    return this.http.get<Dashboard>(`${this.api}/dashboard/`);
  }

  exams(filters: Record<string, string | number | null | undefined> = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<StudentExam[]>(`${this.api}/exams/`, { params });
  }

  prep() {
    return this.http.get<PrepResponse>(`${this.api}/prep/`);
  }

  setPrep(categoryIds: string[]) {
    return this.http.put<PrepResponse>(`${this.api}/prep/`, { category_ids: categoryIds });
  }

  hub(id: string) {
    return this.http.get<PrepHubData>(`${this.api}/prep/${id}/`);
  }

  filters() {
    return this.http.get<{ categories: { id: string; name: string; group?: { id: string; name: string } | null }[]; subjects: { id: number; name: string }[] }>(`${this.api}/filters/`);
  }

  /** The page behind a live test's share link; only for a signed-in student who may take the test. */
  live(id: string) {
    return this.http.get<LiveExam>(`${this.api}/live/${id}/`);
  }

  exam(id: string) {
    return this.http.get<StudentExam>(`${this.api}/exams/${id}/`);
  }

  start(examId: string) {
    return this.http.post<{ attempt_id: number; created: boolean }>(`${this.api}/exams/${examId}/start/`, {});
  }

  attempt(id: string) {
    return this.http.get<AttemptState>(`${this.api}/attempts/${id}/`);
  }

  saveAnswers(id: string, answers: AnswerPatch[]) {
    return this.http.put<{ saved: number; ignored?: number; server_now: string; deadline: string; remaining_seconds: number }>(
      `${this.api}/attempts/${id}/answers/`,
      { answers },
    );
  }

  pause(id: string) {
    return this.http.post<AttemptState>(`${this.api}/attempts/${id}/pause/`, {});
  }

  resume(id: string) {
    return this.http.post<AttemptState>(`${this.api}/attempts/${id}/resume/`, {});
  }

  submitSection(id: string, order: number) {
    return this.http.post<AttemptState & { moved: boolean }>(`${this.api}/attempts/${id}/sections/submit/`, { order });
  }

  submit(id: string) {
    return this.http.post<SubmitResponse>(`${this.api}/attempts/${id}/submit/`, {});
  }

  result(id: string) {
    return this.http.get<ResultData>(`${this.api}/attempts/${id}/result/`);
  }

  history() {
    return this.http.get<HistoryRow[]>(`${this.api}/attempts/`);
  }
}
