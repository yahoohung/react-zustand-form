export type FlushStrategy = 'raf' | 'microtask' | 'immediate';

type FlushFn = () => void;

type Scheduler = (flush: FlushFn) => () => void;

function createRafScheduler(): Scheduler {
  return (flush) => {
    let scheduled = false;
    const request = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : null;
    const trigger = () => {
      scheduled = false;
      flush();
    };
    return () => {
      if (scheduled) return;
      scheduled = true;
      if (request) {
        request(trigger as FrameRequestCallback);
        return;
      }
      setTimeout(trigger, 0);
    };
  };
}

function createMicrotaskScheduler(): Scheduler {
  return (flush) => {
    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        flush();
      });
    };
  };
}

function createImmediateScheduler(): Scheduler {
  return (flush) => {
    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        flush();
      }, 0);
    };
  };
}

export function createFlushScheduler(strategy: FlushStrategy, flush: FlushFn) {
  const factory =
    strategy === 'raf' ? createRafScheduler()
    : strategy === 'microtask' ? createMicrotaskScheduler()
    : createImmediateScheduler();
  return factory(flush);
}
