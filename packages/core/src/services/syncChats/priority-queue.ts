/**
 * 通用优先级队列实现
 */
export class PriorityQueue<T> {
  private items: T[] = []
  private comparator: (a: T, b: T) => number

  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator
  }

  push(item: T): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): T | undefined {
    if (this.isEmpty()) {
      return undefined
    }

    const result = this.items[0]
    const last = this.items.pop()!

    if (this.items.length > 0) {
      this.items[0] = last
      this.bubbleDown(0)
    }

    return result
  }

  peek(): T | undefined {
    return this.items[0]
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  size(): number {
    return this.items.length
  }

  contains(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate)
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.comparator(this.items[index], this.items[parentIndex]) >= 0) {
        break
      }
      this.swap(index, parentIndex)
      index = parentIndex
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let smallest = index
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2

      if (
        leftChild < this.items.length
        && this.comparator(this.items[leftChild], this.items[smallest]) < 0
      ) {
        smallest = leftChild
      }

      if (
        rightChild < this.items.length
        && this.comparator(this.items[rightChild], this.items[smallest]) < 0
      ) {
        smallest = rightChild
      }

      if (smallest === index) {
        break
      }

      this.swap(index, smallest)
      index = smallest
    }
  }

  private swap(i: number, j: number): void {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]]
  }
}
