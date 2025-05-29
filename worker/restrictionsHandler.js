import { findTodayRestriction } from "./commons.js";

export async function getRestrictedSites() {
  let { sites = [] } = await chrome.storage.local.get("sites");
  if (chrome.runtime.lastError) {
    console.error("An error occurred while fetching your settings.");
    return;
  }
  return sites;
}

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
  console.log(alarmsChecks);
  for (let c of alarmsChecks) {
    await chrome.alarms.clear(c.name);
  }

  if (siteGroup) {
    let { groups = [] } = await chrome.storage.local.get("groups");
    let groupIndex = groups.findIndex((g) => g.name === siteGroup);
    let groupRestrictions = groups[groupIndex].restrictions;
    if (groupRestrictions) {
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
      console.log("group has been restricted from", restrictionsName[i], todayGroupRestriction, todaySiteRestriction)
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
  let date = new Date().toISOString().split("T")[0];
  let groupTimeLeft = -1;
  let siteTimeLeft = -1;
  let alarms = await chrome.alarms.getAll();

  let { records = [] } = await chrome.storage.local.get("records");
  let todayRecord = records[date];

  let { sites = [] } = await chrome.storage.local.get("sites");
  let groupName = sites.find((x) => x.name === host).group;

  if (
    alarms.find(
      (x) =>
        x.name === `${groupName}-consecutive-time-restriction-begin` ||
        x.name === `${host}-consecutive-time-restriction-begin`
    )
  ) {
    return false;
  }

  let sitesOfGroup = sites
    .filter((x) => x.group === groupName)
    .map((x) => x.name);

  let totalGroupTime = 0;
  sitesOfGroup.forEach((site) => {
    totalGroupTime += todayRecord[site].consecutiveTime || 0;
  });
  if (totalGroupTime >= groupRestriction.consecutiveTime) return true;
  groupTimeLeft = groupRestriction.consecutiveTime - totalGroupTime;

  if (siteRestriction) {
    siteTimeLeft = timeLeftBeforeRestriction(
      todayRecord[host],
      siteRestriction,
      "consecutiveTime"
    );
    if (!siteTimeLeft) return true;
  }

  if (siteTimeLeft === -1 && groupTimeLeft === -1) return false;

  if (
    siteTimeLeft === -1 ||
    (siteTimeLeft !== -1 && groupTimeLeft <= siteTimeLeft)
  ) {
    console.log(
      `creating an alarm with name ${groupName}-consecutive-time-restriction-begin`
    );
    await chrome.alarms.create(
      `${groupName}-consecutive-time-restriction-begin`,
      { delayInMinutes: groupTimeLeft / 60 }
    );
  } else if (
    groupTimeLeft === -1 ||
    (groupTimeLeft !== -1 && siteTimeLeft < groupTimeLeft)
  ) {
    console.log(
      `creating an alarm with name ${groupName}-consecutive-time-restriction-begin`
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
    ? -1
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
