export async function getRestrictedSites() {
    let {sites = []} = await chrome.storage.local.get('sites')
    if (chrome.runtime.lastError) {
        console.error("An error occurred while fetching your settings.")
        return;
    }
    return sites
}

export async function isRestricted(host, sites) {
    const sitesName = sites.map(x => x.name)

    let siteIndex = sitesName.findIndex(x => x === host)
    let siteRestrictions = sites[siteIndex].restrictions
    let siteGroup = sites[siteIndex].group
    
    if (siteGroup) {
        let { groups = [] } = await chrome.storage.local.get('groups')
        let groupIndex = groups.findIndex(g => g.name === siteGroup)
        let groupRestrictions = groups[groupIndex].restrictions
        
        if (groupRestrictions) {
            return isGroupRestricted(host, groupRestrictions, siteRestrictions)
        }
    }
    
    let { records = {} } = await chrome.storage.local.get('records') ;
    let todayRecord = records[date]
    if (siteRestrictions && siteRestrictions.timeSlot) { 
        return checkSlots(siteRestrictions.timeSlot) 
    }
    if (siteRestrictions && siteRestrictions.totalTime 
        && timeLeftBeforeRestriction(currentDay, todayRecord[host], siteRestrictions.totalTime)) {
        await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60})
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

    console.log("groupRestriction in isRestrictedByTotalTim", groupRestriction)

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
      timeLeft = Math.min(timeLeft, timeLeftBeforeRestriction(currentDay, todayRecord[host], siteRestriction))
      if (!timeLeft) return true;
    }

    await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60})
    return false;
}


function timeLeftBeforeRestriction(currentDay, hostRecord, restriction) {
    let timeLeft = 0
    for (let i = 0; i < restriction.length; i++) {
        if (!restriction[i].days.includes(currentDay)) continue;
        if (restriction[i].totalTime >= hostRecord.totalTime) return 0;
        timeLeft = hostRecord.totalTime - restriction[i].totaltime
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


