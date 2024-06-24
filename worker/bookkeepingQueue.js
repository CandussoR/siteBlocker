import { bookkeeping } from "./bookkeeping.js";

class BookkeepingQueue {
    constructor() {
        console.log("initialising the Queue object")
        this.queue = []
        this.lastEvent = null
    }

    addToQueue(bookkeepingParams) {
        if (this.lastEvent === 'no-focus' && bookkeepingParams.flag === 'no-focus') return;
        this.queue.push(bookkeepingParams);
    }

    async dequeue() {
        if (this.queue.length === 0) return;

        await chrome.storage.local.set({busy : true});

        while (this.queue.length !== 0) {
            let {flag, tabId, host} = this.queue.shift();
            this.lastEvent = flag;
            if (this.lastEvent === "no-focus" && flag === "no-focus") continue;
            await bookkeeping(flag, tabId, host)
        }

        await chrome.storage.local.set({busy : false})
      }
  }

export let bookkeepingQueue = new BookkeepingQueue();

