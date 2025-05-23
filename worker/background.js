import {
  template_sites,
  daysToRecord,
  consecutiveTimeReset,
} from "./dataInit.js";
import { setRecords, cleanRecords } from "./settingRecord.js";
import "./bookkeepingQueue.js";
import { processOrEnqueue } from "./blocker.js";
import { handleAlarms } from "./alarmsHandler.js";

chrome.runtime.onInstalled.addListener(async () => {
  let { sites } = await chrome.storage.local.get("sites");
  if (sites === undefined || sites.length === 0) {
    await chrome.storage.local.set({ sites: template_sites });
  }
  let { groups } = await chrome.storage.local.get("groups");
  if (groups === undefined || groups.length === 0) {
    await chrome.storage.local.set({ groups: [] });
  }
  await chrome.storage.local.set({ daysToRecord: daysToRecord });
  await chrome.storage.local.set({
    consecutiveTimeReset: consecutiveTimeReset,
  });
  await chrome.storage.local.set({ restrictPrivate: false });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("on startup is running, alarms will be reset");
  await chrome.storage.local.set({ busy: true });
  let today = new Date().toISOString().split("T")[0];
  let records = await setRecords(today);
  if (!records) {
    await chrome.storage.local.set({ busy: false });
    return;
  }

  let { lastCleaned } = await chrome.storage.local.get("lastCleaned");
  if (Object.keys(records).length === 1 || lastCleaned === today) return;
  await cleanRecords(lastCleaned, records, today);

  await chrome.alarms.clearAll();
  await chrome.storage.local.set({ busy: false });

  await handleAlarms();
});

import { getRestrictedSites, isRestricted } from "./restrictionsHandler.js";

// Fires when the active tab in a window changes.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  let tab = await chrome.tabs.get(activeInfo.tabId);
  console.log("changes on this tab", activeInfo);
  if (!tab.url) return;
  let restrictedSites = await getRestrictedSites();
  let host = new URL(tab.url).host;
  if (!restrictedSites.map((x) => x.name).includes(host)) {
    await processOrEnqueue("no-focus");
    return;
  }
  await processOrEnqueue("change-focus", activeInfo.tabId, host);
});

// Fires if window is focused or not
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  let [tab] = await chrome.tabs.query({ active: true });
  console.log(
    "onFocusChanged refocused window on following tab",
    tab,
    tab.tabId,
    !tab.tabId
  );

  if (windowId === -1 || !tab.tabId) {
    await processOrEnqueue("no-focus");
  } else {
    let restrictedSites = await getRestrictedSites();
    if (
      !tab.url ||
      ["chrome://newtab/", "ui/redirected/redirected.html"].includes(tab.url)
    )
      return;

    let host = new URL(tab.url).host;
    if (!restrictedSites.map((x) => x.name).includes(host)) return;
    await processOrEnqueue("change-focus", tab.tabId, host);
  }
});

// I don't check onCreated since the url or pending are generally set through onUpdated.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  let changeUrl = changeInfo.pendingUrl || changeInfo.url;
  let changeAudible = "audible" in changeInfo;
  if (!changeUrl && !changeAudible) {
    return;
  }
  if (
    ["chrome://newtab/", "ui/redirected/redirected.html"].includes(changeUrl)
  ) {
    await processOrEnqueue("no-focus");
    return;
  }

  if (tab.incognito) {
    let { restrictPrivate } = await chrome.storage.local.get("restrictPrivate");
    if (!restrictPrivate) return;
  }

  console.log("update", tabId, changeInfo, tab, new Date());
  let flag = "open";
  let restrictedSites = await getRestrictedSites();
  if (!restrictedSites) return;

  let url = changeUrl || tab.url;
  if (!url) return;

  let host = tab.incognito ? "private" : new URL(url).host;
  if (!restrictedSites.map((x) => x.name).includes(host)) return;

  if (await isRestricted(host, restrictedSites)) {
    await processOrEnqueue("close", tabId, host);
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.ready && sender.tab.id === tabId) {
        sendResponse({ url: url, host: host });
      }
    });
    chrome.tabs.update(tabId, { url: "ui/redirected/redirected.html" });
    return;
  }

  if (changeInfo.audible === true) {
    flag = "audible-start";
  } else if (changeInfo.audible === false) {
    flag = "audible-end";
  }

  await processOrEnqueue(flag, tabId, host);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log("tab has been removed");
  console.log(tabId, removeInfo);
  await processOrEnqueue("close", tabId);
});

import { handleStorageChange, handleOnAlarm } from "./alarmsHandler.js";

chrome.storage.onChanged.addListener(async (changes, area) => {
  try {
    console.log("changes in storage", changes, area);
    await handleStorageChange(changes, area);
  } catch (error) {
    console.error("Error handling storage change:", error);
  }
});

// Fires when I alarms has been triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    await handleOnAlarm(alarm);
  } catch (error) {
    console.log("Error handling onAlarm :", error);
  }
});
