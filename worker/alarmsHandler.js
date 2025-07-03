import { bookkeepingQueue } from "./bookkeepingQueue.js";
import { setRecords } from "./settingRecord.js";
import {
  findAllTodayRestrictionsFor,
  findTodayRestriction,
  getSiteNamesOfGroup,
} from "./commons.js";
import { logger } from "./logger.js";

export async function handleAlarms() {
  if (!(await alarmsAreSet())) {
    createAlarms();
  }
}

async function alarmsAreSet() {
  let alarms = await chrome.alarms.getAll();
  return alarms.length !== 0;
}
/**
 * This only creates timeSlot alarms at startUp or when restrictions updated
 * They are the only predictable ones
 */
export async function createAlarms() {
  let { groups = [] } = await chrome.storage.local.get("groups");
  let { sites = [] } = await chrome.storage.local.get("sites");

  let filtered = [];
  filtered.push(
    ...groups.filter((x) => ![null, undefined].includes(x.restrictions))
  );
  filtered.push(
    ...sites.filter((x) => ![null, undefined].includes(x.restrictions))
  );

  await createTimeSlotAlarms(filtered);
}

export async function handleStorageChange(changes, area) {
  if (
    "busy" in changes &&
    !changes.busy.newValue &&
    changes.busy.oldValue &&
    bookkeepingQueue.queue.length
  ) {
    bookkeepingQueue.dequeue();
  }

  if (!("sites" in changes || "groups" in changes)) return;

  let date = new Date().toISOString().split("T")[0];

  // In case a site has been added, it's added in records
  if (
    changes.sites &&
    changes.sites.newValue.length > changes.sites.oldValue.length
  ) {
    let { records = [] } = await chrome.storage.local.get("records");
    let todayRecord = records[date];
    for (let site of changes.sites.newValue) {
      if (!(site.name in todayRecord)) {
        todayRecord[site.name] = {
          initDate: null,
          totalTime: 0,
          audible: false,
          tabId: null,
          focused: false,
        };
      }
    }
    await chrome.storage.local.set({ records: records });
  }

  // After a site has been added, or if no site has been added, we check if we have to add consecutiveTime or a timeSlot alarm
  // Works for both groups and sites.
  let key = Object.keys(changes)[0];
  let { records = {} } = await chrome.storage.local.get("records");
  let todayRecord = records[date];

  logger.info("Something has changed in either group or site.",
    "\nThis is key", key,
    "\nThis is changes[key].newValue :\n", changes[key].newValue,
    "\nToday record is", todayRecord
  )
  await chrome.alarms.clearAll();

  await createTimeSlotAlarms(changes[key].newValue);

  await createConsecutiveTimeAlarms(changes[key].newValue, todayRecord);

  logger.info("TodayRecord is now", todayRecord)
  await chrome.storage.local.set({ records: records });
}

export async function handleOnAlarm(alarm) {
  logger.info("HandleOnAlarm : ", alarm);
  let tabs = await chrome.tabs.query({});
  let [n, r, type] = alarm.name.split("-");
  let isGroup = n.indexOf(".") === -1;

  // Not handling total-time : always begin, no end, always redirect.
  if (alarm.name.includes("-consecutive-time")) {
    logger.info("Will hop into handleConsecutiveTimeAlarm");
    await handleConsecutiveTimeAlarm(alarm.name);
    return;
  } else if (alarm.name.includes("-time-slot")) {
    let data = await chrome.storage.local.get(isGroup ? "groups" : "sites");
    data = isGroup ? data.groups : data.sites;
    if (!data) {
      data = []
    }
    data = data.filter((x) => x.name === n);
    await createTimeSlotAlarms(data);
  }

  if (alarm.name.endsWith("begin")) {
    let sitesOfGroup = isGroup ? await getSiteNamesOfGroup(n) : undefined;
    await redirectTabsRestrictedByAlarm(isGroup, n, sitesOfGroup, tabs);
  }

  await chrome.alarms.clear(alarm.name);
}

async function handleConsecutiveTimeAlarm(name) {
  if (!name) return;

  logger.warning(`handleConsecutiveTimeAlarm with param ${name}`);
  let n = name.split("-").shift();
  let storageKey = n.includes(".") ? "sites" : "groups";
  let sitesOfGroup =
    storageKey === "groups" ? await getSiteNamesOfGroup(n) : undefined;

  // If check, means that site/group with consecutiveTime has not been visited and has to be resetted
  if (name.includes("-check") || name.includes("-end")) {
    logger.info(
      `Alarm is check or end (${name}), resetting consecutive time and adding to total time`
    );

    try {
      // Adding consecutiveTime to totalTime and resetting it
      let { records = [] } = await chrome.storage.local.get("records");
      let todayRecord = await getTodayRecord(records);
      let sitesToUpdate = sitesOfGroup || [todayRecord[n]];
      // logger.info("sitesToUpdate before check or end :", sitesToUpdate);
      sitesToUpdate.forEach((s) => {
        todayRecord[s].totalTime += todayRecord[s].consecutiveTime;
        todayRecord[s].consecutiveTime = 0;
      });
      // logger.info("resulting todayRecord :", todayRecord);
      // logger.info("resulting records", records)
      await chrome.storage.local.set({ records: records });
      await chrome.alarms.clear(name);
      return;
    } catch (error) {
      logger.error(error);
    }
  }

  // beginning of restriction, either site or group has the restriction
  // logger.info("Beggining of restriction for site or group");
  let currentDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date()
  );
  try {
    let data = await chrome.storage.local.get(storageKey);
    data = data[storageKey];
  } catch (error) {
    logger.error("Error while fetching storageKey", storageKey);
    return;
  }

  let item = data.find((x) => x.name === n);
  let consecutiveTimeRestriction = findTodayRestriction(
    currentDay,
    item.restrictions,
    "consecutiveTime"
  );

    // If no restriction for a site, let's check the group
    if (!consecutiveTimeRestriction && storageKey === "sites") {
      let { groups = [] } = await chrome.storage.local.get("groups");
      let restrictions = groups.find((x) => x.name === item.group).restrictions;
      consecutiveTimeRestriction = findTodayRestriction(
        currentDay,
        restrictions,
        "consecutiveTime"
      );
    }


  // logger.debug("ConsecutiveTimeRestriction", consecutiveTimeRestriction)
  let endOfRestriction = new Date();
  if (consecutiveTimeRestriction) {
    // Adds time in milliseconds
    endOfRestriction.setTime(
      endOfRestriction.getTime() + consecutiveTimeRestriction.pause * 1000
    );

    await chrome.alarms.create(`${n}-consecutive-time-restriction-end`, {
      delayInMinutes: consecutiveTimeRestriction.pause / 60,
    });
  } else {
    await chrome.alarms.clear(name);
    return;
  }

  let tabs = await chrome.tabs.query({});
  // need to better check urls non empty
  tabs = tabs.filter((t) =>
    sitesOfGroup
      ? t.url && sitesOfGroup.includes(new URL(t.url).host)
      : t.url && new URL(t.url).host === n
  );

  try {
    await redirectTabsRestrictedByAlarm(
      storageKey === "groups",
      n,
      sitesOfGroup,
      tabs,
      endOfRestriction ? endOfRestriction.toLocaleTimeString() : null
    );
  } catch (error) {
    logger.error("Error during tab redirection", error);
  }

  await chrome.alarms.clear(name);
}

async function redirectTabsRestrictedByAlarm(
  isGroup,
  name,
  sites = undefined,
  tabs,
  endOfRestriction = null
) {
  let targets = isGroup ? sites : [name];
  logger.debug(
    "redirectTabsRestrictedByAlarm",
    isGroup,
    name,
    sites,
    tabs,
    "Targets for redirection is",
    targets
  );

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const url = encodeURIComponent(tab.url);
    const host = encodeURIComponent(new URL(tab.url).host);
    // logger.debug("url is ", url, "and host is ", host,
    // "If host not in targets, won't redirect"
    //  )

    if (!targets.includes(host)) {
      continue;
    }

    logger.warning(`Tab ${tab.id} should be redirected from ${tab.url}`);
    await chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL(
        `ui/redirected/redirected.html?url=${url}&host=${host}${
          endOfRestriction ? "&eor=" + endOfRestriction : ""
        }`
      ),
    });
  }
}

/**
 *
 * @param {Array} items
 */
async function createTimeSlotAlarms(items) {
  logger.debug("Create time slot alarm", items);
  const currentDay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date());
  const currentTime = new Date().toLocaleTimeString("fr-FR");

  for (let i = 0; i < items.length; i++) {
    let s = items[i];
    let todayRestriction = findTodayRestriction(
      currentDay,
      s.restrictions,
      "timeSlot"
    );

    if (!todayRestriction) continue;

    // Getting only the next alarm to set, hence the breaks
    let timeSlots = todayRestriction.time;
    let filteredTimeSlots = [];
    for (let j = 0; j < timeSlots.length; j++) {
      if (timeSlots[j][0] < currentTime && currentTime < timeSlots[j][1]) {
        filteredTimeSlots = timeSlots[j];
        break;
      } else if (
        timeSlots[j + 1] &&
        timeSlots[j][1] < currentTime &&
        currentTime < timeSlots[j + 1][0]
      ) {
        filteredTimeSlots = timeSlots[j + 1];
        break;
      }
    }

    if (!filteredTimeSlots || filteredTimeSlots.length === 0) {
      continue;
    }

    let index = -1;
    if (filteredTimeSlots[0] > currentTime) {
      index = 0;
    } else if (
      filteredTimeSlots[1] > currentTime ||
      filteredTimeSlots[1] === "00:00"
    ) {
      index = 1;
    }
    if (index === -1) {
      continue;
    }

    let [hours, minutes] = filteredTimeSlots[index].split(":");
    let futureDate = new Date();
    futureDate.setHours(hours);
    futureDate.setMinutes(minutes);
    futureDate.setSeconds(0);

    let delay = (futureDate - Date.now()) / 1000 / 60;
    let alarmName = `${s.name}-time-slot-restriction-${
      index === 1 ? "end" : "begin"
    }`;
    logger.debug(`creating a time slot alarm with name ${alarmName} and delay in minutes ${delay}`);
    await chrome.alarms.create(alarmName, { delayInMinutes: delay });
    console.groupEnd();
    break;
  }
}

/**
 *
 * First written to handle from handleOnStorageChange, so is either group or sites,
 * and takes every value in newChanges (all sites or all groups)
 * @param {Array} items - and array of strings (names of groups or sites)
 * @param {Object} record - current day record
 * @returns record
 */
export async function createConsecutiveTimeAlarms(items, record) {
  let currentDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date()
  );
  let isGroup = !items.find((x) => x.name.includes("."));

  if (isGroup) {
    for (let i = 0; i < items.length; i++) {
      let todayCt = findTodayRestriction(
        currentDay,
        items[i].restrictions,
        "consecutiveTime"
      );
      if (!todayCt) continue;

      let groupSum = 0;
      let sites = await getSiteNamesOfGroup(items[i].name);
      // logger.debug("Tracking sites undefined error. Sites are :", sites, sites.map((s) => record[s]))
      if (!sites.length) continue;
      sites.forEach((s) => {
        if (!record[s].consecutiveTime && record[s].initDate) {
          groupSum += (Date.now() - record[s].initDate) / 1000;
        } else {
          record[s].consecutiveTime = record[s].consecutiveTime || 0;
          groupSum += record[s].consecutiveTime;
        }
      });

      if (groupSum === 0) continue;
      if (groupSum < todayCt.consecutiveTime) {
        let delay =
          (new Date(
            new Date().getTime() + (todayCt.consecutiveTime - groupSum) * 1000
          ) -
            Date.now()) /
          1000 /
          60;
        await chrome.alarms.create(
          `${items[i].name}-consecutive-time-restriction-begin`,
          { delayInMinutes: delay }
        );
      }
      if (groupSum >= todayCt.consecutiveTime) {
        let delay =
          (new Date(new Date().getTime() + todayCt.pause * 1000) - Date.now()) /
          1000 /
          60;
        await chrome.alarms.create(
          `${items[i].name}-consecutive-time-restriction-end`,
          { delayInMinutes: delay }
        );
      }
    }

    return record;
  }

  for (let j = 0; j < items.length; j++) {
    let { name, restrictions } = items[j];
    let itemRecord = record[name];

    let todayConsecutiveTime = findTodayRestriction(
      currentDay,
      restrictions,
      "consecutiveTime"
    );

    if (itemRecord.consecutiveTime) {
      itemRecord.totalTime += itemRecord.consecutiveTime;
    }

    if (!todayConsecutiveTime) {
      delete itemRecord.consecutiveTime;
      continue;
    }

    if (!itemRecord.initDate) {
      itemRecord.consecutiveTime = 0;
      continue;
    }

    if (itemRecord.initDate && !itemRecord.consecutiveTime) {
      let delay = (Date.now() - itemRecord.initDate) / 1000 / 60;
      await chrome.alarms.create(
        `${items[j].name}-consecutive-time-restriction-begin`,
        { delayInMinutes: delay }
      );
    }
  }

  return record;
}

/**
 *
 * Create a consecutive time or a total time beginnning alarm for site or group if needed
 * Returns true if a site is restricted (alarm end) or not (alarm begin)
 * @async
 * @param {string|Object} [site=null] - either the name or the object, default null
 * @param {Object} [todayRecord=null] - either the object or null
 * @returns {boolean}
 */
export async function checkIfCreateConsecutiveOrTotalTimeAlarm(
  site = null,
  todayRecord = null
) {
  logger.warning("checkIfCreateConsecutiveOrTotalTimeAlarm", site, todayRecord);
  const sites = null;

  if (!site) {
    logger.error(
      "Cannot check the alarm to set for consecutiveTime or totalTime without site"
    );
    return;
  }

  // Insuring we always have an object or null
  if (typeof site === "string") {
    const { sites = [] } = await chrome.storage.local.get("sites");
    site = sites.find((x) => x.name === site);
  }

  if (!todayRecord) {
    const { records = [] } = await chrome.storage.local.get("records");
    todayRecord = await getTodayRecord(records);
  }

  const { groups = [] } = await chrome.storage.local.get("groups");
  const group = groups.find((x) => x.name === site.group);

  // This is disgusting, need to get a grip on this.
  const alarms = await chrome.alarms.getAll();
  const beginAlarms = [`${site.name}-consecutive-time-restriction-begin`,
    `${site.name}-total-time-restriction-begin`,
    `${group.name}-consecutive-time-restriction-begin`,
    `${group.name}-total-time-restriction-begin`,
  ]
  const endAlarms = [
    `${site.name}-consecutive-time-restriction-end`,
    `${group.name}-consecutive-time-restriction-end`,
  ]
  if (alarms.some((el) => beginAlarms.includes(el))) {
    return false;
  } else if (alarms.some((el) => endAlarms.includes(el))) {
    return true;
  }

  let allSiteRestrictions = findAllTodayRestrictionsFor(site);
  let allGroupRestrictions = findAllTodayRestrictionsFor(group);

  let keys = [];
  if (
    (allSiteRestrictions && allSiteRestrictions.consecutiveTime) ||
    (allGroupRestrictions && allGroupRestrictions.consecutiveTime)
  ) {
    keys.push("consecutiveTime");
  }
  if (
    (allSiteRestrictions && allSiteRestrictions.totalTime) ||
    (allGroupRestrictions && allGroupRestrictions.totalTime)
  ) {
    keys.push("totalTime");
  }

  if (!keys.length) {
    logger.info("No need to set any alarm : no restrictions");
    return;
  }

  let consecutiveTime = null;
  let totalTime = null;
  let whatItIs = null;
  let n = null;

  logger.debug("allSiteRestrictions", allSiteRestrictions,
    "allgroupRestrictions", allGroupRestrictions)

  // get site and group current consecutive time
  let currentAlarmDelay = null;
  for (let k of keys) {

    if (site && allSiteRestrictions && k in allSiteRestrictions) {
      currentAlarmDelay = todayRecord[site.name][k] - allSiteRestrictions[k][k];
      n = site.name;
      whatItIs = "site";
    }

    if (site.group && allGroupRestrictions && k in allGroupRestrictions) {
      // Even if we have the time left for the site, need to check if the group has less time or not
      const groupTimeLeft = await getSumOfGroupTime(
        group,
        k,
        allGroupRestrictions,
        sites,
        todayRecord
      );
      if (
        groupTimeLeft &&
        (!currentAlarmDelay || groupTimeLeft < currentAlarmDelay)
      ) {
        currentAlarmDelay = groupTimeLeft;
        n = site.group;
        whatItIs = "group";
      }
    }

    if (!n) continue;
    
    if (k === "consecutiveTime") {
      consecutiveTime = {
        name: `${n}-consecutive-time-restriction-begin`,
        delayInSeconds: currentAlarmDelay,
      };
    } else {
      totalTime = {
        name: `${n}-total-time-restriction-begin`,
        delayInSeconds: currentAlarmDelay,
      };
    }
  }

  if (!n) {
    logger.info("No need for restriction apparently", allSiteRestrictions, allGroupRestrictions)
    return false;
  }

  logger.debug(
    "Out of the loop with consecutiveTime :",
    consecutiveTime,
    "totalTime : ",
    totalTime
  );

    if (consecutiveTime && consecutiveTime.delayInSeconds <= 0) {
      let pause =
        whatItIs === "site"
          ? allSiteRestrictions.consecutiveTime[0].pause
          : allGroupRestrictions.consecutiveTime[0].pause;
      let delay =
        (new Date(new Date().getTime() + pause * 1000) - Date.now()) /
        1000 /
        60;
      await chrome.alarms.create(
        `${consecutiveTime.name}-consecutive-time-restriction-end`,
        { delayInMinutes: delay }
      );
      logger.info(
        "Creating an alarm with name" +
          ` ${consecutiveTime.name}-consecutive-time-restriction-end and delayInMinutes ${delay}`
      );
      return true;
    } else if (totalTime && totalTime.delayInSeconds <= 0) {
      // Should already restricted in the chrome tabs updated and will probably never activate
      logger.debug("Should create a totalTime alarm for site", site);
      return true;
    }

    if (consecutiveTime && totalTime) {
      consecutiveTime.delayInSeconds <= totalTime.delayInSeconds
        ? await chrome.alarms.create(consecutiveTime.name, {
            delayInMinutes: consecutiveTime.delayInSeconds / 60,
          })
        : await chrome.alarms.create(totalTime.name, {
            delayInMinutes: totalTime.delayInSeconds / 60,
          });
    } else if (consecutiveTime) {
      logger.info(
        `creating alarm ${consecutiveTime.name} with delayInMinutes ${
          consecutiveTime.delayInSeconds / 60
        }`
      );
      await chrome.alarms.create(consecutiveTime.name, {
        delayInMinutes: consecutiveTime.delayInSeconds / 60,
      });
    } else if (totalTime) {
      await chrome.alarms.create(totalTime.name, {
        delayInMinutes: totalTime.delayInSeconds / 60,
      });
    } else {
      logger.error(
        `Error while setting alarm for ${site}`,
        consecutiveTime,
        totalTime
      );
    }
    return false;
}

/**
 * Handles time counting for group for restrictions that need it :
 * consecutive time and total time
 * Default null params will generate requests to storage
 * @param {string} group - group object
 * @param {string} k - key to search in restriction
 * @param {Object} restriction - restriction object of group
 * @param {Array} [sites=null] - the return of get sites.sites, default null
 * @param {Object} [todayRecord=null] - record of the day, default null
 * @returns {Number|null} - Number of seconds left or null if no restriction
 */
async function getSumOfGroupTime(
  group,
  k,
  restriction,
  sites = null,
  todayRecord = null
) {
  if (!sites) {
    const call = await chrome.storage.local.get("sites");
    sites = call.sites || []
  }
  if (!todayRecord) {
    const { records = [] } = await chrome.storage.local.get("records");
    todayRecord = await getTodayRecord(records);
  }

  let groupSites = sites
    .filter((x) => x.group === group.name)
    .map((x) => x.name);
  let timeLimit =
    k === "consecutiveTime"
      ? restriction.consecutiveTime[0].consecutiveTime
      : restriction.totalTime[0].totalTime;
  
  let sum = groupSites.reduce((curr, acc) => curr + todayRecord[acc][k], 0);

  return timeLimit - sum;
}

async function getTodayRecord(records) {
  let date = new Date().toISOString().split("T")[0];
  let todayRecord = records[date];
  if (!todayRecord) {
    todayRecord = await setRecords(date);
  }
  return todayRecord;
}