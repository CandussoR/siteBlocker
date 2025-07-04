import { checkIfCreateConsecutiveOrTotalTimeAlarm } from "./alarmsHandler.js";
import { findTodayRestriction } from "./commons.js";
import { logger } from './logger.js';



/**
 * 
 * @param {string} host - name of the site the tab is on
 * @param {Object[]} sites - list of site objects
 * @returns 
 */
export async function isRestricted(host, sites) {
  // check for alarms.
  const sitesName = sites.map((x) => x.name);
  const currentDay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date());
  let siteIndex = sitesName.findIndex((x) => x === host);
  let siteRestrictions = sites[siteIndex].restrictions;
  let siteGroup = host === "private" ? "Private" : sites[siteIndex].group;

  // Even if empty, returns empty array
  let alarms = await chrome.alarms.getAll();

  // if there is already an alarm for the end of a restriction, no need to check
  let alarmsEnd = alarms.filter(
    (x) =>
      (siteGroup && x.name.includes(siteGroup) && x.name.includes("-end")) ||
      (x.name.includes(host) && x.name.includes("-end"))
  );
  if (alarmsEnd.length) return true;
  // if there is a consecutive alarm check for the group or the host, we delete it for a following -begin alarm
  let alarmsChecks = alarms.filter(
    (x) =>
      (siteGroup && x.name.includes(siteGroup) && x.name.includes("-check")) ||
      (x.name.includes(host) && x.name.includes("-check"))
  );
  for (let c of alarmsChecks) {
    await chrome.alarms.clear(c.name);
  }

  if (siteGroup) {
    let { groups = [] } = await chrome.storage.local.get("groups");
    let groupIndex = groups.findIndex((g) => g.name === siteGroup);
    let groupRestrictions = groups[groupIndex].restrictions;
    if (groupRestrictions) {
      logger.debug("checking if group is restricted")
      let groupIsRestricted = await isGroupRestricted(
        host,
        groupRestrictions,
        siteRestrictions
      );
      if (groupIsRestricted) {
        return true;
      }
    }
  }

  let { records = {} } = await chrome.storage.local.get("records");
  let date = new Date().toISOString().split("T")[0];
  let todayRecord = records[date];
  const isRestricted = await checkIfCreateConsecutiveOrTotalTimeAlarm(host, todayRecord);
  return isRestricted;
  if (!siteRestrictions) {
    return false;
  }

  if (siteRestrictions.timeSlot && checkSlots(siteRestrictions.timeSlot)) {
    return true;
  }

  let siteRestrictionTotalTime = findTodayRestriction(
    currentDay,
    siteRestrictions,
    "totalTime"
  );
  if (siteRestrictionTotalTime) {
    let timeLeft = timeLeftBeforeRestriction(
      todayRecord[host],
      siteRestrictionTotalTime,
      "totalTime"
    );
    if (timeLeft) {
      await chrome.alarms.create(`${host}-total-time-restriction-begin`, {
        delayInMinutes: timeLeft / 60,
      });
    } else {
      return true;
    }
  }

  let siteRestrictionConsecutiveTime = findTodayRestriction(
    currentDay,
    siteRestrictions,
    "consecutiveTime"
  );
  if (siteRestrictionConsecutiveTime) {
    let timeLeft = timeLeftBeforeRestriction(
      todayRecord[host],
      siteRestrictionConsecutiveTime,
      "consecutiveTime"
    );
    if (timeLeft) {
      await chrome.alarms.create(`${host}-consecutive-time-restriction-begin`, {
        delayInMinutes: timeLeft / 60,
      });
    } else {
      return true;
    }
  }

  return false;
}

/**
 *
 * @param {*} host domain name of the site checked
 * @param {*} groupRestrictions restrictions property of group object
 * @param {*} siteRestrictions restrictions property of site object
 * @returns
 */
export async function isGroupRestricted(
  host,
  groupRestrictions,
  siteRestrictions
) {
  let restricted = false;
  let currentDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date()
  );
  let restrictionsName = ["timeSlot", "totalTime", "consecutiveTime"];
  let functionsName = [
    isGroupRestrictedByTimeSlot,
    isGroupRestrictedByTotalTime,
    isGroupRestrictedByConsecutiveTime,
  ];
  let i = 0;

  while (i < restrictionsName.length && !restricted) {
    let todayGroupRestriction = findTodayRestriction(
      currentDay,
      groupRestrictions,
      restrictionsName[i]
    );
    let todaySiteRestriction = findTodayRestriction(
      currentDay,
      siteRestrictions,
      restrictionsName[i]
    );
    if (!todayGroupRestriction && !todaySiteRestriction) {
      i++;
      continue;
    }
    restricted =
      i === 0
        ? functionsName[i](todayGroupRestriction, todaySiteRestriction)
        : await functionsName[i](
            host,
            todayGroupRestriction,
            todaySiteRestriction
          );
    // DEBUG 
    if (restricted) {
      logger.debug(
        "isGroupRestricted : group has been restricted from ",
        restrictionsName[i],
        todayGroupRestriction,
        todaySiteRestriction
      );
    }
    i++;
  }

  return restricted;
}

function isGroupRestrictedByTimeSlot(groupRestriction, siteRestriction) {
  let result = checkSlots(groupRestriction);
  if (!result && siteRestriction && siteRestriction !== groupRestriction) {
    result = checkSlots(siteRestriction);
  }
  return result;
}

/**
 *
 * @param {*} host name of the site checked
 * @param {*} groupRestriction today's group restriction for a specific key
 * @param {*} siteRestriction today's site restriction for a specific key
 * @returns boolean
 */
export async function isGroupRestrictedByTotalTime(
  host,
  groupRestriction,
  siteRestriction
) {
  let date = new Date().toISOString().split("T")[0];
  let groupTimeLeft = -1;
  let siteTimeLeft = -1;
  let { records = {} } = await chrome.storage.local.get("records");
  let todayRecord = records[date];

  let { sites = [] } = await chrome.storage.local.get("sites");
  let groupName = sites.find((x) => x.name === host).group;
  let sitesOfGroup = sites
    .filter((x) => x.group === groupName)
    .map((x) => x.name);

  let groupTime = 0;
  for (let i = 0; i < sitesOfGroup.length; i++) {
    groupTime += todayRecord[sitesOfGroup[i]].totalTime;
  }

  if (groupTime >= groupRestriction.totalTime) return true;
  groupTimeLeft = groupRestriction.totalTime - groupTime;

  if (siteRestriction && siteRestriction !== groupRestriction) {
    siteTimeLeft = timeLeftBeforeRestriction(
      todayRecord[host],
      siteRestriction,
      "totalTime"
    );
    if (!siteTimeLeft) return true;
  }

  if (
    siteTimeLeft === -1 ||
    (siteTimeLeft !== -1 && groupTimeLeft <= siteTimeLeft)
  ) {
    console.log(
      "creating alarm with",
      `${groupName}-total-time-restriction-begin`,
      groupTimeLeft / 60
    );
    await chrome.alarms.create(`${groupName}-total-time-restriction-begin`, {
      delayInMinutes: groupTimeLeft / 60,
    });
  } else if (
    groupTimeLeft === -1 ||
    (groupTimeLeft !== -1 && siteTimeLeft < groupTimeLeft)
  ) {
    console.log(
      "creating alarm with",
      `${host}-total-time-restriction-begin`,
      siteTimeLeft / 60
    );
    await chrome.alarms.create(`${host}-total-time-restriction-begin`, {
      delayInMinutes: siteTimeLeft / 60,
    });
  }

  return false;
}

export async function isGroupRestrictedByConsecutiveTime(
  host,
  groupRestriction,
  siteRestriction
) {
  logger.debug(
    "isGroupRestrictedByConsecutiveTime",
    host,
    "Group restriction : ",
    groupRestriction,
    "Site restriction : ",
    siteRestriction || "None"
  );

  // Checking if already an alarm set to begin a restriction later : not restricted
  let { sites = [] } = await chrome.storage.local.get("sites");
  let groupName = sites.find((x) => x.name === host).group;
  let alarms = await chrome.alarms.getAll();
  if (
    alarms.find(
      (x) =>
        x.name === `${groupName}-consecutive-time-restriction-begin` ||
        x.name === `${host}-consecutive-time-restriction-begin`
    )
  ) {
    logger.debug(
      "Found an alarm to begin the restriction later, so the site/group is probably not restricted",
      (
        new Date() +
        alarms.find(
          (x) =>
            x.name === `${groupName}-consecutive-time-restriction-begin` ||
            x.name === `${host}-consecutive-time-restriction-begin`
        ).scheduledTime
      ).toLocaleTimeString()
    );
    return false;
  }

  let date = new Date().toISOString().split("T")[0];

  let groupHasRestriction = groupRestriction ? true : false;
  let hostHasOwnRestriction = siteRestriction ? true : false;
  if (!groupHasRestriction && !hostHasOwnRestriction) {
    return false;
  }

  let groupTimeLeft = null;
  let siteTimeLeft = null;

  let { records = [] } = await chrome.storage.local.get("records");
  let todayRecord = records[date];
  logger.debug("todayRecord is", todayRecord)

  let sitesOfGroup = sites
    .filter((x) => x.group === groupName)
    .map((x) => x.name);

  let totalGroupTime = 0;
  sitesOfGroup.forEach((site) => {
    logger.debug(`Adding ${todayRecord[site].consecutiveTime} to totalTimeGroup from ${site}`)
    totalGroupTime += todayRecord[site].consecutiveTime || 0;
  });
  groupTimeLeft = groupRestriction.consecutiveTime - totalGroupTime;
  if (totalGroupTime >= groupRestriction.consecutiveTime) {
    logger.info(
      `Added value of consecutive times for sites of group (${totalGroupTime})` +
        ` > group set consecutive time (${groupRestriction.consecutiveTime}).` +
        " Should set end of restriction alarm for the group and redirect host."
    );
    // groupTimeLeft = groupRestriction.consecutiveTime - totalGroupTime;
  } else {
    logger.debug("TotalGroupTime doesn't justify any restriction", totalGroupTime,
      "group restriction time is", groupRestriction.consecutiveTime)
  }

  if (hostHasOwnRestriction) {
    siteTimeLeft = timeLeftBeforeRestriction(
      todayRecord[host],
      siteRestriction,
      "consecutiveTime"
    );
    if (siteTimeLeft <= 0) {
      logger.info(`siteTimeLeft is ${siteTimeLeft} : the site is restricted and should get an end alarm`)
      return true;
    }
  }

  if (
    (groupHasRestriction && !hostHasOwnRestriction && groupTimeLeft <= 0) ||
    (groupHasRestriction &&
      hostHasOwnRestriction &&
      groupTimeLeft <= siteTimeLeft)
  ) {
    logger.info(
      `siteTimeLeft is ${siteTimeLeft} and groupTimeLeft is ${groupTimeLeft}`,
      `Creating an alarm with name ${groupName}-consecutive-time-restriction-begin`,
      `Delay in minutes is ${groupTimeLeft / 60}`,
      "sending True to notify group is restricted for now"
    );
    await chrome.alarms.create(
      `${groupName}-consecutive-time-restriction-begin`,
      { delayInMinutes: groupTimeLeft / 60 }
    );
  } else if (
    (!groupHasRestriction && hostHasOwnRestriction && siteTimeLeft <= 0) ||
    (groupHasRestriction && hostHasOwnRestriction && siteTimeLeft < groupTimeLeft)
  ) {
    logger.info(
      `siteTimeLeft is ${siteTimeLeft} and groupTimeLeft is ${groupTimeLeft}`,
      `creating an alarm with name ${host}-consecutive-time-restriction-begin`,
      `Delay in minutes is ${siteTimeLeft / 60}`,
    );
    await chrome.alarms.create(`${host}-consecutive-time-restriction-begin`, {
      delayInMinutes: siteTimeLeft / 60,
    });
  }

  return false;
}

/**
 *
 * @param {*} hostRecord record for the current day for host
 * @param {*} restriction today's restriction for a specific key
 * @param {*} propertyName name of the propriety in the restriction object
 * @returns number
 */
function timeLeftBeforeRestriction(hostRecord, restriction, propertyName) {
  return restriction[propertyName] < hostRecord[propertyName]
    ? 0
    : restriction[propertyName] - hostRecord[propertyName];
}

function checkSlots(slots) {
  if (!slots) {
    return false;
  }
  const currentTime = new Date().toLocaleTimeString("fr-FR");

  let spans = slots.time;
  for (let j = 0; j < spans.length; j++) {
    if (
      (currentTime > spans[j][0] && spans[j][1] === "00:00") ||
      (currentTime > spans[j][0] && currentTime < spans[j][1])
    ) {
      return true;
    }
  }

  return false;
}
