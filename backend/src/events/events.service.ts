import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type UserEvent =
  | { type: 'progress'; courseId: number }
  | { type: 'day'; day: number }
  | { type: 'profile' }
  | { type: 'sessions' }
  | { type: 'notes'; id: string }
  | { type: 'account-deleted' };

interface Stream {
  sessionId: string;
  subject: Subject<UserEvent>;
}

// In-process pub/sub for Server-Sent Events. Events only say *what* changed;
// clients refetch through the normal authorized endpoints.
// Running several API instances? Swap this for Postgres LISTEN/NOTIFY or Redis.
@Injectable()
export class EventsService {
  private readonly streams = new Map<string, Set<Stream>>();

  open(userId: string, sessionId: string) {
    const stream: Stream = { sessionId, subject: new Subject<UserEvent>() };
    if (!this.streams.has(userId)) this.streams.set(userId, new Set());
    this.streams.get(userId)!.add(stream);
    const close = () => {
      const set = this.streams.get(userId);
      set?.delete(stream);
      if (set?.size === 0) this.streams.delete(userId);
    };
    return { events: stream.subject.asObservable(), close };
  }

  emit(userId: string, event: UserEvent) {
    this.streams.get(userId)?.forEach((s) => s.subject.next(event));
  }

  // Ends the live stream of a revoked session.
  closeSession(userId: string, sessionId: string) {
    this.streams.get(userId)?.forEach((s) => { if (s.sessionId === sessionId) s.subject.complete(); });
  }

  closeUser(userId: string) {
    this.streams.get(userId)?.forEach((s) => s.subject.complete());
  }
}
