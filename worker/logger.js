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
    console.log("logger created")
  }

  debug(data) {
    this.queue.enqueue(
      new QueueNode(
        `[${new Intl.DateTimeFormat("fr-FR").format(
          new Date()
        )} : DEBUG]\n${JSON.stringify(data)}`
      )
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  info(data) {
    this.queue.enqueue(
      new QueueNode(
        `[${new Intl.DateTimeFormat("fr-FR").format(
          new Date()
        )} : INFO]\n${JSON.stringify(data)}`
      )
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  warning(data) {
    this.queue.enqueue(
      new QueueNode(
        `[${new Intl.DateTimeFormat("fr-FR").format(
          new Date()
        )} : WARNING]\n${JSON.stringify(data)}`
      )
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  error(data) {
    this.queue.enqueue(
      new QueueNode(
        `[${new Intl.DateTimeFormat("fr-FR").format(
          new Date()
        )} : ERROR]\n${JSON.stringify(data)}`
      )
    );
    if (!this.timeoutId) {
        this.timeoutId = setTimeout(async () => await this.flush(), 3000)
    }
  }

  async flush() {
    if (!this.queue.size) {
      return;
    }
    
    console.log("writing logger")
    const { logs = [] } = await chrome.storage.local.get("logs");
    while (this.queue.size) {
      logs.push(this.queue.dequeue());
    }
    await chrome.storage.local.set({ logs: logs });

    this.timeoutId = null
  }
}

export let logger = new Logger();