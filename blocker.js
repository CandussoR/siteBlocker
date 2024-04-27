// I don't check onCreated since the url or pending are generally set through onUpdated.

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    let restrictedSites = await getRestrictedSites();
    if (!restrictedSites) return ;

    let url = changeInfo.pendingUrl || changeInfo.url
    if (url === "chrome://newtab/" || url === "redirected/redirected.html") return;

    if (url) {
        let host = new URL(url).host
        if (isRestricted(host, restrictedSites)) {
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

function isRestricted(site, sites) {
    let sitesName = sites.map(x => x.site)
    if (!sitesName.includes(site)) { return false; }

    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    const currentTime = new Date().toLocaleTimeString('fr-FR')

    let siteIndex = sitesName.findIndex(x => x === site)
    let restrictions = sites[siteIndex].restrictions

    if (restrictions.slots) { return checkSlots(restrictions.slots, currentDay, currentTime) }

    return false
}

function checkSlots(slots, currentDay, currentTime) {
    for (let i=0 ; i < slots.length ; i++) {

        if (slots[i].days.includes(currentDay)) {
            let spans = slots[i].time
            for (let j = 0; j < spans.length; j++) {
                if (j === (spans.length - 1) && currentTime > spans[j][0] && spans[j][1] === '00:00:00') {
                    return true
                }
                else if (currentTime > spans[j][0] && currentTime < spans[j][1]) {
                    console.log("yes")
                    return true
                }
            }
        }
    }

    return false;
}