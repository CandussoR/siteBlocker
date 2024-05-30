export async function bookkeeping(flag, tabId = undefined, host = undefined) {
    try {
      console.log("In bookkeeping I have received", flag, tabId, host)

      let { records = [] } = await chrome.storage.local.get('records')
      let todayRecord = getTodayRecord(records)
      if (!todayRecord) {
        console.error("No record has been set for today yet, a problem must have occured on startUp, aborting.")
        return;
      }

      switch (flag) {
        case ('audible-start'):
          todayRecord[host] = handleAudibleStart(todayRecord[host])
          break;
        case ('audible-end'):
          todayRecord[host] = handleAudibleEnd(todayRecord[host])
          break;
        case ('open'):
          todayRecord = await handleOpen(todayRecord, tabId, host)
          break;
        case ('close') :
          todayRecord = handleClose(todayRecord, tabId)
          break;
        case ('no-focus') :
          todayRecord = handleNoFocus(todayRecord)
          break;
        case ('change-focus') :
          todayRecord = handleChangeFocus(todayRecord, host)
          break;
      }

      console.log("we will set this in records", records)
      // Debugging
      for (let site in todayRecord) {
        if (todayRecord[site].totalTime > 170000000) {
          throw Error(`TotalTime has been wrongly set after event ${flag} in ${tabId} with host ${host}`)
        }
      }
      await chrome.storage.local.set({records : records})
    } catch (error) {
      console.log("Error in bookkeeping, avorting any change", error)
    }
  }

function getTodayRecord(records) {
    let date = new Date().toISOString().split('T')[0] ;
    return records[date]
}

export async function handleOpen(todayRecord, tabId, host) {
  // Deleting tab from last domain if it has changed
  for (let site of Object.keys(todayRecord)) {
    if (todayRecord[site].tabId && todayRecord[site].tabId.includes(tabId) && site !== host) {
      await handleClose(todayRecord, tabId)
    }
  }
  
  // Ascribing tab to domain
  let siteRecord = todayRecord[host]
  if (siteRecord.tabId && !siteRecord.tabId.includes(tabId)) siteRecord.tabId.push(tabId)
  else if (!siteRecord.tabId) siteRecord.tabId = [tabId]

  // Handling focus and initDate
  let focused = await chrome.tabs.query({active: true});
  console.log("focused", focused)
  if (focused && focused[0] && new URL(focused[0].url).host === host) {
    siteRecord.focused = true
    siteRecord.initDate = Date.now()
  }
  console.log("todayRecord after open", siteRecord)

  return todayRecord
}

export async function handleClose(todayRecord, tabId) {

  for (let site of Object.keys(todayRecord)) {
    if (!todayRecord[site].tabId || !todayRecord[site].tabId.includes(tabId)) { 
      continue; 
    } else if (todayRecord[site].tabId.length > 1) {
      if (todayRecord[site].audible && await checkToggleAudible(site)) {
        todayRecord[site].audible = false
      }
      let tabIndex = todayRecord[site].tabId.findIndex(x => x === tabId)
      todayRecord[site].tabId.splice(tabIndex, 1)
    } else {
      todayRecord[site].tabId = null
      todayRecord[site].focused = false;
      todayRecord[site].audible = false;
    }

    if ((todayRecord[site].initDate && todayRecord[site].audible) || !todayRecord[site].initDate) {
      return todayRecord;
    }
    
    todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
    todayRecord[site].initDate = null;
    console.log("after close", todayRecord)
  }

  return todayRecord
}


export function handleAudibleStart(siteRecord) {
  siteRecord.audible = true
  if (!siteRecord.initDate) siteRecord.initDate = Date.now()
  console.warn("siteRecord after handleAudibleStart", siteRecord)
  return siteRecord
}


export function handleAudibleEnd(siteRecord) {
  siteRecord.audible = false
  if (!siteRecord.focused && siteRecord.initDate) {
    siteRecord.totalTime += Math.round( (Date.now() - siteRecord.initDate) / 1000 );
    siteRecord.initDate = null;
  }
  console.warn("siteRecord after handleAudibleEnd", siteRecord)
  return siteRecord
}


export function handleNoFocus(todayRecord) {
    for (let site of Object.keys(todayRecord)) {
      console.log(site, "audible", !todayRecord[site].audible)
      if (todayRecord[site].audible) {
        todayRecord[site].focused = false
        continue;
      }

      if (todayRecord[site].initDate) {
        todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
        todayRecord[site].initDate = null;
      }

      todayRecord[site].focused = false;
    }
    console.log("after no-focus", todayRecord)
    return todayRecord
}

export function handleChangeFocus(todayRecord, host) {
  for (let site of Object.keys(todayRecord)) {
    if (site === host) {
      todayRecord[site].focused = true;
      if (!todayRecord[site].initDate) todayRecord[site].initDate = Date.now();
      continue;
    } else if (todayRecord[site].initDate && !todayRecord[site].audible) {
      todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
      todayRecord[site].initDate = null;
    }

    todayRecord[site].focused = false;
  };

  console.warn("record after handleChangeFocus", todayRecord)
  return todayRecord
}


async function checkToggleAudible(site) {
  let audibleTabs = await chrome.tabs.query({audible : true});
  if (audibleTabs.length > 0 && audibleTabs.map(x => new URL(x.url).host).includes(site)) {
    return false;
  }
  return true;
}