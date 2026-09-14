import type { RealtimeEvent, RealtimeEventType } from './realtimeTypes';

export type RealtimeEventHandler<T = unknown> = (event: RealtimeEvent<T>) => void;

export class RealtimeEventDispatcher {
  private readonly handlers = new Map<RealtimeEventType, Set<RealtimeEventHandler>>();

  register<T>(type: RealtimeEventType, handler: RealtimeEventHandler<T>) {
    const handlersForType = this.handlers.get(type) ?? new Set<RealtimeEventHandler>();
    handlersForType.add(handler as RealtimeEventHandler);
    this.handlers.set(type, handlersForType);

    return () => {
      handlersForType.delete(handler as RealtimeEventHandler);
      if (handlersForType.size === 0) this.handlers.delete(type);
    };
  }

  dispatch(event: RealtimeEvent) {
    this.handlers.get(event.type)?.forEach((handler) => handler(event));
  }

  clear() {
    this.handlers.clear();
  }
}

export const realtimeEventDispatcher = new RealtimeEventDispatcher();
