export async function getRestrictedSites() {
    let {sites = []} = await chrome.storage.local.get('sites')
    if (chrome.runtime.lastError) {
        console.error("An error occurred while fetching your settings.")
        return;
    }
    return sites
}

export async function isRestricted(host, sites) { 
    // check for alarms.
    const sitesName = sites.map(x => x.name)
    
    let siteIndex = sitesName.findIndex(x => x === host)
    let siteRestrictions = sites[siteIndex].restrictions
    let siteGroup = sites[siteIndex].group

    let alarms = await chrome.alarms.getAll()
    console.log("alarms name contains group ?", siteGroup, alarms.map(x => x.name), alarms.map(x => x.name.includes(siteGroup) && x.name.includes('-end')))
    alarms = alarms.filter(x => (x.name.includes(siteGroup) && x.name.includes('-end')) || (x.name.includes(host) && x.name.includes('-end')))
    console.log("alarms after filter", alarms, alarms.length)
    if (alarms.length !== 0) return true;
    
    if (siteGroup) {
        let { groups = [] } = await chrome.storage.local.get('groups')
        let groupIndex = groups.findIndex(g => g.name === siteGroup)
        let groupRestrictions = groups[groupIndex].restrictions
        
        if (groupRestrictions) {
            return isGroupRestricted(host, groupRestrictions, siteRestrictions)
        }
    }
    
    let { records = {} } = await chrome.storage.local.get('records') ;
    let date = new Date().toISOString().split('T')[0] ;
    let todayRecord = records[date]
    if (siteRestrictions && siteRestrictions.timeSlot && checkSlots(siteRestrictions.timeSlot)) { 
        return true;
    }

    if (siteRestrictions && siteRestrictions.totalTime) {
        let timeLeft = timeLeftBeforeRestriction('totalTime', currentDay, todayRecord[host], siteRestrictions.totalTime);
        if (timeLeft) {
          await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60});
        } else {
          return true;
        }
    }

    if (siteRestrictions && siteRestrictions.consecutiveTime) {
        let timeLeft = timeLeftBeforeRestriction('consecutiveTime', currentDay, todayRecord[host], siteRestrictions.consecutiveTime)
        if (timeLeft) {
          await chrome.alarms.create(`${host}-consecutive-time-restriction-begin`, {delayInMinutes : timeLeft/60})
        } else {
          return true;
      }
    }
    
    return false
}


async function isGroupRestricted(host, groupRestrictions, siteRestrictions) {        
    let restricted = false;
    console.log(groupRestrictions)

    if (groupRestrictions.timeSlot) {
        restricted = isRestrictedByTimeSlot(groupRestrictions.timeSlot,siteRestrictions.timeSlot);
    }

    if (!restricted && groupRestrictions.totalTime) {
        console.log("not retricted and groupRestrictions.totalTime", groupRestrictions.totalTime)
        restricted = await isRestrictedByTotalTime(host, groupRestrictions.totalTime, siteRestrictions.totalTime)
    }

    if (!restricted && groupRestrictions.consecutiveTime) {
      restriction = await isRestrictedByConsecutiveTime(host, groupRestrictions.consecutiveTime, siteRestrictions.consecutiveTime)
    }

    return restricted
}


function isRestrictedByTimeSlot(groupRestriction, siteRestriction) {
  let result = checkSlots(groupRestriction);
  if (!result && checkSite && siteRestriction !== groupRestriction) {
    result = checkSlots( siteRestriction);
  }
  return result
}


export async function isRestrictedByTotalTime(host, groupRestriction, siteRestriction) {
    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    let date = new Date().toISOString().split('T')[0] ;
    let timeLeft = -1
    let { records = {} } = await chrome.storage.local.get('records') ;
    let todayRecord = records[date]

    console.log("groupRestriction in isRestrictedByTotalTime", groupRestriction)

    for (let i = 0; i < groupRestriction.length; i++) {
        console.log("groupRestriction[i]", groupRestriction[i], groupRestriction[i].days.includes(currentDay))
        if (!groupRestriction[i].days.includes(currentDay)) continue;

        let { sites = [] } = await chrome.storage.local.get('sites') ;
        let [groupName] = sites.filter(x => x.name === host).map(x => x.group)
        let sitesOfGroup = sites.filter(x => x.group === groupName).map(x => x.name) ;

        let groupTime = 0;
        for (let i=0 ; i<sitesOfGroup.length ; i++) {
          groupTime += todayRecord[sitesOfGroup[i]].totalTime
        }

        if (groupTime >= groupRestriction[i].totalTime) return true;

        timeLeft = groupRestriction[i].totalTime - groupTime
      }

    if (siteRestriction && siteRestriction !== groupRestriction) {
      timeLeft = Math.min(timeLeft, timeLeftBeforeRestriction('totalTime', currentDay, todayRecord[host], siteRestriction))
      if (!timeLeft) return true;
    }

    await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60})
    return false;
}

export async function isRestrictedByConsecutiveTime(host, groupRestriction, siteRestriction) {
  const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
  let date = new Date().toISOString().split('T')[0] ;
  let timeLeft = -1
  let { records = {} } = await chrome.storage.local.get('records') ;
  let todayRecord = records[date] 

  for (let i = 0; i < groupRestriction.length; i++) {
    console.log("groupRestriction[i]", groupRestriction[i], groupRestriction[i].days.includes(currentDay))
    if (!groupRestriction[i].days.includes(currentDay)) continue;

    let { sites = [] } = await chrome.storage.local.get('sites') ;
    let [groupName] = sites.filter(x => x.name === host).map(x => x.group)
    let sitesOfGroup = sites.filter(x => x.group === groupName).map(x => x.name) ;

    let groupTime = 0;
  for (let i=0 ; i<sitesOfGroup.length ; i++) {
      groupTime += todayRecord[sitesOfGroup[i]].consecutiveTime || 0
    }

    if (groupTime >= groupRestriction[i].consecutiveTime) return true;

    timeLeft = groupRestriction[i].consecutiveTime - groupTime
  }
  
  if (siteRestriction && siteRestriction !== groupRestriction) {
    timeLeft = Math.min(timeLeft, timeLeftBeforeRestriction('consecutiveTime', currentDay, todayRecord[host], siteRestriction))
    if (!timeLeft) return true;
  }
  
  await chrome.alarms.create(`${host}-consecutive-time-restriction-begin`, {delayInMinutes : timeLeft/60})
  return false
}


function timeLeftBeforeRestriction(restrictionKey, currentDay, hostRecord, restriction) {
    let timeLeft = 0
    for (let i = 0; i < restriction.length; i++) {
        if (!restriction[i].days.includes(currentDay)) continue;
        if (restriction[i][restrictionKey] >= hostRecord[restrictionKey]) return 0;
        timeLeft = hostRecord[restrictionKey] - restriction[i][restrictionKey]
      }
    return timeLeft;
}


function checkSlots(slots) {
    const currentTime = new Date().toLocaleTimeString('fr-FR')
    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)

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


