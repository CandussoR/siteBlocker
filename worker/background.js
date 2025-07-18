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
import { AlarmManager } from "./alarmManager.js";
import { EntitiesCache, entitiesCache } from "./siteAndGroupModels.js";
import {RecordManager, rm } from './recordManager.js';

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

import { isRestricted } from "./restrictionsHandler.js";
 
// Fires when the active tab in a window changes.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);

  let tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url) return;

  logger.debug("onActivated : changes on this tab", activeInfo);
  let host = new URL(tab.url).host;
  if (!isInWatchedList(entitiesCache.sites, host)) {
    await processOrEnqueue("no-focus");
    return;
  }

  if (host == rm.getSiteFocused()) return;
  await processOrEnqueue("change-focus", activeInfo.tabId, host);
});

// Fires if window is focused or not
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);

  let [tab] = await chrome.tabs.query({ active: true });
  logger.debug(
    "onFocusChanged refocused window on following tab",
    tab, tab?.id
  );

  if (windowId === -1 || !tab.id) {
    await processOrEnqueue("no-focus");
  } else {
    try {
      if ( !tab.url || isAppPageOrNewTab(tab.url)) return;
    } catch(error) {
      console.error(error);
      logger.error(error)
    }

    let host = new URL(tab.url).host;
    if (!isInWatchedList(entitiesCache.sites, host)) return;

    await processOrEnqueue("change-focus", tab.id, host);
  }
});

// I don't check onCreated since the url or pending are generally set through onUpdated.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  let url = changeInUrl(changeInfo);
  if (!url && !("audible" in changeInfo))
    return;

  if (url?.includes("ui/redirected/redirected.html")) {
    await processOrEnqueue("close", tabId, new URL(url).host)
    return;
  } else if (isAppPageOrNewTab(url)) {
    await processOrEnqueue("no-focus");
    return;
  }

  if (tab.incognito) {
    let { restrictPrivate } = await chrome.storage.local.get("restrictPrivate");
    if (!restrictPrivate) 
      return;
  }
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);

  if (!entitiesCache.sites.length) 
    return;

  if (!url) url = tab.url
  let host = tab.incognito ? "private" : new URL(url).host;
  if (!isInWatchedList(entitiesCache.sites, host)) 
    return;

  const am = new AlarmManager(await chrome.alarms.getAll())
  const violationObj = await isRestricted(host, entitiesCache, rm);
  if (
    am.hasEndAlarm(host, entitiesCache.getSiteByName(host)?.group) ||
    violationObj.violated
  ) {
    sendCloseAndRedirect(tabId, host, url);
    return;
  }

  let flag = "open";
  if ("audible" in changeInfo)
    flag = changeInfo.audible ? "audible-start" : "audible-end";
  if (flag === "open") am.handleRestrictionAlarm({host : host, vs : violationObj})

  logger.warning(`processOrEnqueuing ${flag} for tabId ${tabId} with host ${host}`)
  await processOrEnqueue(flag, tabId, host);
});

chrome.tabs.onRemoved.addListener(async (tabId, _) => {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  // check if tabId site is still audible or not FIRST
  await processOrEnqueue("close", tabId);
});

import { handleStorageChange, handleOnAlarm } from "./alarmsHandler.js";

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

/**
 * 
 * @param {EntitiesCache} entitiesCache 
 * @param {RecordManager} recordManager 
 */
async function initializeSingletons(entitiesCache, recordManager) {
  await entitiesCache.initialize();
  await recordManager.initialize();
}

function changeInUrl(changeInfo) {
  return changeInfo.pendingUrl || changeInfo.url;
}
function isAppPageOrNewTab(url) {
  return url?.includes("chrome://newtab/") || url?.includes("ui/")
}
function isInWatchedList(sites, host) {
  return sites.map((x) => x.name).includes(host)
}

async function sendCloseAndRedirect(tabId, host, url) {
    logger.debug("sendCloseAndRedirect : checked if isRestricted, processing close and redirecting")
    await processOrEnqueue("close", tabId, host);
    chrome.tabs.update(tabId,
      { url: `ui/redirected/redirected.html?url=${url}&host=${host}` }
    );
  }