/** Simple object pool to keep late waves smooth. */

export class Pool<T> {
  private free: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (item: T) => void;

  constructor(factory: () => T, reset: (item: T) => void, initial = 32) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initial; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T {
    const item = this.free.pop() ?? this.factory();
    this.reset(item);
    return item;
  }

  release(item: T): void {
    this.free.push(item);
  }

  releaseAll(items: T[]): void {
    for (const item of items) this.release(item);
    items.length = 0;
  }
}
