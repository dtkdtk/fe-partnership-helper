type Fn<T> = (queue: T[]) => unknown;

export class TimedQueue<T = unknown> {
  queue: T[] = [];
  timer?: NodeJS.Timeout;
  /** called after drain */
  executor?: Fn<T>;

  constructor(public timeoutMs: number) {}

  add(data: T) {
    this.queue.push(data);
    this.timer ??= setTimeout(() => this.drain(), this.timeoutMs);
  }
  
  drain() {
    this.timer = undefined;
    this.executor?.(this.queue);
  }

  restart() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.drain(), this.timeoutMs);
  }
}
