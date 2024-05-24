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
      let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      console.log("refocused window on following tab", tab)
      let restrictedSites = await getRestrictedSites();
      let url = tab.url
      if (!url || url === "chrome://newtab/" || url === "redirected/redirected.html") return;
      let host = new URL(url).host
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
  
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => { 
    console.log("tab has been removed")
    console.log(tabId, removeInfo)
    bookkeeping('close', tabId)
   })
  
  async function bookkeeping(flag, tabId=undefined, host=undefined) {
    console.log("In bookkeeping I have received", flag, tabId, host, Date.now())
    let date = new Date().toISOString().split('T')[0] ;
    let { records = [] } = await chrome.storage.local.get('records')
    let todayRecord = records[date]
    let rKeys = Object.keys(todayRecord)
    console.log(`Before we begin anything, here's today's records before treating the event ${flag}:`, todayRecord)
    
    // Managing focused right away because I don't seem to succeed in managing it case by case.
    if (!['no-focus', 'close'].includes(flag)) {
      console.log("I'm trying to handle the focused property first")
      let [focused] = await chrome.tabs.query({active: true});
      console.log("focused", focused)
      let focusedUrl = new URL(focused.url).host
      console.log("focusedUrl", focusedUrl)
      let rKeysFiltered = rKeys.filter(x => x !== focusedUrl)
      console.log("Seems like we should focus this part of the record :", todayRecord[focusedUrl])
      console.log("I'll check if selectedTab is already focused")
      if (!todayRecord[focusedUrl].focused) {
        console.log("It's not, so let's mark it focused")
        todayRecord[focusedUrl].focused = true
        console.log("I'll set initDate too")
        if (!todayRecord[focusedUrl].initDate) todayRecord[focusedUrl].initDate = Date.now()
        console.log("Now let's mark the other sites not focused. I'll use this list : ", rKeysFiltered)
        for (let k of rKeysFiltered) {
          todayRecord[k].focused = false
        }
        console.log("Now today record looks like this : ", todayRecord)
      }
    }
  
    if (flag === 'close') {
  
      console.log("Oh so you're leaving ?")    
  
      for (let i = 0; i < rKeys.length ; i++) {
        if (!todayRecord[rKeys[i]].tabId || !todayRecord[rKeys[i]].tabId.includes(tabId)) {
          continue;
        }
        
        let site = todayRecord[rKeys[i]]
        let tabIndex = site.tabId.findIndex(x => x === tabId)
        if (site.tabId.length > 1 && tabIndex !== -1) {
          console.log("you have multiple tabs open for this website", site.tabId)
          site.tabId.splice(tabIndex, 1)
          break;
        } 
  
        console.log("The time should be :", Math.round( (Date.now() - site.initDate) / 1000 ))
        if (site.initDate) {
          site.totalTime += Math.round( (Date.now() - site.initDate) / 1000 )
          site.initDate = null
        }
  
        site.tabId = null
        site.audible = false
        site.focused = false
        break;
      }
    }
  
    else if (flag === 'open') {
      let site = todayRecord[host];
      console.log("this site has been opened", site)
      if (!site.initDate) site.initDate = Date.now();
  
      console.log("checking site tab in open", new Date())
      site.tabId && !site.tabId.includes(tabId) ? site.tabId.push(tabId) : site.tabId = [ tabId ];
    }
  
    else if (flag === 'audible-start') {
      console.log("oh! you started to consume some media!");
      todayRecord[host].audible = true;
      if (!todayRecord[host].initDate) todayRecord[host].initDate = Date.now();
    }
  
    else if (flag === 'audible-end') {
      console.log("You stopped consuming some media.")
      todayRecord[host].audible = false
      console.log("focused and tabId", todayRecord[host].focused, todayRecord[host].tabId)
      if (!todayRecord[host].focused && todayRecord[host].tabId.length === 1) {
        console.log("and the tab is not focused, so it doesn't count anymore")
        todayRecord[host].totalTime += Math.round( (Date.now() - todayRecord[host].initDate) / 1000 )
        todayRecord[host].initDate = null
      }
    }
  
    else if (flag === 'no-focus') {
      console.log("You don't have any restricted site focused as of now.")
      for (let i=0; i<rKeys.length ; i++) {
        let el = todayRecord[rKeys[i]]
        if (!el.focused) {
          continue ;
        } else if (el.focused && !el.audible) {
          console.log("This was focused and nothing was playing so I'm resetting focused and initDate")
          el.totalTime += Math.round( (Date.now() - el.initDate) / 1000 )
          el.focused = false
          el.initDate = null
        } else if (el.focused && el.audible) {
          console.log("Oh here there is something playing so I'm just going to change the focused property.")
          el.focused = false
        }
      }
    }
  
    else if (flag === 'change-focus') {
      // infos : tabId and host
      console.log("focus has changed", tabId, host)
      todayRecord = bookkeepChangeFocus(rKeys, todayRecord, host, tabId)
    }
  
    console.log("Now this is today's record after its modification, is it alright ?", todayRecord)
    await chrome.storage.local.set({records : records})
  }
  
  function bookkeepChangeFocus(rKeys, todayRecord, host, tabId) {
    if (!todayRecord[host].initDate) todayRecord[host].initDate = Date.now()

    for (let i=0; i<rKeys.length ; i++) {
      if (rKeys[i] === host) continue;
      let el = todayRecord[rKeys[i]]
      if (el.initDate) {
        el.totalTime += Math.round( (Date.now() - el.initDate) / 1000 )
        el.initDate = null
      }
    }
    
    return todayRecord
  }