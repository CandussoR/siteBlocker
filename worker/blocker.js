import { bookkeepingQueue } from './bookkeepingQueue.js'

export async function processOrEnqueue(flag, tabId = undefined, host = undefined) {
  if (bookkeepingQueue.lastEvent === "no-focus" && flag === "no-focus")
    return ;
  
  bookkeepingQueue.addToQueue({ flag : flag, tabId : tabId, host : host})

  let {busy} = await chrome.storage.local.get('busy')

  if (!busy && (bookkeepingQueue.queue.length > 0 || bookkeepingQueue.lastEvent === null)) {
    bookkeepingQueue.dequeue()
    return;
  } else {
    setTimeout(() => bookkeepingQueue.dequeue(), 1500)
  }
}

