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
    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    let siteIndex = sitesName.findIndex(x => x === host)
    let siteRestrictions = sites[siteIndex].restrictions
    let siteGroup = host === 'private' ? 'Private' : sites[siteIndex].group
    // console.log("host", host, "sites", sites, "siteIndex", siteIndex, "sites[siteIndex]", sites[siteIndex], "siteRestrictions", siteRestrictions, "siteGroup", siteGroup)

    let alarms = await chrome.alarms.getAll()
    if (alarms.length !== 0) {
      // console.log("alarms name contains group ?", siteGroup, alarms.map(x => x.name), alarms.map(x => x.name.includes(siteGroup) && x.name.includes('-end')))
      alarms = alarms.filter(x => (x.name.includes(siteGroup) && x.name.includes('-end')) || (x.name.includes(host) && x.name.includes('-end')))
      // console.log("alarms after filter", alarms, alarms.length)
      if (alarms.length !== 0) return true;
    }

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

    if (groupRestrictions.timeSlot) {
      let sR = siteRestrictions ? siteRestrictions.timeSlot : null
      restricted = isGroupRestrictedByTimeSlot(groupRestrictions.timeSlot, sR);
    }

    if (!restricted && groupRestrictions.totalTime) {
        let sR = siteRestrictions ? siteRestrictions.totalTime : null
        restricted = await isGroupRestrictedByTotalTime(host, groupRestrictions.totalTime, sR)
    }

    if (!restricted && groupRestrictions.consecutiveTime) {
      console.log("checking consecutiveTime", groupRestrictions.consecutiveTime)
      let sR = siteRestrictions ? siteRestrictions.consecutiveTime : null
      restricted = await isGroupRestrictedByConsecutiveTime(host, groupRestrictions.consecutiveTime, sR)
    }

    return restricted
}


function isGroupRestrictedByTimeSlot(groupRestriction, siteRestriction) {
  let result = checkSlots(groupRestriction);
  if (!result && siteRestriction && siteRestriction !== groupRestriction) {
    result = checkSlots(siteRestriction);
  }
  return result
}


export async function isGroupRestrictedByTotalTime(host, groupRestriction, siteRestriction) {
    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    let date = new Date().toISOString().split('T')[0] ;
    let timeLeft = -1
    let { records = {} } = await chrome.storage.local.get('records') ;
    let todayRecord = records[date]

    for (let i = 0; i < groupRestriction.length; i++) {
        console.log("groupRestriction[i]", groupRestriction[i], groupRestriction[i].days.includes(currentDay))
        if (!groupRestriction[i].days.includes(currentDay)) continue;

        let { sites = [] } = await chrome.storage.local.get('sites') ;
        console.log("groupName should be", sites.filter(x => x.name === host).map(x => x.group))
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

export async function isGroupRestrictedByConsecutiveTime(host, groupRestriction, siteRestriction) {
  const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
  let date = new Date().toISOString().split('T')[0] ;
  let groupTimeLeft = -1
  let siteTimeLeft = -1

  let { records = [] } = await chrome.storage.local.get('records') ;
  let todayRecord = records[date]

  let { sites = [] } = await chrome.storage.local.get('sites') ;
  let groupName = sites.find(x => x.name === host).group;
  let sitesOfGroup = sites.filter(x => x.group === groupName).map(x => x.name) ;

  let todayGroup = groupRestriction.find(x => x.days.includes(currentDay))
  if ( todayGroup && 'consecutiveTime' in todayGroup) {
    let totalGroupTime = 0
    sitesOfGroup.forEach(site => { totalGroupTime += todayRecord[site].consecutiveTime || 0});
    if (totalGroupTime >= todayGroup.consecutiveTime) return true;
    groupTimeLeft = todayGroup.consecutiveTime - totalGroupTime
  }

  if (siteRestriction) {
    siteTimeLeft = timeLeftBeforeRestriction('consecutiveTime', currentDay, todayRecord[host], siteRestriction)
    if (!siteTimeLeft) return true;
  }

  if (siteTimeLeft === -1 && groupTimeLeft === -1) return false;

  if (siteTimeLeft === -1 || (siteTimeLeft !== -1 && groupTimeLeft <= siteTimeLeft)) {
    await chrome.alarms.create(`${groupName}-consecutive-time-restriction-begin`, {delayInMinutes : groupTimeLeft / 60})
  } else if (groupTimeLeft === -1 || (groupTimeLeft !== -1 && siteTimeLeft < groupTimeLeft)) {
    await chrome.alarms.create(`${host}-consecutive-time-restriction-begin`, {delayInMinutes : siteTimeLeft / 60})
  }

  return false
}


function timeLeftBeforeRestriction(restrictionKey, currentDay, hostRecord, restriction) {
    let timeLeft = 0
    let todayCt = restriction.find(x => x.days.includes(currentDay))
    if (!todayCt || !todayCt[restrictionKey]) return -1;

    if (todayCt[restrictionKey] > hostRecord[restrictionKey]) {
      timeLeft = todayCt[restrictionKey] - hostRecord[restrictionKey]
    }

    return timeLeft
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


