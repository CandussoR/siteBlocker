import { bookkeeping } from "./bookkeeping.js";

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


  async function getRestrictedSites() {
      let {sites = []} = await chrome.storage.local.get('sites')
      if (chrome.runtime.lastError) {
          console.error("An error occurred while fetching your settings.")
          return;
      }
      return sites
  }
  
  async function isRestricted(host, sites) {
      const sitesName = sites.map(x => x.name)
      console.log(sitesName, "sitesName")
  
      const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
      const currentTime = new Date().toLocaleTimeString('fr-FR')
      
      let siteIndex = sitesName.findIndex(x => x === host)
      let siteRestrictions = sites[siteIndex].restrictions
      let siteGroup = sites[siteIndex].group
  
      if (siteGroup) {
          let { groups = [] } = await chrome.storage.local.get('groups')
          let groupIndex = groups.findIndex(g => g.name === siteGroup)
          let groupRestrictions = groups[groupIndex].restrictions
          
          if (groupRestrictions) {
              let groupRestrictionsKeys = Object.keys(groupRestrictions)
              let siteRestrictionsKeys = siteRestrictions ? Object.keys(siteRestrictions) : []
                  
              let restricted = false;
  
              if (groupRestrictions.timeSlot) {
                console.log('yep timeslot')
                  let checkSite = siteRestrictionsKeys.includes('timeSlot')
                  restricted = checkTimeSlotRestriction(
                    currentDay,
                    currentTime,
                    groupRestrictions.timeSlot,
                    checkSite,
                    checkSite ? siteRestrictions.timeSlot : undefined
                  );
              }
              if (restricted) return restricted;
  
              if (groupRestrictions.totalTime) {
                console.log("It's not the time for a timeSlot or there is no timeSlot at all, lemme check totalTime")
                let checkSite = siteRestrictionsKeys.includes('totalTime')
                restricted = checkTotalTimeRestriction(currentDay, host, groupRestrictions.totalTime, checkSite, checkSite ? siteRestrictions.totalTime : undefined)
              }
              if (restricted) return restricted;
  
              return restricted
              }
          }
          
      if (siteRestrictions && siteRestrictions.timeSlot) { return checkSlots(siteRestrictions.timeSlot, currentDay, currentTime) }
      if (siteRestrictions && siteRestrictions.totalTime) {}
  
      return false
  }
  
  function checkTimeSlotRestriction(currentDay, currentTime, groupRestriction, checkSite, siteRestriction = undefined) {
    let result = checkSlots(groupRestriction, currentDay, currentTime);
    if (!result &&
        checkSite &&
        siteRestriction !== groupRestriction
    ) {
    result = checkSlots( siteRestriction, currentDay, currentTime);
    }
  
    return result
  }
  
  async function checkTotalTimeRestriction(currentDay, host, groupRestriction, checkSite, siteRestriction = undefined) {
  
      let date = new Date().toISOString().split('T')[0] ;
      let timeLeft = -1
      console.log("Let me get the records")
      let { records = {} } = await chrome.storage.local.get('records') ;
    
      let todayRecord = records[date]
      console.log("Today, today... got it")
      for (let i = 0; i < groupRestriction.length; i++) {
  
          if (!groupRestriction[i].days.includes(currentDay)) continue;
  
          console.log("There is a restriction on today, let me check the sites of this group.")
          let { sitesOfGroup = [] } = await chrome.storage.local.get('sites') ;
          sitesOfGroup = sitesOfGroup.filter(x => x.group === site.group).map(x => x.name) ;
  
          console.log("Quick math, bear with me.")
          let groupTime = 0;
          for (let i=0 ; i<sitesOfGroup.length ; i++) {
            groupTime += todayRecord[sitesOfGroup].totalTime
          }
  
          console.log("The time for the whole group would be...", groupTime)
          console.log("Is that above what we authorized ?", groupTime >= groupRestriction[i].totalTime)
          if (groupTime >= groupRestriction[i].totalTime) return true;
  
          timeLeft = groupRestriction[i].totalTime - groupTime
        }
  
      console.log("It seems to be good for the group, let me check for this site in particular")
      if (checkSite && siteRestriction !== groupRestriction) {
        for (let i = 0; i < siteRestriction.length; i++) {
  
          if (siteRestriction[i].days.includes(currentDay)) continue;
  
          if (siteRestriction[i].totalTime >= todayRecord[host].totalTime) return true;
  
          timeLeft = Math.min(timeLeft, todayRecord[host].totalTime - siteRestriction[i].totaltime)
        }
      }
  
      console.log("Nope, we're good to go ! I'll set an alarm, until then enjoy !")
      await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60})
      console.log("alarm should be set", await chrome.alarms.getAll())
      return false;
  }
  
  function checkSlots(slots, currentDay, currentTime) {
      for (let i=0 ; i < slots.length ; i++) {
        if (slots[i].days.includes(currentDay)) {
          let spans = slots[i].time;
          for (let j = 0; j < spans.length; j++) {
            if (
              (j === spans.length - 1 && currentTime > spans[j][0] && spans[j][1] === "00:00")) {
              return true;
            }
            if ((currentTime > spans[j][0] && currentTime < spans[j][1])) {return true;}
          }
        }
      }
  
      return false;
  }