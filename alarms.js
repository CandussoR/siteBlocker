
    console.log("trying to create alarms")
if (!alarmsAreSet()) {
    console.log("no alarms are set")
    createAlarms()
}

async function alarmsAreSet() {
    let { alarms = [] } = await chrome.alarms.getAll()
    return alarms.length !== 0
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

            console.log("is there today in days ?")
            if (!days.includes(currentDay)) { continue; }

            console.log("yep there were, let's check the time")

            console.log('times', time)
            for (let j = 0 ; j < time.length ; j++) {
                let index = -1

                if (time[j][0] > currentTime) { index = 0 }
                else if (time[j][1] > currentTime || time[j][1] === '00:00') { index = 1 }

                if (index === -1) { continue; }

                console.log("index", index)

                let [hours, minutes] = time[j][index].split(':')
                let futureDate = new Date()
                futureDate.setHours(hours)
                futureDate.setMinutes(minutes)
                futureDate.setSeconds(0)

                let delay = futureDate - new Date()
                if (index === 1) {
                    chrome.alarms.create(`${f.name}-restriction-end`, {when : futureDate})
                } else if (index === 0) {
                    chrome.alarms.create(`${f.name}-restriction-begin`, {when : futureDate})
                }
            }
        }
    })
}

// Fires when I alarms has been triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log(alarm)
    let { tabs = [] } = await chrome.tabs.query({})
    let [n, r, type] = alarm.name.split('-')
    let isGroup = (n.indexOf('.') === -1)

    if (type === 'end') {
        console.log('end of the restriction')
        return;
    }

    let targets = []
    if (isGroup) {
        let { sites = [] } = await chrome.storage.local.get('sites')
        targets = sites.filter(x => x.group === n)
    } else {
        targets.push(n)
    }

    console.log('restriction begin, redirecting every tab')

    for (let i = 0; i < tabs.length ; i++) {
        let host = new URL(tabs[i].url).host

        if (!targets.includes(host)) {
            continue ;
        }
        
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { 
            if (message.ready) { sendResponse({url : url, host : host}) } 
        })

        chrome.tabs.update(tabs[i].id, {url : "redirected/redirected.html"})
    }
})