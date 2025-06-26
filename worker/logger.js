/**
 * Represets a node in a Queue
 */
export class QueueNode {
  /**
   * Create a QueueNode.
   * @param {any} content - The content to store in the node.
   */
  constructor(c) {
    this.content = c;
    this.next = null;
  }
}

class LogQueue {
  /*
   * Create a queue
   */
  constructor() {
    /** @type {QueueNode | null} */
    this.head = null;
    /** @type {Number} */
    this.size = 0;
  }

  /**
   * Add a node to the end of the queue.
   * @param {QueueNode} node - The node to add to the queue.
   */
  enqueue(node) {
    if (!this.head) {
      this.head = node;
      ++this.size;
      return;
    }

    let curr = this.head;
    while (curr.next) {
      curr = curr.next;
    }
    curr.next = node;
    ++this.size;
  }

  /**
   * Remove and return the node at the front of the queue.
   * @returns {QueueNode | null} The removed node, or null if the queue is empty.
   */
  dequeue() {
    if (!this.head) return null;

    const ret = this.head;
    this.head = this.head.next;
    --this.size;
    return ret.content;
  }
}

export class Logger {
  constructor() {
    this.queue = new LogQueue();
    this.timeoutId = null;
  }

  debug(...args) {
    let log = {level : "DEBUG",
      call : this.#getCallInfo(),
      timestamp : new Date().toLocaleString(),
      data : args.map(arg => typeof arg === "string" ? arg : this.#tryStringify(arg))
    }
    this.queue.enqueue(
      new QueueNode(log)
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  info(...args) {
    let log = {level : "INFO",
      call : this.#getCallInfo(),
      timestamp : new Date().toLocaleString(),
      data : args.map(arg => typeof arg === "string" ? arg : this.#tryStringify(arg))
    }
    this.queue.enqueue(
      new QueueNode(log)
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  warning(...args) {
    let log = {level : "WARNING",
      call : this.#getCallInfo(),
      timestamp : new Date().toLocaleString(),
      data : args.map(arg => typeof arg === "string" ? arg : this.#tryStringify(arg))
    }
    this.queue.enqueue(
      new QueueNode(log)
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  error(...args) {
    let log = {level : "ERROR",
      call : this.#getCallInfo(),
      timestamp : new Date().toLocaleString(),
      data : args.map(arg => typeof arg === "string" ? arg : this.#tryStringify(arg))
    }
    this.queue.enqueue(
      new QueueNode(log)
    )
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  async flush() {
    if (!this.queue.size) {
      this.timeoutId = null
      return;
    }
    
    const { logs = [] } = await chrome.storage.local.get("logs");

    // Pruning if > max_size
    if (logs.length > 300) {
      logs.splice(0, logs.length -1-200)
    }

    let counter = this.queue.size
    while (counter) {
      logs.push(this.queue.dequeue());
      --counter;
    }

    await chrome.storage.local.set({ logs: logs });

    if (this.queue.size) {
      this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    } else {
      this.timeoutId = null
    }
  }

  #tryStringify(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch(e) {
      return `[STRINGIFY ERROR : unserializable object]\n  ${e}`
    }
  }

  #getCallInfo() {
    const spliterr = new Error().stack?.split("\n")
    return spliterr[spliterr.length-1]
  }
}

export let logger = new Logger();