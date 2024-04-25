// I don't check onCreated since the url or pending are generally set through onUpdated.

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

    let restrictedSites = await getRestrictedSites();
    if (!restrictedSites) return ;

    let url = changeInfo.pendingUrl || changeInfo.url
    if (url === "chrome://newtab/") return;
    console.log("pending or url", url)

    if (url) {
        let host = new URL(url).host
            if (isRestricted(host, restrictedSites)) {
                console.log("This host is restricted !")
            }
        }

    if (changeInfo.audible === true) {
        console.log("something started playing", tab.url)
    } else if (changeInfo.audible === false) {
        console.log("something stopped playing", tab.url)
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

function isRestricted(site, sites) {
    let sitesName = sites.map(x => x.site)
    if (!sitesName.includes(site)) { return false; }

    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    const currentTime = new Date().toLocaleTimeString('fr-FR')
    
    let restrictions = sites[ sitesName.findIndex(x => x === site) ].restrictions
    
    if (restrictions.slots) { return checkSlots(restrictions.slots, currentDay, currentTime) }
   
    return false
}

function checkSlots(slots, currentDay, currentTime) {

    for (let i=0 ; i < slots.length ; i++) {

        if (slots[i].days.includes(currentDay)) {
            console.log("includes day")
            let spans = slots[i].time
            for (let j = 0; j < spans.length; j++) {
                if (currentTime > spans[j][0] && currentTime < spans[j][1]) {
                    return true 
                }
            }
        }
    }

    return false;
}