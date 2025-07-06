/**
 * @typedef {Object} ViolationStatus - Object that restrictions return for an AlarmManager
 * @property {boolean} violated - if restriction is violated or not
 * @property {Number} minutesBeforeRes - Minutes calculated before restriction
 */

// Represents a collection of time slot restrictions for a given entity (e.g., site or group)
export class TimeSlotRestriction {
  /**
   * @param {Array} res - An array of restriction objects, each containing a `day` and a `time` property.
   *                      The `time` property is expected to be an array of time ranges:
   *                      e.g., [[start1, end1], [start2, end2]], where start/end are strings like "14:00"
   */ 
  constructor(res) {
    this.restriction = res;
  }

  /**
   * Checks if the current time falls within *any* of the defined time slots.
   * Returns true if a violation is found (i.e., we are currently within a restricted time slot).
   *
   * @returns {boolean} true if now is within a restricted slot, false otherwise
   */
  isViolated() {
    if (!this.restriction || this.restriction.length === 0) {
      return false;
    }

    for (let res of this.restriction) {
      let timeSlots = res.time;
      let currentTime = new Date().toLocaleTimeString("fr-FR");
      for (let j = 0; j < timeSlots.length; j++) {
        if (timeSlots[j][0] < currentTime && currentTime < timeSlots[j][1]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * @typedef {Object} Threshold
   * @property {'begin'|'end'} phase - if the time correspond to the beginning or end of restriction
   * @property {string} time - the next time for alarm in "00:00" format
   */
  /**
   * Finds the next time threshold (start or end) in the defined time slots
   * that comes after the current time.
   *
   * Intended to identify when the next time slot will *start* or *end*,
   * to help schedule the next alarm.
   * Might be chained to Site|Group.todayRestrictions which can be undefined.
   *
   * @returns {Threshold | undefined} The next relevant threshold, or undefined if none found.
   */
  getFollowingTime() {
    if (!this.restriction)
      return undefined;

    for (let res of this.restriction) {
      let timeSlots = res.time;
      let currentTime = new Date().toLocaleTimeString("fr-FR");
      for (let j = 0; j < timeSlots.length; j++) {
        let slot = timeSlots[j];
        if (slot[0] > currentTime) {
          return {phase : "begin", time : slot[0]};
        } else if (slot[1] > currentTime || slot[1] === "00:00") {
          return {phase : "end", time : slot[1]}
        };
      }
    }
    
    return undefined;
  }
}

import { RecordManager } from "./recordManager.js";
import { EntitiesCache, Site } from "./siteAndGroupModels.js";

/**
 * Use Case :
 * TotalTimeRestriction(Group, rm, ec)
 */
export class TotalTimeRestriction {
  /**
   * @typedef {Object} TotalTimeConfig
   * @property {string[]} days - days in english where this restrictions happen
   * @property {Number} totalTime - total time in seconds
   */
  /**
   * @param {Site|Group} groupOrSiteObj - the site or group we want to evaluate
   * @param {RecordManager} rm - the RecordManager singleton
   * @param {EntitiesCache} ec - the EntitiesCache singleton
   */
  constructor(groupOrSiteObj, rm, ec) {
    this.entity = groupOrSiteObj;
    /** @type {TotalTimeConfig[]|undefined} */
    this.restriction = this.entity.todayRestrictions?.totalTime
    this.rm = rm;
    this.ec = ec;
  }

  /**
   * @param {Object} Metadata - what site or group is to be checked and how
   * @param {string} metadata.target - a host or group name
   * @param {'site'|'group'} metadata.type
   * @returns {ViolationStatus}
   */
  isViolated() {
    if (!this.restriction) {
      return { violated : false, minutesBeforeRes : undefined }
    }

    let result = this.entity instanceof Site
        ? this.#getSiteTimeLeft(this.entity.name)
        : this.#getGroupTimeLeft(this.entity.sites);

    if (this.entity instanceof Site && result > 0) {
      let group = this.ec.getGroupByName(this.entity.group);
      let groupRes = this.#getSiteGroupTimeLeft(group);
      if (groupRes.violated && groupRes.minutesBeforeRes < result) {
        return groupRes;
        }
    }

    return result > 0
      ? { violated: true, minutesBeforeRes: result }
      : { violated: false, minutesBeforeRes: undefined };
  }

  /**
   * 
   * @param {Group} group - the corresponding Group to a site
   * @returns {ViolationStatus} - if the group violates a totalTime restriction or not
   */
  #getSiteGroupTimeLeft(group) {
    return new TotalTimeRestriction(group, this.rm, this.ec).isViolated();
  }

  #getGroupTimeLeft(targets) {
    return targets.reduce( (sum, t) => this.#getSiteTimeLeft(t) + sum, 0);
  }

  #getSiteTimeLeft(target) {
    let tsr = this.rm.getTodaySiteRecord(target);
    return this.#getTimeBeforeRestriction(tsr);
  }

  #getTimeBeforeRestriction(siteRec) {
    if (!siteRec.initDate)
      return (this.restriction.totalTime - siteRec.totalTime) / 60;

    let tt = siteRec.totalTime + (new Date() - siteRec.initDate) / 1000;
    return (this.restriction.totalTime - tt) / 60;
  }
}