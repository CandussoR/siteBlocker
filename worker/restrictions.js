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
   * Finds the next time threshold (start or end) in the defined time slots
   * that comes after the current time.
   *
   * Intended to identify when the next time slot will *start* or *end*,
   * to help schedule the next alarm.
   * Might be chained to Site|Group.todayRestrictions which can be undefined.
   *
   * @returns {string | undefined} The next relevant time string (e.g., "14:00"), or undefined if none found.
   */
  getFollowingTime() {
    if (!this.restriction)
      return undefined;

    for (let res of this.restriction) {
      let timeSlots = res.time;
      let currentTime = new Date().toLocaleTimeString("fr-FR");
      let found = null;
      for (let j = 0; j < timeSlots.length; j++) {
        found = timeSlots[j].find(
          (t, i) =>
            (i == 0 && t > currentTime) ||
            (i == 1 && (t > currentTime || t === "00:00"))
        );
        if (found) return found;
      }
    }
    return undefined;
  }
}