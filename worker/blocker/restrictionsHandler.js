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

export async function checkTotalTimeRestriction(currentDay, host, groupRestriction, checkSite, siteRestriction = undefined) {

    let date = new Date().toISOString().split('T')[0] ;
    let timeLeft = -1
    console.log("Let me get the records")
    let { records = {} } = await chrome.storage.local.get('records') ;
  
    let todayRecord = records[date]
    console.log("Today, today... got it")
    console.log("todayRecord", todayRecord)
    console.log("Group restrictions I'm about to iterate on", JSON.stringify(groupRestriction))
    for (let i = 0; i < groupRestriction.length; i++) {

        if (!groupRestriction[i].days.includes(currentDay)) continue;

        console.log("There is a restriction on today, let me check the sites of this group.")
        let { sites = [] } = await chrome.storage.local.get('sites') ;
        let [groupName] = sites.filter(x => x.name === host).map(x => x.group)
        let sitesOfGroup = sites.filter(x => x.group === groupName).map(x => x.name) ;

        console.log("Quick math, bear with me.")
        let groupTime = 0;
        for (let i=0 ; i<sitesOfGroup.length ; i++) {
          groupTime += todayRecord[sitesOfGroup[i]].totalTime
        }

        console.log("The time for the whole group would be...", groupTime)
        console.log("Is that above what we authorized ?", groupTime >= groupRestriction[i].totalTime)
        if (groupTime >= groupRestriction[i].totalTime) return true;

        timeLeft = groupRestriction[i].totalTime - groupTime
      }

    console.log("It seems to be good for the group, let me check for this site in particular")
    if (checkSite && siteRestriction !== groupRestriction) {
      console.log("entered the condition")
      for (let i = 0; i < siteRestriction.length; i++) {
        if (!siteRestriction[i].days.includes(currentDay)) continue;
        if (siteRestriction[i].totalTime >= todayRecord[host].totalTime) return true;
        timeLeft = Math.min(timeLeft, todayRecord[host].totalTime - siteRestriction[i].totaltime)
      }
    }

    console.log("Nope, we're good to go ! I'll set an alarm, until then enjoy !")
    await chrome.alarms.create(`${host}-total-time-restriction-begin`, {delayInMinutes : timeLeft / 60})
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


