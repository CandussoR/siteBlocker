import { setRecords } from "./settingRecord.js";
import { logger } from "./logger.js";
import { checkIfCreateConsecutiveOrTotalTimeAlarm } from "./alarmsHandler.js";
import { logger } from "./logger.js";
import { checkIfCreateConsecutiveOrTotalTimeAlarm } from "./alarmsHandler.js";

export async function bookkeeping(flag, tabId = undefined, host = undefined) {
  try {
  // logger.debug("In bookkeeping I have received", flag, tabId, host);
  // logger.debug("In bookkeeping I have received", flag, tabId, host);

    let { records = [] } = await chrome.storage.local.get("records");
    let todayRecord = await getTodayRecord(records);

  // logger.debug(
    //   "todayRecord, before the switch case",
    //   todayRecord
    // );
  // logger.debug(
    //   "todayRecord, before the switch case",
    //   todayRecord
    // );
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
      // logger.debug("Out of no-focus, todayRecord is:", todayRecord)
      // logger.debug("Out of no-focus, todayRecord is:", todayRecord)
        break;
      case "change-focus":
        todayRecord = await handleChangeFocus(todayRecord, host);
        break;
    }

  // logger.debug('bookkeeping : we will set this in records : ', todayRecord);
  // logger.debug('bookkeeping : we will set this in records : ', todayRecord);
    await chrome.storage.local.set({ records: records });
  } catch (error) {
  // logger.error('Error in bookkeeping, avorting any change : ', error);
  // logger.error('Error in bookkeeping, avorting any change : ', error);
  }
}

export async function getTodayRecord(records) {
  let date = new Date().toISOString().split("T")[0];
  let todayRecord = records[date];
  if (!todayRecord) {
    todayRecord = await setRecords(date);
  }
  return todayRecord;
  return todayRecord;
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

  logger.debug("Trying to set an alarm for consecutiveTime in handleopen")
  await checkIfCreateConsecutiveOrTotalTimeAlarm(host, todayRecord)
  logger.debug("After checkIfstuff in handleOpen")

  logger.debug("Trying to set an alarm for consecutiveTime in handleopen")
  await checkIfCreateConsecutiveOrTotalTimeAlarm(host, todayRecord)
  logger.debug("After checkIfstuff in handleOpen")

  return todayRecord;
}

export async function handleClose(todayRecord, tabId) {
// logger.debug("handleClose coming in!")
// logger.debug("handleClose coming in!")
  for (let site of Object.keys(todayRecord)) {
    let siteRecord = todayRecord[site];
    
    
    if (!siteRecord.tabId || !siteRecord.tabId.includes(tabId)) {
      continue;
    } 
    
  // logger.debug(`working with this piece for ${site}`, siteRecord, "still have to bookkeep")
    if (siteRecord.tabId.length > 1) {
    } 
    
  // logger.debug(`working with this piece for ${site}`, siteRecord, "still have to bookkeep")
    if (siteRecord.tabId.length > 1) {
      if (siteRecord.audible && (await checkToggleAudible(site))) {
        siteRecord.audible = false;
      }
      let tabIndex = siteRecord.tabId.findIndex((x) => x === tabId);
      siteRecord.tabId.splice(tabIndex, 1);
    // logger.debug("One tab has been closed but there are more", siteRecord.tabId)
      // Check for other tabs if one of them is focused or audible before statueing on initDate, totalTime and consecutiveTime ?
    // logger.debug("One tab has been closed but there are more", siteRecord.tabId)
      // Check for other tabs if one of them is focused or audible before statueing on initDate, totalTime and consecutiveTime ?
    } else {
      siteRecord.tabId = null;
      siteRecord.focused = false;
      siteRecord.audible = false;
    }
    
    // Potentially when already out of focus and unused.
    
    // Potentially when already out of focus and unused.
    if ((siteRecord.initDate && siteRecord.audible) || !siteRecord.initDate) {
      if (siteRecord.consecutiveTime) {
      // logger.error("Site with consecutiveTime yet no initDate already!")
      }
      if (siteRecord.consecutiveTime) {
      // logger.error("Site with consecutiveTime yet no initDate already!")
      }
      return todayRecord;
    }

    if ("consecutiveTime" in siteRecord && siteRecord.initDate) {
    if ("consecutiveTime" in siteRecord && siteRecord.initDate) {
      siteRecord = await bookkeepConsecutiveTime(site, siteRecord);
    }

    siteRecord.totalTime += Math.round(
      (Date.now() - siteRecord.initDate) / 1000
    );

  // logger.warning("setting initDate to null", site, siteRecord, console.trace())

  // logger.warning("setting initDate to null", site, siteRecord, console.trace())
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

  if (!siteRecord.initDate) {
  // logger.warning(
    //   "SiteRecord has no initDate when handleAudibleEnd ! Can't bookkeep consecutive time nor total time !",
    //   site,
    //   siteRecord
    // );
  }

  if (!siteRecord.initDate) {
  // logger.warning(
    //   "SiteRecord has no initDate when handleAudibleEnd ! Can't bookkeep consecutive time nor total time !",
    //   site,
    //   siteRecord
    // );
  }

  if (!siteRecord.focused && siteRecord.initDate) {
    if ("consecutiveTime" in siteRecord) {
     siteRecord = await bookkeepConsecutiveTime(site, siteRecord);
     siteRecord = await bookkeepConsecutiveTime(site, siteRecord);
    } else {
      siteRecord.totalTime += Math.round(
        (Date.now() - siteRecord.initDate) / 1000
      );
    }

  // const trace = console.trace()
  // logger.debug("trace is", trace)
  // logger.warning("setting initDate to null", site, siteRecord, console.trace())
    siteRecord.initDate = null;
  }

  return siteRecord;
}

export async function handleNoFocus(todayRecord) {
// logger.debug("Handling no-focus")
// logger.debug("Handling no-focus")
  for (let site of Object.keys(todayRecord)) {
    todayRecord[site].focused = false;

    if (todayRecord[site].audible) {
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

  // logger.warning("setting initDate to null", todayRecord[site], console.trace())
  // logger.warning("setting initDate to null", todayRecord[site], console.trace())
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
      if ("consecutiveTime" in s) {
        await checkIfCreateConsecutiveOrTotalTimeAlarm(host, todayRecord);
      }
      if ("consecutiveTime" in s) {
        await checkIfCreateConsecutiveOrTotalTimeAlarm(host, todayRecord);
      }
      continue;
    } else if (s.focused && s.initDate && !s.audible) {
      s.focused = false;
      if ("consecutiveTime" in s) {
        s = await bookkeepConsecutiveTime(site, s);
      }
      s.totalTime += Math.round((Date.now() - s.initDate) / 1000);
    // logger.warning("setting initDate to null", s, console.trace())
    // logger.warning("setting initDate to null", s, console.trace())
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
/**
 * Handle the value of consecutiveTime in record
 * and the alarm beginning or check. Doesn't modify initDate
 * @param {*} site 
 * @param {*} siteRecord 
 * @returns 
 */
/**
 * Handle the value of consecutiveTime in record
 * and the alarm beginning or check. Doesn't modify initDate
 * @param {*} site 
 * @param {*} siteRecord 
 * @returns 
 */
async function bookkeepConsecutiveTime(site, siteRecord) {
  // Always sent here after audible and focused have been reset to false
  // && there is a date initialised
// logger.debug("in bookkeepConsecutiveTime I have received", site, siteRecord);
  if (!siteRecord.initDate) {
  // logger.error( "Cannot bookkeep consecutiveTime without initDate", site, siteRecord);
    return siteRecord;
  }

  if (siteRecord.audible || siteRecord.focused) {
  // logger.info("Site is audible or focused, not doing anything");
    return siteRecord;
  }

  siteRecord.consecutiveTime += Math.round(
    (Date.now() - siteRecord.initDate) / 1000
  );
// logger.debug("in bookkeepConsecutiveTime I have received", site, siteRecord);
  if (!siteRecord.initDate) {
  // logger.error( "Cannot bookkeep consecutiveTime without initDate", site, siteRecord);
    return siteRecord;
  }

  if (siteRecord.audible || siteRecord.focused) {
  // logger.info("Site is audible or focused, not doing anything");
    return siteRecord;
  }

  siteRecord.consecutiveTime += Math.round(
    (Date.now() - siteRecord.initDate) / 1000
  );

  // Need to be careful for the reset laps :
  // if you go back on the website in the meantime, it will be added.
  let { consecutiveTimeReset } = await chrome.storage.local.get(
    "consecutiveTimeReset"
  );

  let { sites = [] } = await chrome.storage.local.get("sites");
  let todayCtRestriction = getCurrentDayRestriction(
    sites.find((x) => x.name === site),
    "consecutiveTime"
  );
  if (todayCtRestriction && todayCtRestriction.pause <= consecutiveTimeReset) {
    consecutiveTimeReset = todayCtRestriction.pause;
  }
  // Need to be careful for the reset laps :
  // if you go back on the website in the meantime, it will be added.
  let { consecutiveTimeReset } = await chrome.storage.local.get(
    "consecutiveTimeReset"
  );

  let { sites = [] } = await chrome.storage.local.get("sites");
  let todayCtRestriction = getCurrentDayRestriction(
    sites.find((x) => x.name === site),
    "consecutiveTime"
  );
  if (todayCtRestriction && todayCtRestriction.pause <= consecutiveTimeReset) {
    consecutiveTimeReset = todayCtRestriction.pause;
  }

// logger.debug(`consecutiveTimeReset is ${consecutiveTimeReset}`);

  // Determine wether we set a beginning or a check alarm
  let alarms = await chrome.alarms.getAll();
  if (
    alarms.find((a) => a.name === `${site}-consecutive-time-restriction-begin`)
  ) {
  // logger.debug(
    //   "Creating a consecutive time restriction check alarm",
    //   `${consecutiveTimeReset / 60} minutes delay`,
    //   `should convert to end at ${new Date(
    //     new Date().getTime() + consecutiveTimeReset * 1000
    //   ).toLocaleTimeString()}`
    // );

    await chrome.alarms.create(`${site}-consecutive-time-restriction-check`, {
      delayInMinutes: consecutiveTimeReset / 60,
    });
    await chrome.alarms.clear(`${site}-consecutive-time-restriction-begin`);
  }
// logger.debug(`consecutiveTimeReset is ${consecutiveTimeReset}`);

  // Determine wether we set a beginning or a check alarm
  let alarms = await chrome.alarms.getAll();
  if (
    alarms.find((a) => a.name === `${site}-consecutive-time-restriction-begin`)
  ) {
  // logger.debug(
    //   "Creating a consecutive time restriction check alarm",
    //   `${consecutiveTimeReset / 60} minutes delay`,
    //   `should convert to end at ${new Date(
    //     new Date().getTime() + consecutiveTimeReset * 1000
    //   ).toLocaleTimeString()}`
    // );

    await chrome.alarms.create(`${site}-consecutive-time-restriction-check`, {
      delayInMinutes: consecutiveTimeReset / 60,
    });
    await chrome.alarms.clear(`${site}-consecutive-time-restriction-begin`);
  }

  let group = sites.find((x) => x.name === site).group;
  if (
    group &&
    alarms.find((a) => a.name === `${group}-consecutive-time-restriction-begin`)
  ) {
  // logger.debug(
    //   `Creating a consecutive time restriction check alarm for ${group}`,
    //   `${consecutiveTimeReset / 60} minutes delay`,
    //   `should convert to end at ${new Date(
    //     new Date().getTime() + consecutiveTimeReset * 1000
    //   ).toLocaleTimeString()}`
    // );
    await chrome.alarms.create(`${group}-consecutive-time-restriction-check`, {
      delayInMinutes: consecutiveTimeReset / 60,
    });
    await chrome.alarms.clear(`${group}-consecutive-time-restriction-begin`);
  let group = sites.find((x) => x.name === site).group;
  if (
    group &&
    alarms.find((a) => a.name === `${group}-consecutive-time-restriction-begin`)
  ) {
  // logger.debug(
    //   `Creating a consecutive time restriction check alarm for ${group}`,
    //   `${consecutiveTimeReset / 60} minutes delay`,
    //   `should convert to end at ${new Date(
    //     new Date().getTime() + consecutiveTimeReset * 1000
    //   ).toLocaleTimeString()}`
    // );
    await chrome.alarms.create(`${group}-consecutive-time-restriction-check`, {
      delayInMinutes: consecutiveTimeReset / 60,
    });
    await chrome.alarms.clear(`${group}-consecutive-time-restriction-begin`);
  }

// logger.debug(" now in bookkeepConsecutiveTime I have", site, siteRecord);
// logger.debug(" now in bookkeepConsecutiveTime I have", site, siteRecord);
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
