import { bookkeepingQueue } from "./bookkeepingQueue.js";
import { setRecords } from "./settingRecord.js";
import {
  findAllTodayRestrictionsFor,
  findTodayRestriction,
  getGroups,
  getSiteNamesOfGroup,
} from "./commons.js";
import { logger } from "./logger.js";
import { Site, Group, EntitiesCache } from "./siteAndGroupModels.js";
import { AlarmManager } from "./alarmManager.js";
import { TimeSlotRestriction } from "./restrictions.js";
import { RecordManager } from "./recordManager.js";

/**
 * 
 * @param {EntitiesCache} entitiesCache 
 */
export async function handleAlarms(entitiesCache) {
  if (!(await alarmsAreSet())) {
    createAlarms(entitiesCache);
  }
}

async function alarmsAreSet() {
  let alarms = await chrome.alarms.getAll();
  return alarms.length !== 0;
}
/**
 * This only creates timeSlot alarms at startUp or when restrictions updated
 * They are the only predictable ones
 * @param {EntitiesCache} entitiesCache 
 */
export async function createAlarms(entitiesCache) {
  let tsah = new TimeSlotAlarmHandler(null, null, entitiesCache)
  await tsah.initializeEveryAlarm();
}

/**
 * 
 * @param {Object} changes 
 * @param {EntitiesCache} entitiesCache 
 * @param {*} area 
 * @returns 
 */
export async function handleStorageChange(changes, entitiesCache, area) {
  if (
    "busy" in changes &&
    !changes.busy.newValue &&
    changes.busy.oldValue &&
    bookkeepingQueue.queue.length
  ) {
    bookkeepingQueue.dequeue();
  }

  if (!("sites" in changes || "groups" in changes)) return;

  entitiesCache.updateFromChange(changes);
  let { records = [] } = await chrome.storage.local.get("records");
  const rm = new RecordManager(records);
  rm.updateFromChange(changes, entitiesCache);
  await rm.save();

  await chrome.alarms.clearAll();

  let tsah = new TimeSlotAlarmHandler(null, null, entitiesCache)
  await tsah.initializeEveryAlarm();

  let key = Object.keys(changes).shift()
  await createConsecutiveTimeAlarms(changes[key].newValue, rm.todayRecord);

  logger.info("TodayRecord is now", rm.todayRecord)
  await rm.save();
}

export async function handleOnAlarm(alarm, entitiesCache) {
  logger.info("HandleOnAlarm : ", alarm);
  let parsedAlarm = parseAlarmName(alarm)
  let [n, r, type] = alarm.name.split("-");



  // Not handling total-time : always begin, no end, always redirect.
  if (alarm.name.includes("-consecutive-time")) {
    logger.info("Will hop into handleConsecutiveTimeAlarm");
    await handleConsecutiveTimeAlarm(alarm.name);
    return;
  } else if (alarm.name.includes("-time-slot")) {
      let handler = createAlarmHandler(alarm, entitiesCache);
      handler.handle(entitiesCache)
      return;
  }

  if (alarm.name.endsWith("begin")) {
    let tabs = await chrome.tabs.query({});
    let sites = parsedAlarm.isGroup ? entitiesCache.getGroupByName(parsedAlarm.target) : entitiesCache.getSiteByName(parsedAlarm.target);
    await redirectTabsRestrictedByAlarm(parsedAlarm, sites, tabs, null);
  }

  await chrome.alarms.clear(alarm.name);
}

async function handleConsecutiveTimeAlarm(name) {
  if (!name) return;

  logger.warning(`handleConsecutiveTimeAlarm with param ${name}`);
  parsedAlarm = parseAlarmName({name})
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
      parsedAlarm,
      [n],
      tabs,
      endOfRestriction ? endOfRestriction.toLocaleTimeString() : null
    );
  } catch (error) {
    logger.error("Error during tab redirection", error);
  }

  await chrome.alarms.clear(name);
}

async function redirectTabsRestrictedByAlarm(
  parsedAlarm,
  sitesToBeRedirected,
  tabs,
  endOfRestriction = null
) {
  let targets = parsedAlarm.isGroup ? sitesToBeRedirected.map(x => x.name) : sitesToBeRedirected;

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const url = encodeURIComponent(tab.url);
    const host = encodeURIComponent(new URL(tab.url).host);

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

/**
 * @typedef {Object} Alarm
 * @property {string} name - Name of the alarm
 * @property {Number} scheduledTime - time in milliseconds after epoch
 */

/**
 * @typedef {Object} ParsedAlarm
 * @property {string} originalName - the original name of the alarm
 * @property { string } target - host or group name
 * @property { 'time'|'consecutive'|'total' } restriction - keyword for restriction
 * @property { 'begin'|'check'|'end' } phase - state of the restriction
 * @property { boolean } isGroup - whether target refers to a group or not
 */

/**
 * @param {{name : string}} anAlarm 
 * @returns {ParsedAlarm} - object with the parsing of the alarm name
 */
function parseAlarmName(anAlarm) {
  let splittedName = anAlarm.name.split("-");
  return {originalName : anAlarm.name,
    target : splittedName[0],
    restriction : splittedName[1],
    phase : splittedName[splittedName.length -1],
    isGroup : anAlarm.name.includes(".")
  }
}

/**
 * 
 * @param {Alarm} anAlarm 
 * @param {EntitiesCache} entitiesCache 
 * @returns 
 */
function createAlarmHandler(anAlarm, entitiesCache) {
  let parsed = parseAlarmName(anAlarm)

  switch (parsed.restriction) {
    case "time":
      return new TimeSlotAlarmHandler(anAlarm, parsed, entitiesCache);
    case "consecutive":
      throw new Error("Not implemented yet");
      return new ConsecutiveTimeAlarmHandler(anAlarm, parsed).handle();
      break;
    case "total":
      throw new Error("Not Implemented yet");
      return new TotalTimeAlarmHandler(anAlarm, parsed).handle();
      break;
    default:
      throw new Error("Alarm restriction doesn't exist", parsed.restriction)
  }
}

class TimeSlotAlarmHandler {
  /**
   * 
   * @param {Alarm} alarm 
   * @param {ParsedAlarm} parsed 
   * @param {EntitiesCache} entitiesCache 
   */
  constructor(alarm, parsed, entitiesCache) {
    this.alarm = alarm;
    this.parsed = parsed;
    this.entcache = entitiesCache;
    /** @type {AlarmManager} */
    this.manager = new AlarmManager();
  }

  /**
   * Handles a Time Slot alarm.
   */
  async handle() {
    let entity = this.parsed.isGroup
      ? this.entcache.getGroupByName(this.parsed.target)
      : this.entcache.getSiteByName(this.parsed.target);

    if (!entity) {
      logger.error("No host or group corresponding to timeSlot alarm!");
      return;
    }

    next = new TimeSlotRestriction(
      entity.todayRestrictions.timeSlot
    ).getFollowingTime();

    if (this.parsed.phase === "begin") {
      await this.manager.setAlarm(
        `${this.parsed.target}-time-slot-restriction-end`,
        { delayInMinutes: this.#calculateDelay(next) }
      );

      let tabs = await chrome.tabs.query({});
      await redirectTabsRestrictedByAlarm(
        this.parsed,
        this.parsed.isGroup ? entity.sites : [],
        tabs,
        null
      );
    } else if (this.parsed.phase === "end") {
      await this.manager.setAlarm(
        `${this.parsed.target}-time-slot-restriction-begin`,
        { delayInMinutes: this.#calculateDelay(next) }
      );
    }

    await this.manager.deleteAlarm(this.parsed.originalName);
  }

  /**
   * Create all the time slot alarms.
   * Used for initializations of extension or reset following storage change.
   */
  async initializeEveryAlarm() {
    for (let group of this.entcache.groups) {
      if (!group.todayRestrictions?.timeSlot) continue;
      let next = new TimeSlotRestriction( group.todayRestrictions?.timeSlot).getFollowingTime();
      if (!next) continue;
      await this.manager.setAlarm(`${group.name}-time-slot-restriction-begin`, {
        delayInMinutes: this.#calculateDelay(next),
      });
    }
    for (let site of this.entcache.sites) {
      if (!site.todayRestrictions?.timeSlot) continue;
      let next = new TimeSlotRestriction(site.todayRestrictions.timeSlot).getFollowingTime();
      if (!next) continue;
      await this.manager.setAlarm(`${site.name}-time-slot-restriction-begin`, {
        delayInMinutes: this.#calculateDelay(next),
      });
    }
  }

  #calculateDelay(time) {
    let futureDate = new Date();
    if (time === "00:00") {
      futureDate.setDate(futureDate.getDate() + 1);
    }
    let [hours, minutes] = time.split(":");
    futureDate.setHours(hours);
    futureDate.setMinutes(minutes);
    futureDate.setSeconds(0);

    return (futureDate - Date.now()) / 1000 / 60;
  }
}

