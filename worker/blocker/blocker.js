import { bookkeeping } from "./bookkeeping.js";
import { getRestrictedSites, isRestricted } from './restrictionsHandler.js'

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    let tab = await chrome.tabs.get(activeInfo.tabId)
    console.log("changes on this tab")
    if (!tab.url) return;
    let restrictedSites = await getRestrictedSites();
    let host = new URL(tab.url).host
    if (!restrictedSites.map(x => x.name).includes(host)) {
      bookkeeping('no-focus')
      return ;
    }
    bookkeeping('change-focus', activeInfo.tabId, host)
  })
  
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === -1) {
      bookkeeping('no-focus')
    } else {
      let [tab] = await chrome.tabs.query({ active: true });
      console.log("refocused window on following tab", tab)

      let restrictedSites = await getRestrictedSites();
      if (!tab.url || ["chrome://newtab/", "redirected/redirected.html"].includes(tab.url)) return ;

      let host = new URL(tab.url).host
      if (!restrictedSites.map(x => x.name).includes(host)) return ; 
      bookkeeping('change-focus', tab.tabId, host)
    }
  })
  
  // I don't check onCreated since the url or pending are generally set through onUpdated.
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      let changeUrl = changeInfo.pendingUrl || changeInfo.url;
      let changeAudible = 'audible' in changeInfo
      if (!changeUrl && !changeAudible) { 
        console.log("useless event", changeInfo) 
        return ; 
      }
      if (["chrome://newtab/", "redirected/redirected.html"].includes(changeUrl)) {
        console.log("don't care about those url")
        return ; 
      }
  
      console.log("update", tabId, changeInfo, tab, new Date())
      let flag = 'open';
      let restrictedSites = await getRestrictedSites();
      if (!restrictedSites) return ;
      
      console.log("found sites");
      let url = changeUrl || tab.url;
      if (!url) return;
      
      let host = new URL(url).host;
      console.log("got url", host);
      if (!restrictedSites.map(x => x.name).includes(host)) return ;
  
      if (await isRestricted(host, restrictedSites)) {
        bookkeeping('close', tabId, host);
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.ready) { sendResponse({url : url, host : host}) }
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
      bookkeeping(flag, tabId, host);
  });
  

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => { 
    console.log("tab has been removed")
    console.log(tabId, removeInfo)
    bookkeeping('close', tabId)
   })


  