import { template_sites } from './sites.js'
import './blocker.js'
import './alarms.js'

chrome.runtime.onInstalled.addListener(async () => {
    let {sites} = await chrome.storage.local.get("sites")
    if (sites === undefined || sites.length === 0) {
        await chrome.storage.local.set({ sites : template_sites})
    }
    console.log(sites)
    let {groups} = await chrome.storage.local.get("groups")
    if (groups === undefined || groups.length === 0) {
        await chrome.storage.local.set({ groups : [] })
    }
    console.log(groups)
})

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        console.log("changes!", changes)
    }
})