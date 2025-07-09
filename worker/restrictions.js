import { Group } from "./siteAndGroupModels.js";

/**
 * @typedef {Object} ViolationStatus - Object that restrictions return for an AlarmManager
 * @property {boolean} violated - if restriction is violated or not
 * @property {Number} minutesBeforeRes - Minutes calculated before restriction
 * @property {'timeSlot'|'totalTime'|'consecutiveTime'} restriction - name of the restriction
 * @property {string} entity - name of the entity linked to that ViolationStatus object
 */

// Represents a collection of time slot restrictions for a given entity (e.g., site or group)
export class TimeSlotRestriction {
  /**
   * @typedef {Object} ConsecutiveTimeConfig
   * @property {string[]} days - days in english where this restrictions happen
   * @property {string[]} time - time array of at least one array with beginning and end of slot in form ["10:00", "12:00"]
   */
  /**
   * @param {Site|Group} entity - the site or group we want to evaluate
   * @param {EntitiesCache} ec - the EntitiesCache singleton
   */
  constructor(entity, ec) {
    this.entity = entity;
    /** @type {ConsecutiveTimeConfig|undefined} */
    this.restriction = this.entity.todayRestrictions?.timeSlot;
    this.ec = ec;
  }

  /**
   * Checks if the current time falls within *any* of the defined time slots.
   * Returns true if a violation is found (i.e., we are currently within a restricted time slot).
   *
   * @returns {boolean} true if now is within a restricted slot, false otherwise
   */
  isViolated() {
    if (!this.restriction) {
      if (this.entity instanceof Site) {
        const group = this.ec.getGroupByName(this.entity.group);
        return group
          ? this.#getGroupViolation(group)
          : this.#createViolationObject(false);
      } else if (this.entity instanceof Group) {
        return this.#createViolationObject(false);
      }
    }
    let result = this.#isEntityViolated();
    if (this.entity instanceof Site && !result.violated) {
      let group = this.ec.getGroupByName(this.entity.group);
      if (!group) return result;
      let groupRes = this.#getGroupViolation(group);
      if (this.#shouldReturnGroupRes()) {
        return groupRes;
      }
    }

    return result;
  }

  #getGroupViolation(group) {
    return new TimeSlotRestriction(group, this.ec).isViolated();
  }

  #isEntityViolated() {
    if (!this.restriction || this.restriction.length === 0) {
      return this.#createViolationObject(false);
    }

    for (let res of this.restriction) {
      let timeSlots = res.time;
      let currentTime = new Date().toLocaleTimeString("fr-FR");
      for (let j = 0; j < timeSlots.length; j++) {
        if (
          timeSlots[j][0] < currentTime &&
          (currentTime < timeSlots[j][1] || timeSlots[j][1] === "00:00")
        ) {
          let next = this.getFollowingTime();
          let mbr = this.#calculateDelay(next.time);
          return this.#createViolationObject(true, mbr);
        }
      }
    }
    return this.#createViolationObject(false);
  }

  #shouldReturnGroupRes() {
    return (
      groupRes.violated ||
      (!result.minutesBeforeRes && groupRes.minutesBeforeRes) ||
      groupRes.minutesBeforeRes <= result.minutesBeforeRes
    );
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
    if (!this.restriction) return undefined;

    // General Array
    for (let res of this.restriction) {
      let currentTime = new Date().toLocaleTimeString("fr-FR");
      // Time Array
      for (let j = 0; j < res.time.length; j++) {
        let slot = res.time[j];
        if (slot[0] > currentTime) {
          return { phase: "begin", time: slot[0] };
        } else if (slot[1] > currentTime || slot[1] === "00:00") {
          return { phase: "end", time: slot[1] };
        }
      }
    }

    return undefined;
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

  #createViolationObject(v, mbr = undefined) {
    return {
      violated: v,
      minutesBeforeRes: mbr,
      restriction: "timeSlot",
      entity: this.entity.name,
    };
  }
}

import { RecordManager } from "./recordManager.js";
import { EntitiesCache, Site } from "./siteAndGroupModels.js";

export class TotalTimeRestriction {
  /**
   * @typedef {Object} TotalTimeConfig
   * @property {string[]} days - days in english where this restrictions happen
   * @property {Number} totalTime - total time in seconds
   */
  /**
   * @param {Site|Group} entity - the site or group we want to evaluate
   * @param {RecordManager} rm - the RecordManager singleton
   * @param {EntitiesCache} ec - the EntitiesCache singleton
   */
  constructor(entity, rm, ec) {
    this.entity = entity;
    /** @type {TotalTimeConfig|undefined} */
    this.restriction = this.#getSmallerRestriction(
      this.entity.todayRestrictions?.totalTime
    );
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
      if (this.entity instanceof Site) {
        const group = this.ec.getGroupByName(this.entity.group);
        return group
          ? this.#getSiteGroupViolation(group)
          : this.#createViolationObject(false);
      } else if (this.entity instanceof Group) {
        return this.#createViolationObject(false);
      }
    }

    let result =
      this.entity instanceof Site
        ? this.#calculateSiteTimeLeft(
            this.entity.name,
            this.restriction.totalTime
          )
        : this.#getGroupTimeLeft(this.entity.sites);
    // Converting in minutes
    result = result / 60;

    if (this.entity instanceof Site && result > 0) {
      let group = this.ec.getGroupByName(this.entity.group);
      if (!group) return this.#createViolationObject(false, result);
      let groupRes = this.#getSiteGroupViolation(group);
      if (groupRes.violated || groupRes.minutesBeforeRes <= result) {
        return groupRes;
      }
    }

    return this.#createViolationObject(result > 0 ? false : true, result);
  }

  /**
   *
   * @param {Group} group - the corresponding Group to a site
   * @returns {ViolationStatus} - if the group violates a totalTime restriction or not
   */
  #getSiteGroupViolation(group) {
    return new TotalTimeRestriction(group, this.rm, this.ec).isViolated();
  }

  /**
   *
   * @param {string[]} targets - names of the sites of group
   * @returns {Number} - number of minutes for all
   */
  #getGroupTimeLeft(targets) {
    return targets.reduce(
      (restrictionLeft, t) => this.#calculateSiteTimeLeft(t, restrictionLeft),
      this.restriction.totalTime
    );
  }

  /**
   *
   * @param {string} target - name of a site
   * @param {Number} timeLeft - either the initial restriction or what's left of it in seconds
   * @returns {Number} the timeLeft in seconds
   */
  #calculateSiteTimeLeft(target, timeLeft) {
    let siteRec = this.rm.getTodaySiteRecord(target);
    if (!siteRec.initDate) return timeLeft - siteRec.totalTime;

    let tt = siteRec.totalTime + (new Date() - siteRec.initDate) / 1000;
    return timeLeft - tt;
  }

  /**
   * Just in case, during the creation of restrictions,
   * user created to different items with the same day but different values
   * @param {Array} restrictions
   * @returns {TotalTimeConfig} the smaller restriction
   */
  #getSmallerRestriction(restrictions) {
    if (!restrictions) return undefined;
    else if (restrictions.length === 1) return restrictions[0];
    return restrictions.sort((a, b) => a.totalTime - b.totalTime)[0];
  }

  #createViolationObject(v, mbr = undefined) {
    return {
      violated: v,
      minutesBeforeRes: mbr,
      restriction: "totalTime",
      entity: this.entity.name,
    };
  }
}

// Exactly the same class as TotalTimeRestriction, but refers to consecutiveTime
export class ConsecutiveTimeRestriction {
  /**
   * @typedef {Object} ConsecutiveTimeConfig
   * @property {string[]} days - days in english where this restrictions happen
   * @property {Number} consecutiveTime - consecutive time in seconds
   * @property {Number} pause - pause in seconds
   */
  /**
   * @param {Site|Group} entity - the site or group we want to evaluate
   * @param {RecordManager} rm - the RecordManager singleton
   * @param {EntitiesCache} ec - the EntitiesCache singleton
   */
  constructor(entity, rm, ec) {
    this.entity = entity;
    /** @type {ConsecutiveTimeConfig|undefined} */
    this.restriction = this.#getSmallerRestriction(this.entity.todayRestrictions?.consecutiveTime)
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
      if (this.entity instanceof Site) {
        const group = this.ec.getGroupByName(this.entity.group) 
        return group
          ? this.#getSiteGroupViolation(group)
          : this.#createViolationObject(false);
      } else if (this.entity instanceof Group) {
        return this.#createViolationObject(false);
      }
    }

    
    let result = this.entity instanceof Site
        ? this.#calculateSiteTimeLeft(this.entity.name, this.restriction.consecutiveTime)
        : this.#getGroupTimeLeft(this.entity.sites);
    // Converting in minutes
    result = result / 60

    if (this.entity instanceof Site && result > 0) {
      let group = this.ec.getGroupByName(this.entity.group);
      if (!group) return this.#createViolationObject(false, result);
      let groupRes = this.#getSiteGroupViolation(group);
      if (groupRes.violated || (groupRes.minutesBeforeRes <= result)) {
        return groupRes;
        }
    }

    return this.#createViolationObject(result > 0 ? false : true, result)
  }

  /**
   * 
   * @param {Group} group - the corresponding Group to a site
   * @returns {ViolationStatus} - if the group violates a consecutiveTime restriction or not
   */
  #getSiteGroupViolation(group) {
    return new ConsecutiveTimeRestriction(group, this.rm, this.ec).isViolated();
  }

  /**
   * 
   * @param {string[]} targets - names of the sites of group
   * @returns {Number} - number of minutes for all
   */
  #getGroupTimeLeft(targets) {
    let gtl = targets.reduce(
      (restrictionLeft, t) => this.#calculateSiteTimeLeft(t, restrictionLeft),
      this.restriction.consecutiveTime
    );
    return gtl
  }

  /**
   * 
   * @param {string} target - name of a site
   * @param {Number} timeLeft - either the initial restriction or what's left of it in seconds
   * @returns {Number} the timeLeft in seconds
   */
  #calculateSiteTimeLeft(target, timeLeft) {
    let siteRec = this.rm.getTodaySiteRecord(target);
    if (!siteRec.initDate)
      return (timeLeft - siteRec.consecutiveTime);
    let tt = siteRec.consecutiveTime + (new Date() - siteRec.initDate) / 1000;
    return (timeLeft - tt);
  }

  /**
   * Just in case, during the creation of restrictions, 
   * user created to different items with the same day but different values
   * @param {Array} restrictions 
   * @returns {ConsecutiveTimeConfig} the smaller restriction
   */
  #getSmallerRestriction(restrictions) {
    if (!restrictions) return undefined;
    else if (restrictions.length === 1)
      return restrictions[0];
    return restrictions.sort((a,b) => a.consecutiveTime - b.consecutiveTime)[0];
  }

  #createViolationObject(v, mbr = undefined) {
    return {
      violated: v,
      minutesBeforeRes: mbr,
      restriction: "consecutiveTime",
      name: this.entity.name,
    };
  }
}