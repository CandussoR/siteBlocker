import { getTodayRecord } from "../blocker/bookkeeping";

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


export async function createAlarms() {
    console.log("creating alarms")
    let { groups = [] } = await chrome.storage.local.get('groups')
    let { sites = [] } = await chrome.storage.local.get('sites')

    let filtered = []
    filtered.push(...groups.filter(x => ![null, undefined].includes(x.restrictions)))
    filtered.push(...sites.filter(x => ![null, undefined].includes(x.restrictions)))

    createTimeSlotAlarms(filtered)
}

export async function handleStorageChange(changes,area) {    
    // In case a site has been added, it's added in records
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
          
    // After a site has been added, of if no site has been added, we check if some restrictions have changed
    // Works for both groups and sites.
    let key = Object.keys(changes)[0]
    let createAlarms = false

    for (let i = 0; i < changes[key].newValue.length ; i++) {

        let newValueItem = changes[key].newValue[i]
        let oldValueItem = changes[key].oldValue[i]

        if (newValueItem.restrictions === oldValueItem.restrictions) {
            continue ;
        } else if ('consecutiveTime' in newValueItem.restrictions && !('consecutiveTime' in oldValueItem.restrictions)) {
            let { records = {} } = await chrome.storage.local.get('records')
            let todayRecord = records[date] 
            todayRecord[ newValueItem.name ].consecutiveTime = 0
            await chrome.storage.local.set({ records : records })
        } else if (
            ('timeSlot' in newValueItem.restrictions && (!oldValueItem.restrictions || !('timeSlot' in oldValueItem.restrictions)) 
            || 
            ('timeSlot' in newValueItem.restrictions && (newValueItem.restrictions.timeSlot !== oldValueItem.restrictions.timeSlot)))
            ) {
            createAlarms = true
            let alarms = await chrome.alarms.getAll()
            alarms = alarms.filter(x => x.name.includes(`${newValueItem.name}-time-slot`))
            for (let a of alarms) { await chrome.alarms.clear(a.name) }
        }
    }

    if (createAlarms) createTimeSlotAlarms(changes[key].newValue)
}

export async function handleOnAlarm(alarm) {
    let tabs = await chrome.tabs.query({})
    let [n, r, type] = alarm.name.split('-')
    let isGroup = (n.indexOf('.') === -1)

    if (alarm.name.includes('-consecutive-time')) {
        handleConsecutiveTimeAlarm(alarm.name);
        return;
    }

    if (type === 'end') {
        chrome.runtime.sendMessage({restriction : "ended"})
        chrome.alarms.clear(alarm.name)
        let { data = [] } = await chrome.storage.local.get(isGroup ? 'groups' : 'sites')
        data = data.filter(x => x.name === n)
        console.assert(Array.isArray(data) === true, "data is not an array")
        createTimeSlotAlarms(data)  
        return;
    }

    await redirectTabsRestrictedByAlarm(isGroup, tabs)

    chrome.alarms.clear(alarm.name)
}


async function handleConsecutiveTimeAlarm(name) {
    let n = name.split('-').shift()

    if ('check' in name) {
        // 2 minutes have passed since site has been left, putting it into totalTime and resetting
        let { records = [] } = await chrome.storage.local.get('records')
        let todayRecord = getTodayRecord(records)
        todayRecord[n].totalTime += todayRecord[n].consecutiveTime
        todayRecord[n].consecutiveTime = 0
        await chrome.storage.local.set({records: records})
        await chrome.alarms.clear(alarm.name)
        return;
    }

    if ('-end' in name) {
        let { records = [] } = await chrome.storage.local.get('records')
        let todayRecord = getTodayRecord(records)
        todayRecord[n].consecutiveTime = 0
        await chrome.storage.local.set({records : records})
        await chrome.alarms.clear(alarm.name)
        return;
    }

    let key = '.' in n ? 'sites' : 'groups'
    try {
        let {data = []} = await chrome.storage.local.get(key)
        let siteRestriction = data.sites.filter(x => x.name === n).map(x => x.restrictions.consecutiveTime)
        let currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date())
        siteRestriction = siteRestriction.filter(x => x.days.includes(currentDay))
        await chrome.alarms.create(`${n}-consecutive-time-restriction-end`, {delayInMinutes : siteRestriction.pause / 60})

        let tabs = await chrome.tabs.query({})
        // need to better check urls non empty
        tabs = tabs.filter(t => t.url && new URL(t.url).host === n)
        await redirectTabsRestrictedByAlarm(key === 'groups', tabs)
        await chrome.alarms.clear(alarm.name)

    } catch (error) {
        console.error(`Error when fetching ${key} from chrome storage local in handleConsecutiveAlarm : ${error}`)
    }    
}


async function redirectTabsRestrictedByAlarm(isGroup, tabs) {
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
            console.log("sender is", sender)
            if (message.ready) { sendResponse({url : tabs[i].url, host : host, tabId : tabs[i].id}) } 
        })

        chrome.tabs.update(tabs[i].id, {url : "redirected/redirected.html"})
    }
}


function createTimeSlotAlarms(sites) {

    const currentDay = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date)
    const currentTime = new Date().toLocaleTimeString('fr-FR')

    for (let i = 0; i < sites.length ; i++) {
        let s = sites[i]
        console.log(s, s.name)

        if (!('timeSlot' in s.restrictions)) { break ; }

        console.assert(Array.isArray(s.restrictions.timeSlot), JSON.stringify(s.restrictions.timeSlot))
        // Should always have only one item with the day for one restriction
        let timeSlots = s.restrictions.timeSlot.find(x => x.days.includes(currentDay)).time

        let index = -1

        if (timeSlots[0] > currentTime) { index = 0 }
        else if (timeSlots[1] > currentTime || timeSlots[1] === '00:00') { index = 1 }

        if (index === -1) { continue; }

        let [hours, minutes] = timeSlots[index].split(':')

        let futureDate = new Date()
        futureDate.setHours(hours)
        futureDate.setMinutes(minutes)
        futureDate.setSeconds(0)

        let delay = (futureDate - Date.now()) / 1000 / 60

        console.assert(Number.isInteger(delay), futureDate, futureDate - Date.now())

        if (index === 1) {
            chrome.alarms.create(`${s.name}-time-slot-restriction-end`, {delayInMinutes : delay})
            break;
        } else if (index === 0) {
            chrome.alarms.create(`${s.name}-time-slot-restriction-begin`, {delayInMinutes : delay})
            break;
        }
    }
}

