// Is being run everytime a page is loaded.

function checkIfAuthorized(sites) {
    const site = sites.filter(x => x.site === window.location.hostname)[0]

    if (!site) {
        return true;
    }

    const day = new Date().getDay()
    if (!site.restricted.days.includes(day)) {
        return true;
    }

    const time = new Date().toLocaleTimeString('fr-FR')
    for (let i = 0; i < site.restricted.time.length; i++) {
        if (time < site.restricted.time[i][0] || time > site.restricted.time[i][1]) {
            return false 
        }
    }

    return true;
}

chrome.storage.local.get('sites', (res) => {
    if (chrome.runtime.lastError) {
        alert("An error occured while fetching your settings.")
    }

    if (Object.keys(res).length !== 0) {
        sites = res.sites
    }

    sites = template_sites

    if (checkIfAuthorized(sites) === false) alert("Unauthorized !")
})

