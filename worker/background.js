
import { template_sites } from './sites.js'
import { setRecords, cleanRecords } from './settingRecord.js'


chrome.runtime.onInstalled.addListener(async () => {
    let {sites} = await chrome.storage.local.get("sites")
    if (sites === undefined || sites.length === 0) {
        await chrome.storage.local.set({ sites : template_sites})
    }
    let {groups} = await chrome.storage.local.get("groups")
    if (groups === undefined || groups.length === 0) {
        await chrome.storage.local.set({ groups : [] })
    }
})

chrome.runtime.onStartup.addListener( async () => {
    console.log("setting busy as false before cleanup") 
    await chrome.storage.local.set({ busy : true })
    let today = new Date().toISOString().split('T')[0] ;
    let records = await setRecords(today);
    if (!records) {
        await chrome.storage.local.set({ busy : false })
        return;
    }

    let {lastCleaned} = await chrome.storage.local.get('lastCleaned')
    console.log("lastCleaned", lastCleaned)
    if (Object.keys(records).length === 1 || lastCleaned === today) return;
    console.log("records must be cleaned")
    await cleanRecords(lastCleaned, records, today)
    await chrome.storage.local.set({busy : false})
    }
) 

import './blocker/blocker.js'
import './alarms/alarmsEvents.js'
