import { logger } from "./logger.js";
import { RecordManager } from "./recordManager.js";
import { ConsecutiveTimeRestriction, TimeSlotRestriction, TotalTimeRestriction } from "./restrictions.js";
import { EntitiesCache } from "./siteAndGroupModels.js";

/**
 * 
 * @param {string} host - name of site
 * @param {EntitiesCache} ec - singleton containing entities
 * @param {RecordManager} rm - singleton handling records
 * @return {ViolationStatus} - an enhanced version of ViolationStatus with restriction type and phase for alarm
 */
export function isRestricted(host, ec, rm) {
  const site = ec.getSiteByName(host);
  if (!site) {
    logger.error("isRestricted host is", host, "and is watched but no corresponding site")
    throw new Error("Site should have been found")
  }

  if (
    !site.todayRestrictions &&
    (!site.group || !ec.getGroupByName(site.group).todayRestrictions)
  ) {
    return { violated: false };
  }

  const arr = [
    new TimeSlotRestriction(site, ec).isViolated(),
    new TotalTimeRestriction(site, rm, ec).isViolated(),
    new ConsecutiveTimeRestriction(site, rm, ec).isViolated()
  ]

  if (arr.some(x => x.violated)) {
    return arr.filter(x => x.violated).sort((a,b) => a.minutesBeforeRes - b.minutesBeforeRes)[0]
  }

  if (arr.some(x => x.minutesBeforeRes)) {
    return arr.filter(x => x.minutesBeforeRes).sort((a,b) => a.minutesBeforeRes - b.minutesBeforeRes)[0]
  }

  // No violated, and no minutesBeforeRes : so no restriction in view, whatever
  return arr[0];
}