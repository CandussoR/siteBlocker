chrome.storage.onChanged.addListener(async (changes, area) => {
    if (changes.sites && (changes.sites.newValue.length > changes.sites.oldValue.length)) {
        let date = new Date().toISOString().split('T')[0] ;
        let { records = [] } = await chrome.storage.local.get('records')
        let todayRecord = records[date]
        for (let site of changes.sites.newValue) {
            if (!(site.name in todayRecord)) {
                todayRecord[site.name] = {initDate : null, totalTime : 0, audible : false, tabId : null, focused : false };
            }
        }
        await chrome.storage.local.set({records : records})
    }

    if (area === 'local') {
        await chrome.alarms.clearAll()
        createAlarms()
    }
})

handleAlarms()

async function handleAlarms() {
    if (! await alarmsAreSet()) {
        createAlarms()
    }
}

async function alarmsAreSet() {
    let { alarms = [] } = await chrome.alarms.getAll()
    return alarms.length !== 0;
}

async function createAlarms() {
    let { groups = [] } = await chrome.storage.local.get('groups')
    let { sites = [] } = await chrome.storage.local.get('sites')
    let filtered = []
    filtered.push(...groups.filter(x => ![null, undefined].includes(x.restrictions)))
    filtered.push(...sites.filter(x => ![null, undefined].includes(x.restrictions)))

    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    const currentTime = new Date().toLocaleTimeString('fr-FR')

    filtered.forEach(f => {
        if (!Object.keys(f.restrictions).includes('timeSlot')) {
            return ; }
        
        for (let i=0 ; i<f.restrictions.timeSlot.length ; i++) {
            let {days, time} = f.restrictions.timeSlot[i]

            if (!days.includes(currentDay)) { continue; }

            for (let j = 0 ; j < time.length ; j++) {
                let index = -1

                if (time[j][0] > currentTime) { index = 0 }
                else if (time[j][1] > currentTime || time[j][1] === '00:00') { index = 1 }

                if (index === -1) { continue; }

                let [hours, minutes] = time[j][index].split(':')

                let futureDate = new Date()
                futureDate.setHours(hours)
                futureDate.setMinutes(minutes)
                futureDate.setSeconds(0)

                let delay = (futureDate - Date.now()) / 1000 / 60

                if (index === 1) {
                    chrome.alarms.create(`${f.name}-restriction-end`, {delayInMinutes : delay})
                } else if (index === 0) {
                    chrome.alarms.create(`${f.name}-restriction-begin`, {delayInMinutes : delay})
                }
            }
        }
    })
}

// Fires when I alarms has been triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
    let tabs = await chrome.tabs.query({})
    let [n, r, type] = alarm.name.split('-')
    let isGroup = (n.indexOf('.') === -1)

    if (type === 'end') {
        chrome.runtime.sendMessage({restriction : "ended"})
        chrome.alarms.clear(alarm.name)
        return;
    }

    let targets = []
    if (isGroup) {
        let { sites = [] } = await chrome.storage.local.get('sites')
        targets = sites.filter(x => x.group === n).map(x => x.name)
    } else {
        targets.push(n)
    }

    for (let i = 0; i < tabs.length ; i++) {
        let host = new URL(tabs[i].url).host

        if (!targets.includes(host)) {
            continue ;
        }
        
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { 
            if (message.ready) { sendResponse({url : tabs[i].url, host : host}) } 
        })

        chrome.tabs.update(tabs[i].id, {url : "redirected/redirected.html"})
    }

    chrome.alarms.clear(alarm.name)
})