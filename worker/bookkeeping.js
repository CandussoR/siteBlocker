import { setRecords } from "./settingRecord.js";

export async function bookkeeping(flag, tabId = undefined, host = undefined) {
  try {
    console.log("In bookkeeping I have received", flag, tabId, host);

    let { records = [] } = await chrome.storage.local.get("records");
    let todayRecord = await getTodayRecord(records);

    console.log(
      "todayRecord, before the switch case",
      todayRecord,
      Object.keys(todayRecord)
    );
    switch (flag) {
      case "audible-start":
        todayRecord[host] = handleAudibleStart(todayRecord[host]);
        break;
      case "audible-end":
        todayRecord[host] = await handleAudibleEnd(host, todayRecord[host]);
        break;
      case "open":
        todayRecord = await handleOpen(todayRecord, tabId, host);
        break;
      case "close":
        todayRecord = await handleClose(todayRecord, tabId);
        break;
      case "no-focus":
        todayRecord = await handleNoFocus(todayRecord);
        break;
      case "change-focus":
        todayRecord = await handleChangeFocus(todayRecord, host);
        break;
    }

    console.log("we will set this in records", records);
    await chrome.storage.local.set({ records: records });
  } catch (error) {
    console.log("Error in bookkeeping, avorting any change", error);
  }
}

export async function getTodayRecord(records) {
  let date = new Date().toISOString().split("T")[0];
  let todayRecord = records[date];
  if (!todayRecord) {
    todayRecord = await setRecords(date);
  }
  return records[date];
}

export async function handleOpen(todayRecord, tabId, host) {
  // Deleting tab from last domain if it has changed
  for (let site of Object.keys(todayRecord)) {
    if (
      todayRecord[site].tabId &&
      todayRecord[site].tabId.includes(tabId) &&
      site !== host
    ) {
      await handleClose(todayRecord, tabId);
    }
  }

  // Ascribing tab to domain
  let siteRecord = todayRecord[host];
  if (siteRecord.tabId && !siteRecord.tabId.includes(tabId))
    siteRecord.tabId.push(tabId);
  else if (!siteRecord.tabId) siteRecord.tabId = [tabId];

  // Handling focus and initDate
  let focused = await chrome.tabs.query({ active: true });
  if (focused && focused[0] && new URL(focused[0].url).host === host) {
    siteRecord.focused = true;
    siteRecord.initDate = Date.now();
  }

  return todayRecord;
}

export async function handleClose(todayRecord, tabId) {
  for (let site of Object.keys(todayRecord)) {
    let siteRecord = todayRecord[site];

    if (!siteRecord.tabId || !siteRecord.tabId.includes(tabId)) {
      continue;
    } else if (siteRecord.tabId.length > 1) {
      if (siteRecord.audible && (await checkToggleAudible(site))) {
        siteRecord.audible = false;
      }
      let tabIndex = siteRecord.tabId.findIndex((x) => x === tabId);
      siteRecord.tabId.splice(tabIndex, 1);
    } else {
      siteRecord.tabId = null;
      siteRecord.focused = false;
      siteRecord.audible = false;
    }

    if ((siteRecord.initDate && siteRecord.audible) || !siteRecord.initDate) {
      return todayRecord;
    }

    if ("consecutiveTime" in siteRecord) {
      siteRecord = await bookkeepConsecutiveTime(site, siteRecord);
    }

    siteRecord.totalTime += Math.round(
      (Date.now() - siteRecord.initDate) / 1000
    );
    siteRecord.initDate = null;
  }

  return todayRecord;
}

export function handleAudibleStart(siteRecord) {
  siteRecord.audible = true;
  if (!siteRecord.initDate) siteRecord.initDate = Date.now();
  return siteRecord;
}

export async function handleAudibleEnd(site, siteRecord) {
  siteRecord.audible = false;

  if (!siteRecord.focused && siteRecord.initDate) {
    if ("consecutiveTime" in siteRecord) {
      siteRecord = await bookkeepConsecutiveTime(site, siteRecord);
    } else {
      siteRecord.totalTime += Math.round(
        (Date.now() - siteRecord.initDate) / 1000
      );
    }

    siteRecord.initDate = null;
  }

  return siteRecord;
}

export async function handleNoFocus(todayRecord) {
  for (let site of Object.keys(todayRecord)) {
    todayRecord[site].focused = false;

    if (todayRecord[site].audible) {
      todayRecord[site].focused = false;
      continue;
    }

    if (
      todayRecord[site].initDate &&
      !("consecutiveTime" in todayRecord[site])
    ) {
      todayRecord[site].totalTime += Math.round(
        (Date.now() - todayRecord[site].initDate) / 1000
      );
    }

    if ("consecutiveTime" in todayRecord[site]) {
      todayRecord[site] = await bookkeepConsecutiveTime(
        site,
        todayRecord[site]
      );
    }

    todayRecord[site].initDate = null;
  }
  return todayRecord;
}

export async function handleChangeFocus(todayRecord, host) {
  for (let site of Object.keys(todayRecord)) {
    let s = todayRecord[site];
    if (site === host) {
      s.focused = true;
      if (!s.initDate) s.initDate = Date.now();
      continue;
    } else if (s.focused && s.initDate && !s.audible) {
      s.focused = false;
      if ("consecutiveTime" in s) {
        s = await bookkeepConsecutiveTime(site, s);
      }
      s.totalTime += Math.round((Date.now() - s.initDate) / 1000);
      s.initDate = null;
    } else {
      s.focused = false;
    }
  }
  return todayRecord;
}

async function checkToggleAudible(site) {
  let audibleTabs = await chrome.tabs.query({ audible: true });
  if (
    audibleTabs.length > 0 &&
    audibleTabs.map((x) => new URL(x.url).host).includes(site)
  ) {
    return false;
  }
  return true;
}

async function bookkeepConsecutiveTime(site, siteRecord) {
  // Always sent here after audible and focused have been reset to false
  // && there is a date initialised
  console.log("in bookkeepConsecutiveTime I have received", site, siteRecord);
  if (siteRecord.initDate && !siteRecord.audible && !siteRecord.focused) {
    siteRecord.consecutiveTime += Math.round(
      (Date.now() - siteRecord.initDate) / 1000
    );

    let { consecutiveTimeReset } = await chrome.storage.local.get(
      "consecutiveTimeReset"
    );
    console.log("consecutiveTimeReset", consecutiveTimeReset);
    let { sites = [] } = await chrome.storage.local.get("sites");
    let todayCtRestriction = getCurrentDayRestriction(
      sites.find((x) => x.name === site),
      "consecutiveTime"
    );
    if (
      todayCtRestriction &&
      todayCtRestriction.pause <= consecutiveTimeReset
    ) {
      consecutiveTimeReset = todayCtRestriction.pause;
    }

    // We need to check if there is an alarm for a particular site or for a group first
    let alarms = await chrome.alarms.getAll();
    if (
      alarms.find(
        (a) => a.name === `${site}-consecutive-time-restriction-begin`
      )
    ) {
      await chrome.alarms.create(`${site}-consecutive-time-restriction-check`, {
        delayInMinutes: consecutiveTimeReset / 60,
      });
      await chrome.alarms.clear(`${site}-consecutive-time-restriction-begin`);
    }

    let group = sites.find((x) => x.name === site).group;
    if (
      group &&
      alarms.find(
        (a) => a.name === `${group}-consecutive-time-restriction-begin`
      )
    ) {
      await chrome.alarms.create(
        `${group}-consecutive-time-restriction-check`,
        { delayInMinutes: consecutiveTimeReset / 60 }
      );
      await chrome.alarms.clear(`${group}-consecutive-time-restriction-begin`);
    }
  }

  console.log(" now in bookkeepConsecutiveTime I have", site, siteRecord);
  return siteRecord;
}

function getCurrentDayRestriction(item, restrictionKey) {
  if (!item || !item.restrictions || !(restrictionKey in item.restrictions)) {
    return undefined;
  }
  let currentDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date()
  );
  return item.restrictions[restrictionKey].find((x) =>
    x.days.includes(currentDay)
  );
}
