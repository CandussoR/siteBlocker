// I don't check onCreated since the url or pending are generally set through onUpdated.
console.log("blocked script")
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    let restrictedSites = await getRestrictedSites();
    if (!restrictedSites) return ;

    let url = changeInfo.pendingUrl || changeInfo.url
    if (url === "chrome://newtab/" || url === "redirected/redirected.html") return;

    if (url) {
        let host = new URL(url).host
        if (await isRestricted(host, restrictedSites)) {
            chrome.tabs.update(tabId, {url : "redirected/redirected.html"}, () => {console.log(`redirected from ${host}`)})
        }
    }
  });

async function getRestrictedSites() {
    let {sites = []} = await chrome.storage.local.get('sites')
    if (chrome.runtime.lastError) {
        console.error("An error occurred while fetching your settings.")
        return;
    }
    return sites
}

async function isRestricted(site, sites) {
    console.log("checking sites restrictions")
    let sitesName = sites.map(x => x.name)
    if (!sitesName.includes(site)) { return false; }

    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    const currentTime = new Date().toLocaleTimeString('fr-FR')

    let siteIndex = sitesName.findIndex(x => x === site)
    console.log("current site", sites[siteIndex])
    let siteRestrictions = sites[siteIndex].restrictions
    let siteGroup = sites[siteIndex].group

    console.log("siteGroup", siteGroup)

    if (siteGroup) {
        console.log("this site belongs to a group")
        
        let { groups = [] } = await chrome.storage.local.get('groups')
        let groupIndex = groups.findIndex(g => g.name === siteGroup)
        let groupRestrictions = groups[groupIndex].restrictions
        
        if (groupRestrictions) {
            let groupRestrictionsKeys = Object.keys(groupRestrictions)
            let siteRestrictionsKeys = siteRestrictions ? Object.keys(siteRestrictions) : []
                
            let restricted = false;
            if (groupRestrictionsKeys.includes("timeSlot")) {
                console.log('checking group timeSlot')
                  restricted = checkSlots( groupRestrictions.timeSlot, currentDay, currentTime);
                if (
                    siteRestrictionsKeys.includes("timeSlot") &&
                    siteRestrictions.timeSlot !== groupRestrictions.timeSlot
                ) {
                console.log('group timeSlot and site timeSlot differ, checking the site too', )
                restricted = checkSlots( siteRestrictions.timeSlot, currentDay, currentTime);
              }
            }
            
            return restricted
            }
        }
        
    if (siteRestrictions && siteRestrictions.timeSlot) { return checkSlots(siteRestrictions.timeSlot, currentDay, currentTime) }

    return false
}

function checkSlots(slots, currentDay, currentTime) {
    for (let i=0 ; i < slots.length ; i++) {
      if (slots[i].days.includes(currentDay)) {
        let spans = slots[i].time;
        for (let j = 0; j < spans.length; j++) {
          if (
            (j === spans.length - 1 && currentTime > spans[j][0] && spans[j][1] === "00:00") ||
            (currentTime > spans[j][0] && currentTime < spans[j][1])) {
            return true;
          }
        }
      }
    }

    return false;
}