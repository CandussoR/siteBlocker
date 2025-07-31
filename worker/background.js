import {
  template_sites,
  daysToRecord,
  consecutiveTimeReset,
} from "./dataInit.js";
import { setRecords, cleanRecords } from "./settingRecord.js";
import "./bookkeepingQueue.js";
import {logger} from './logger.js';
import { processOrEnqueue } from "./blocker.js";
import { handleAlarms } from "./alarmsHandler.js";
import { entitiesCache } from "./siteAndGroupModels.js";
import {rm } from './recordManager.js';
import { onTabActivated, onTabUpdated, onWindowFocusChanged, initializeSingletons } from "./hookHandler.js";

chrome.runtime.onInstalled.addListener(async () => {
  let { sites } = await chrome.storage.local.get("sites");
  if (sites === undefined || sites.length === 0) {
    await chrome.storage.local.set({ sites: template_sites });
  }
  let { groups } = await chrome.storage.local.get("groups");
  if (groups === undefined || groups.length === 0) {
    await chrome.storage.local.set({ groups: [] });
  }
  await initializeSingletons(entitiesCache, rm);

  await chrome.storage.local.set({ daysToRecord: daysToRecord });
  await chrome.storage.local.set({
    consecutiveTimeReset: consecutiveTimeReset,
  });
  await chrome.storage.local.set({ restrictPrivate: false });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.local.set({ busy: true });

  await initializeSingletons(entitiesCache, rm);

  let today = new Date().toISOString().split("T")[0];
  let records = await setRecords(today);
  if (!records) {
    await chrome.storage.local.set({ busy: false });
    await handleAlarms(entitiesCache);
    return;
  }

  let { lastCleaned } = await chrome.storage.local.get("lastCleaned");
  if (Object.keys(records).length === 1 || lastCleaned === today) return;
  await cleanRecords(lastCleaned, records, today);

  await chrome.alarms.clearAll();
  await chrome.storage.local.set({ busy: false });
  await handleAlarms(entitiesCache);
});

// Fires when the active tab in a window changes : handle change-focus or no-focus
chrome.tabs.onActivated.addListener(async (activeInfo) => { onTabActivated(activeInfo); });

// I don't check onCreated since the url or pending are generally set through onUpdated.
// Open and audible flags are set here
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => { onTabUpdated(entitiesCache, rm, tabId, changeInfo, tab); });

chrome.tabs.onRemoved.addListener(async (tabId, _) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  // check if tabId site is still audible or not FIRST
  await processOrEnqueue("close", tabId);
});

// Fires if window is focused or not
chrome.windows.onFocusChanged.addListener(async (window) => onWindowFocusChanged(window));
import { handleStorageChange, handleOnAlarm } from "./alarmsHandler.js";
import { ConsecutiveTimeRestriction } from "./restrictions.js";

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  try {
    console.log("changes in storage", changes, area);
    // No need to do anything with logs
    await handleStorageChange(changes, entitiesCache, rm, area);
  } catch (error) {
    console.error("Error handling storage change:", error);
  }
});

// Fires when I alarms has been triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  try {
    await handleOnAlarm(alarm, entitiesCache, rm);
  } catch (error) {
    logger.error('Error handling onAlarm : ', error);
    await chrome.alarms.clear(alarm.name)
  }
});



