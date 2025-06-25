import { bookkeeping } from "./bookkeeping.js";
import { logger } from "./logger.js";

class BookkeepingQueue {
    constructor() {
        this.queue = []
        this.lastEvent = null
    }

    addToQueue(bookkeepingParams) {
        if (this.lastEvent === 'no-focus' && bookkeepingParams.flag === 'no-focus') return;
        this.queue.push(bookkeepingParams);
        // logger.debug("this is now queue", this.queue)
    }

    async dequeue() {
        if (this.queue.length === 0) return;

        let {busy} = await chrome.storage.local.get("busy")
        if (busy) {
            // logger.debug("setting a TimeOut for dequeue")
            setTimeout(() => {
                logger.debug("TimeOut for dequeue activated")
                this.dequeue()
            }, 1500)
            return;
        }

        await chrome.storage.local.set({busy : true});

        while (this.queue.length !== 0) {
            logger.debug("DEQUEUING ALL EVENTS")
            let {flag, tabId, host} = this.queue.shift();
            logger.debug(`dequeuing ${flag} for tabId ${tabId} with host ${host}`, 
                `last event is ${this.lastEvent}`)
            this.lastEvent = flag;
            if (this.lastEvent === "no-focus" && flag === "no-focus") continue;
            await bookkeeping(flag, tabId, host)
        }

        await chrome.storage.local.set({busy : false})
      }
  }

export let bookkeepingQueue = new BookkeepingQueue();

