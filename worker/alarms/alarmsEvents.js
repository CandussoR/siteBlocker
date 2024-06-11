import { handleStorageChange, handleOnAlarm } from "./alarmsHandler.js"

chrome.storage.onChanged.addListener(async (changes, area) => {
    try {
        console.log("changes in storage", changes, area)
        await handleStorageChange(changes, area);
    } catch (error) {
        console.error("Error handling storage change:", error);
    }
})

// Fires when I alarms has been triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        await handleOnAlarm(alarm)
    } catch (error) {
        console.log("Error handling onAlarm :", error)
    }
})
