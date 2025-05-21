import { bookkeepingQueue } from "./bookkeepingQueue.js";
import { getTodayRecord } from "./bookkeeping.js";
import { findTodayRestriction, getSiteNamesOfGroup } from "./commons.js";

export async function handleAlarms() {
  if (!(await alarmsAreSet())) {
    createAlarms();
  }
}

async function alarmsAreSet() {
  let alarms = await chrome.alarms.getAll();
  return alarms.length !== 0;
}

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
    changes.busy.newValue === false &&
    changes.busy.oldValue !== false &&
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

  // After a site has been added, of if no site has been added, we check if we have to add consecutiveTime or a timeSlot alarm
  // Works for both groups and sites.
  let key = Object.keys(changes)[0];
  let { records = {} } = await chrome.storage.local.get("records");
  let todayRecord = records[date];

  await chrome.alarms.clearAll();

  await createTimeSlotAlarms(changes[key].newValue);

  await createConsecutiveTimeAlarms(changes[key].newValue, todayRecord);

  await chrome.storage.local.set({ records: records });
}

export async function handleOnAlarm(alarm) {
  console.log("Hey I'm handleOnAlarm and I received this", alarm);
  let tabs = await chrome.tabs.query({});
  let [n, r, type] = alarm.name.split("-");
  let isGroup = n.indexOf(".") === -1;

  if (alarm.name.includes("-consecutive-time")) {
    await handleConsecutiveTimeAlarm(alarm.name);
    return;
  }

  if (type === "end") {
    chrome.runtime.sendMessage({ restriction: "ended" });
    chrome.alarms.clear(alarm.name);
    let { data = [] } = await chrome.storage.local.get(
      isGroup ? "groups" : "sites"
    );
    data = data.filter((x) => x.name === n);
    console.assert(Array.isArray(data) === true, "data is not an array");
    await createTimeSlotAlarms(data);
    return;
  }

  let sitesOfGroup = isGroup ? await getSiteNamesOfGroup(n) : undefined;
  await redirectTabsRestrictedByAlarm(isGroup, n, sitesOfGroup, tabs);

  chrome.alarms.clear(alarm.name);
}

async function handleConsecutiveTimeAlarm(name) {
  if (!name) return;

  let n = name.split("-").shift();
  let storageKey = n.includes(".") ? "sites" : "groups";
  let sitesOfGroup =
    storageKey === "groups" ? await getSiteNamesOfGroup(n) : undefined;

  if (name.includes("-check") || name.includes("-end")) {
    // Adding consecutiveTime to totalTime and resetting it
    let { records = [] } = await chrome.storage.local.get("records");
    let todayRecord = await getTodayRecord(records);
    let sitesToUpdate = sitesOfGroup || [todayRecord[n]];
    console.log("todayRecord before check or end", todayRecord);
    sitesToUpdate.forEach((s) => {
      todayRecord[s].totalTime += todayRecord[s].consecutiveTime;
      todayRecord[s].consecutiveTime = 0;
    });
    console.log("todayRecord after check or end", todayRecord);
    console.log("record after check or end", todayRecord);
    console.log(
      "is todayRecord in records ?",
      records.find((x) => x === todayRecord)
    );
    console.log("records", records);
    await chrome.storage.local.set({ records: records });
    await chrome.alarms.clear(name);
    return;
  }

  // beginning of restriction, either site or group has the restriction
  try {
    let currentDay = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(new Date());
    let data = await chrome.storage.local.get(storageKey);
    data = data[storageKey];

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

    if (consecutiveTimeRestriction) {
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

    await redirectTabsRestrictedByAlarm(
      storageKey === "groups",
      n,
      sitesOfGroup,
      tabs
    );
    await chrome.alarms.clear(name);
  } catch (error) {
    console.error(
      `Error when fetching ${storageKey} from chrome storage local in handleConsecutiveAlarm : ${error}`
    );
  }
}

async function redirectTabsRestrictedByAlarm(
  isGroup,
  name,
  sites = undefined,
  tabs
) {
  let targets = isGroup ? sites : [name];

  for (let i = 0; i < tabs.length; i++) {
    let host = new URL(tabs[i].url).host;

    if (!targets.includes(host)) {
      continue;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("sender is", sender);
      if (message.ready && sender.tab.id === tabs[i].id) {
        sendResponse({ url: tabs[i].url, host: host });
      }
    });

    chrome.tabs.update(tabs[i].id, { url: "ui/redirected/redirected.html" });
  }
}

async function createTimeSlotAlarms(items) {
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
    await chrome.alarms.create(alarmName, { delayInMinutes: delay });
    break;
  }
}

async function createConsecutiveTimeAlarms(items, record) {
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
