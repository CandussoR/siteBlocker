import { getRestrictedSites, isRestricted } from './restrictionsHandler.js'
import { bookkeeping } from './bookkeeping.js'

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
          console.log("flag of dequeuing item is", flag)
          this.lastEvent = flag;
          if (this.lastEvent === "no-focus" && flag === "no-focus") continue;
          await bookkeeping(flag, tabId, host)
      }

      await chrome.storage.local.set({busy : false})
    } 
}

export const bookkeepingQueue = new BookkeepingQueue()

async function processOrEnqueue(flag, tabId = undefined, host = undefined) {
  bookkeepingQueue.addToQueue({ flag : flag, tabId : tabId, host : host})

  let {busy} = await chrome.storage.local.get('busy')

  if (!busy && (bookkeepingQueue.queue.length > 0 || bookkeepingQueue.lastEvent === null)) {
    bookkeepingQueue.dequeue({ flag : flag, tabId : tabId, host : host})
    return;
  }
}

// Fires when the active tab in a window changes.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    let tab = await chrome.tabs.get(activeInfo.tabId)
    console.log("changes on this tab")
    if (!tab.url) return;
    let restrictedSites = await getRestrictedSites();
    let host = new URL(tab.url).host
    if (!restrictedSites.map(x => x.name).includes(host)) {
      await processOrEnqueue('no-focus')
      return ;
    }
    await processOrEnqueue('change-focus', activeInfo.tabId, host)
  })
  
  // Fires if window is focused or not
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === -1) {
      await processOrEnqueue('no-focus')
    } else {
      let [tab] = await chrome.tabs.query({ active: true });
      console.log("refocused window on following tab", tab)

      let restrictedSites = await getRestrictedSites();
      if (!tab.url || ["chrome://newtab/", "redirected/redirected.html"].includes(tab.url)) return ;

      let host = new URL(tab.url).host
      if (!restrictedSites.map(x => x.name).includes(host)) return ; 
      await processOrEnqueue('change-focus', tab.tabId, host)
    }
  })
  
  // I don't check onCreated since the url or pending are generally set through onUpdated.
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      let changeUrl = changeInfo.pendingUrl || changeInfo.url;
      let changeAudible = 'audible' in changeInfo
      if (!changeUrl && !changeAudible) { 
        return ; 
      }
      if (["chrome://newtab/", "redirected/redirected.html"].includes(changeUrl)) {
        return ; 
      }
  
      console.log("update", tabId, changeInfo, tab, new Date())
      let flag = 'open';
      let restrictedSites = await getRestrictedSites();
      if (!restrictedSites) return ;
      
      let url = changeUrl || tab.url;
      if (!url) return;
      
      let host = new URL(url).host;
      if (!restrictedSites.map(x => x.name).includes(host)) return ;
  
      if (await isRestricted(host, restrictedSites)) {
        await processOrEnqueue('close', tabId, host);
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.ready && sender.tab.id === tabId) { sendResponse({url : url, host : host}) }
        });
        chrome.tabs.update(tabId, {url : "redirected/redirected.html"});
        return;
      }
  
      if (changeInfo.audible === true) {
        console.log(changeInfo, "seems you began to play sth", tab.url);
        flag = 'audible-start';
      } else if (changeInfo.audible === false) {
        console.log(changeInfo, "seems you stop playing something", tab.url);
        flag = 'audible-end';
      }
  
      console.log("Okay, damn this never end, let me bookkeep that", new Date());
      await processOrEnqueue(flag, tabId, host);
  });
  

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => { 
    console.log("tab has been removed")
    console.log(tabId, removeInfo)
    await processOrEnqueue('close', tabId)
   })