import { template_sites } from './sites.js'
import './blocker.js'
import './alarms.js'

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

chrome.runtime.onStartup.addListener(async () => {
    let date = new Date()
    let todate = date.toISOString().split('T')[0] ;

    let { records = {} } = await chrome.storage.local.get('records') ;
    if (Object.keys(records).includes(todate)) return ;

    let { sites = [] } = await chrome.storage.local.get('sites') ;
    let {cleanRecords: lastCleaned = []} = await chrome.storage.local.get('lastCleaned') ;
    if (records.length === 0 && sites.length === 0) return ;
    
    records[todate] = {}
    for (let i=0 ; i<sites.length ; i++) {
        records[todate][sites[i].name] = {initDate : null, totalTime : 0, audible : false, tabId : null, focused : false } ;
    }

    if (!(lastCleaned.length === 0 || (lastCleaned[0] === todate)) ) {
        records = cleanRecords(lastCleaned[0], records, todate) ;
        await chrome.storage.local.set({lastCleaned : todate}) ;
    }

    await chrome.storage.local.set({records : records}) ;
    await chrome.storage.local.set({lastCleaned : todate})
}) 

function cleanRecords(lastCleaned, records, todate) {
    let keys = Object.keys(records) ;
    
    let lastCleanIndex = keys.indexOf(lastCleaned) === -1 ? 0 : keys.indexOf(lastCleaned) ;
    
    for (let i= lastCleanIndex ; i < keys.length -1 ; i++) {
        if (keys[i] >= todate) continue ;
        let recDate = records[keys[i]] ;
        let sites = Object.keys(recDate) ;
        for (let j=0 ; j < sites.length ; j++) {
            if (recDate[sites[j]].totalTime = 0) {
                delete recDate[sites[j]]
            } else if (recDate[sites[j]].length !== 0) { 
                recDate[sites[j]] = recDate[sites[j]].totalTime 
            } ;
        }
    }

    return records ;
}