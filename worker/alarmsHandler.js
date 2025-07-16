import { bookkeepingQueue } from "./bookkeepingQueue.js";
import { setRecords } from "./settingRecord.js";
import {
  findAllTodayRestrictionsFor,
  findTodayRestriction,
  getSiteNamesOfGroup,
} from "./commons.js";
import { logger } from "./logger.js";
import { EntitiesCache, Group } from "./siteAndGroupModels.js";
import { AlarmManager } from "./alarmManager.js";
import { TimeSlotRestriction } from "./restrictions.js";
import { RecordManager } from "./recordManager.js";
import { TabManager } from "./tabManager.js";

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
  await tsah.initializeEveryAlarm(new AlarmManager());
}

/**
 * 
 * @param {Object} changes 
 * @param {EntitiesCache} entitiesCache 
 * @param {RecordManager} rm - recordManager singleton
 * @param {string} area 
 */
export async function handleStorageChange(changes, entitiesCache, rm, area) {
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
  rm.updateFromChange(changes, entitiesCache);
  await rm.save();

  await chrome.alarms.clearAll();

  let tsah = new TimeSlotAlarmHandler(null, null, entitiesCache)
  await tsah.initializeEveryAlarm(new AlarmManager);

  logger.info("TodayRecord is now", rm.todayRecord)
  await rm.save();
}

export async function handleOnAlarm(alarm, entitiesCache, recordManager) {
  logger.info("HandleOnAlarm : ", alarm);
  let handler = createAlarmHandler(alarm, entitiesCache, recordManager);
  try {
    handler.handle(new TabManager(), new AlarmManager())
  } catch(error) {
    logger.error("Problem during the handling of the alarm", error);
    throw new Error("Problem during the handling of the alarm", error);
  }
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
    isGroup : !anAlarm.name.includes(".")
  }
}

/**
 * 
 * @param {Alarm} anAlarm 
 * @param {EntitiesCache} entitiesCache 
 * @returns {TimeSlotAlarmHandler | ConsecutiveTimeAlarmHandler | TotalTimeAlarmHandler }
 */
function createAlarmHandler(anAlarm, entitiesCache, recordManager) {
  let parsed = parseAlarmName(anAlarm)

  switch (parsed.restriction) {
    case "time":
      return new TimeSlotAlarmHandler(anAlarm, parsed, entitiesCache);
    case "consecutive":
      return new ConsecutiveTimeAlarmHandler(anAlarm, parsed, entitiesCache, recordManager);
    case "total":
      return new TotalTimeAlarmHandler(anAlarm, parsed, entitiesCache);
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
  }

  /**
   * Handles a Time Slot alarm.
   * @param {TabManager} tabManager
   */
  async handle(tabManager, alarmManager) {
    let entity = this.parsed.isGroup
      ? this.entcache.getGroupByName(this.parsed.target)
      : this.entcache.getSiteByName(this.parsed.target);

    if (!entity) {
      logger.error("No host or group corresponding to timeSlot alarm!");
      return;
    }

    let next = new TimeSlotRestriction(entity, this.entcache).getFollowingTime()

    if (this.parsed.phase === "begin") {
      await alarmManager.setAlarm(
        `${this.parsed.target}-time-slot-restriction-end`,
        { delayInMinutes: this.#calculateDelay(next.time) }
      );

      const tabs = await tabManager.getAll();
      await tabManager.redirectTabsRestrictedByAlarm(
        this.parsed.isGroup ? entity.sites : [this.parsed.target],
        tabs,
        next.time
      );
    } else if (this.parsed.phase === "end" && next) {
      await alarmManager.setAlarm(
        `${this.parsed.target}-time-slot-restriction-begin`,
        { delayInMinutes: this.#calculateDelay(next.time) }
      );
    }

    await alarmManager.deleteAlarm(this.parsed.originalName);
  }

  /**
   * Create all the time slot alarms.
   * Used for initializations of extension or reset following storage change.
   * @param {AlarmManager}
   */
  async initializeEveryAlarm(alarmManager) {

    for (let group of this.entcache.groups) {
      if (!group.todayRestrictions?.timeSlot) continue;
      let next = new TimeSlotRestriction(group, this.entcache).getFollowingTime();
      if (!next) continue;
      await alarmManager.setAlarm(`${group.name}-time-slot-restriction-${next.phase}`, {
        delayInMinutes: this.#calculateDelay(next.time),
      });
    }

    for (let site of this.entcache.sites) {
      if (!site.todayRestrictions?.timeSlot) continue;
      let next = new TimeSlotRestriction(site, this.entcache).getFollowingTime();
      if (!next) continue;
      await alarmManager.setAlarm(`${site.name}-time-slot-restriction-${next.phase}`, {
        delayInMinutes: this.#calculateDelay(next.time),
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

class TotalTimeAlarmHandler
{  /**
   * 
   * @param {Alarm} alarm 
   * @param {ParsedAlarm} parsed 
   * @param {EntitiesCache} entitiesCache 
   */
  constructor(alarm, parsed, entitiesCache) {
    this.alarm = alarm;
    this.parsed = parsed;
    this.entcache = entitiesCache;
  }

  /**
   * Handles a Time Slot alarm.
   * @param {TabManager} tabManager
   * @param {AlarmManager} alarmManager
   */
  async handle(tabManager, alarmManager) {
    let tabs = await chrome.tabs.query({});
    await tabManager.redirectTabsRestrictedByAlarm(
      this.parsed.isGroup ? entity.sites : [this.parsed.target],
      tabs,
      null
    );
    await alarmManager.deleteAlarm(this.parsed.originalName);
  }
}

export
class ConsecutiveTimeAlarmHandler {
  /**
   *
   * @param {Alarm} alarm
   * @param {ParsedAlarm} parsed
   * @param {EntitiesCache} entitiesCache
   * @param {RecordManager} recordManager
   */
  constructor(alarm, parsed, entitiesCache, recordManager) {
    /** @type {Alarm} */
    this.alarm = alarm;
    /** @type {ParsedAlarm} */
    this.parsed = parsed;
    /** @type {EntitiesCache} */
    this.entcache = entitiesCache;
    /** @type {RecordManager} */
    this.rm = recordManager;
  }

  /**
   * Handles a Time Slot alarm.
   * @param {TabManager} tabManager
   */
  async handle(tabManager, am = new AlarmManager()) {
    let entity = this.parsed.isGroup
      ? this.entcache.getGroupByName(this.parsed.target)
      : this.entcache.getSiteByName(this.parsed.target);

    let endOfRestriction = new Date();
    let pause = entity.todayRestrictions?.consecutiveTime[0].pause;
    endOfRestriction = new Date(endOfRestriction.getTime() + pause * 1000)

    if (this.parsed.phase === "begin") {
      let tabs = tabManager.getAll();
      tabManager.redirectTabsRestrictedByAlarm(
        this.parsed.isGroup ? entity.sites : [this.parsed.target],
        tabs,
        endOfRestriction.toLocaleTimeString()
      );

      am.setAlarm(
        this.parsed.target + "-consecutive-time-restriction-end",
        { delayInMinutes: entity.todayRestrictions?.consecutiveTime.pause / 60 }
      );
    } else if (this.parsed.phase === "check" || this.parsed.phase === "end") {
      this.rm.resetConsecutiveTime(entity);
    }  else {
      throw new Error("Wrong phase is being called", this.parsed.phase);
    }

    await am.deleteAlarm(this.parsed.originalName);
  }
}

export { ConsecutiveTimeAlarmHandler, TimeSlotAlarmHandler }; // test-only