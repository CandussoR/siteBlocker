import { AlarmManager } from "./alarmManager.js";
import { rm, RecordManager } from "./recordManager.js";
import { entitiesCache, EntitiesCache } from "./siteAndGroupModels.js";
import { processOrEnqueue } from "./blocker.js";
import { isRestricted } from './restrictionsHandler.js';
import { logger } from "./logger.js";
import { ConsecutiveTimeRestriction } from "./restrictions.js";

/**
 * 
 * @param {{tabId : number, windowId : number}} activeInfo
 */
export async function onTabActivated(activeInfo) {
  console.log("callback activated");
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);

  let tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url) return;

  logger.debug("onActivated : changes on this tab", activeInfo);
  let host = new URL(tab.url).host;
  const am = new AlarmManager()
  await am.loadAlarms();

  if (!isInWatchedList(entitiesCache.sites, host)) {
    setCheckAlarmIfNeeded( rm.getSiteFocused(), rm, entitiesCache, am);
    await processOrEnqueue("no-focus");
    return;
  }

  // New tab, old site
  if (host == rm.getSiteFocused()) return;

  await replaceConsecutiveTimeCheckAlarmByBegin(host, am, entitiesCache, rm);
  await processOrEnqueue("change-focus", activeInfo.tabId, host);
}

/**
 * Handler for new tabs and changes inside tab
 * @param {EntitiesCache} entitiesCache
 * @param {RecordManager} rm
 * @param {number} tabId 
 * @param {object} changeInfo 
 * @param {object} tab 
 */
export async function onTabUpdated(entitiesCache, rm, tabId, changeInfo, tab) {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);

  if (!entitiesCache.sites.length) 
    return;

  // Probably not finished the process of loading yet
  let url = changeInUrl(changeInfo);
  if (!url && !("audible" in changeInfo))
    return;


  if (tab.incognito) {
    let { restrictPrivate } = await chrome.storage.local.get("restrictPrivate");
    if (!restrictPrivate) 
      return;
  }

  if (!url) url = tab.url
  let host = tab.incognito ? "private" : new URL(url).host;
  const am = new AlarmManager()
  await am.loadAlarms()

  // Here the page has been redirected by an alarm or a restriction, no need to manage alarms
  if (url?.includes("ui/redirected/redirected.html")) {
    await processOrEnqueue("close", tabId)
    return;
  } else if (isAppPageOrNewTab(url) || !isInWatchedList(entitiesCache.sites, host)) {
    // checking for old focus
    await setCheckAlarmIfNeeded(host, rm, entitiesCache, am);
    await processOrEnqueue("no-focus");
    return;
  }

  const violationObj = await isRestricted(host, entitiesCache, rm);
  const isUnderRestriction = am.hasEndAlarm(host, entitiesCache.getSiteByName(host)?.group)
  console.log("isUnderRestriction", isUnderRestriction, violationObj)
  if ( isUnderRestriction.length || violationObj.violated) {
    console.log("we send close and redirect")
    sendCloseAndRedirect(tabId, host, url);
    return;
  }

  let flag = "open";
  if ("audible" in changeInfo)
    flag = changeInfo.audible ? "audible-start" : "audible-end";
  
  am.handleRestrictionAlarm({host : host, vs : violationObj})

  logger.warning(`processOrEnqueuing ${flag} for tabId ${tabId} with host ${host}`)
  await processOrEnqueue(flag, tabId, host);
}

export async function onWindowFocusChanged(window) {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  console.log("windowId, onFocusChanged", window)

  const host = window.url ? new URL(window.url).host : undefined;

  const am = new AlarmManager(await chrome.alarms.getAll());
  if (window === -1 || !window.url || isAppPageOrNewTab(window.url) || !isInWatchedList(entitiesCache.sites, host)) {
    setCheckAlarmIfNeeded(rm.getSiteFocused(), rm, entitiesCache, am);
    await processOrEnqueue("no-focus");
    return;
  }

  await replaceConsecutiveTimeCheckAlarmByBegin(host, am, entitiesCache, rm)
  await processOrEnqueue("change-focus", tab.id, host);
}

export async function onTabRemoved(tabId) {
  if (!entitiesCache.initialized) await initializeSingletons(entitiesCache, rm);
  // check if tabId site is still audible or not FIRST
  let tab = await chrome.tabs.get(tabId)
  if (isAppPageOrNewTab(tab.url) || !isInWatchedList(entitiesCache.sites, new URL(tab.url).host)) {
    return;
  }
  await processOrEnqueue("close", tabId);
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

/**
 * 
 * Checks if watched or last watched site need a check for consecutive time alarm
 * @param {string} host 
 * @param {RecordManager} rm 
 * @param {EntitiesCache} entitiesCache 
 * @param {AlarmManager} am 
 */
async function setCheckAlarmIfNeeded(host, rm, entitiesCache, am) {
    let siteRecord = rm.getTodaySiteRecord(host);
    if (!siteRecord || !siteRecord?.consecutiveTime) { return; }

    const violationObj = new ConsecutiveTimeRestriction(
      entitiesCache.getSiteByName(host),
      rm,
      entitiesCache
    ).isViolated();
    let { consecutiveTimeReset } = await chrome.storage.local.get(
      "consecutiveTimeReset"
    );
    am.setAlarm(violationObj.entity, {
      delayInMinutes: consecutiveTimeReset / 60,
    });
}

/**
 * 
 * Checks if watched or last watched site need a check for consecutive time alarm
 * @param {string} host 
 * @param {AlarmManager} am
 * @param {EntitiesCache} entitiesCache 
 * @param {RecordManager} rm 
 */
async function replaceConsecutiveTimeCheckAlarmByBegin(host, am, entitiesCache, rm) {
  const newFocus = entitiesCache.getSiteByName(host);
  if ((check = [...am.getCheckAlarms(host), ...am.getCheckAlarms(newFocus.group)]).length) {
    for (c of check) { am.deleteAlarm(check.name); }
    const violationObj = await isRestricted(host, entitiesCache, rm);
    // Deleting check alarm + adding a begin one for closest restriction
    am.handleRestrictionAlarm({ host: host, vs: violationObj });
  }
}

/**
 * 
 * @param {EntitiesCache} entitiesCache 
 * @param {RecordManager} recordManager 
 */
export async function initializeSingletons(entitiesCache, recordManager) {
  await entitiesCache.initialize();
  await recordManager.initialize();
}