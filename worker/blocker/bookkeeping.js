export async function bookkeeping(flag, tabId = undefined, host = undefined) {
    try {
      console.log("In bookkeeping I have received", flag, tabId, host) 
 
      let { records = [] } = await chrome.storage.local.get('records')
      let todayRecord = getTodayRecord(records)
      if (!todayRecord) {
        console.error("No record has been set for today yet, a problem must have occured on startUp, aborting.")
        return;
      }

      console.log("todayRecord, before the switch case", todayRecord, Object.keys(todayRecord))
      switch (flag) {
        case ('audible-start'):
          todayRecord[host] = handleAudibleStart(todayRecord[host])
          break;
        case ('audible-end'):
          todayRecord[host] = await handleAudibleEnd(host, todayRecord[host])
          break;
        case ('open'):
          todayRecord = await handleOpen(todayRecord, tabId, host)
          break;
        case ('close') :
          todayRecord = await handleClose(todayRecord, tabId)
          break;
        case ('no-focus') :
          todayRecord = await handleNoFocus(todayRecord)
          break;
        case ('change-focus') :
          todayRecord = await handleChangeFocus(todayRecord, host)
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

export function getTodayRecord(records) {
    let date = new Date().toISOString().split('T')[0] ;
    console.log(date)
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
  if (focused && focused[0] && new URL(focused[0].url).host === host) {
    siteRecord.focused = true
    siteRecord.initDate = Date.now()
  }

  return todayRecord
}

export async function handleClose(todayRecord, tabId) {

  for (let site of Object.keys(todayRecord)) {
    let siteRecord = todayRecord[site]

    if (!siteRecord.tabId || !siteRecord.tabId.includes(tabId)) { 
      continue; 
    } 
    else if (siteRecord.tabId.length > 1) {
      if (siteRecord.audible && await checkToggleAudible(site)) {
        siteRecord.audible = false
      }
      let tabIndex = siteRecord.tabId.findIndex(x => x === tabId)
      siteRecord.tabId.splice(tabIndex, 1)
    } 
    else {
      siteRecord.tabId = null
      siteRecord.focused = false;
      siteRecord.audible = false;
    }

    if ((siteRecord.initDate && siteRecord.audible) || !siteRecord.initDate) {
      return todayRecord;
    }

    if ('consecutiveTime' in siteRecord) {
      siteRecord = await bookkeepConsecutiveTime(site, siteRecord)
    }

    siteRecord.totalTime += Math.round( (Date.now() - siteRecord.initDate) / 1000 );
    siteRecord.initDate = null;
  }

  return todayRecord
}


export function handleAudibleStart(siteRecord) {
  siteRecord.audible = true
  if (!siteRecord.initDate) siteRecord.initDate = Date.now()
  return siteRecord
}


export async function handleAudibleEnd(site, siteRecord) {
  siteRecord.audible = false

  if (!siteRecord.focused && siteRecord.initDate) {

    if ('consecutiveTime' in siteRecord) {
      siteRecord = await bookkeepConsecutiveTime(site, siteRecord)
    }

    siteRecord.totalTime += Math.round( (Date.now() - siteRecord.initDate) / 1000 );
    siteRecord.initDate = null;
  }

  return siteRecord
}


export async function handleNoFocus(todayRecord) {
    for (let site of Object.keys(todayRecord)) {
      if (todayRecord[site].audible) {
        todayRecord[site].focused = false;
        continue;
      }

      if (todayRecord[site].initDate) {
        
        if ('consecutiveTime' in todayRecord[site]) {
          todayRecord[site] = await bookkeepConsecutiveTime(site, todayRecord[site])
        }
        todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
        todayRecord[site].initDate = null;
      }

      todayRecord[site].focused = false;
    }
    return todayRecord
}


export async function handleChangeFocus(todayRecord, host) {

  for (let site of Object.keys(todayRecord)) {
    let s = todayRecord[site]
    if (site === host) {
      s.focused = true;
      if (!s.initDate) s.initDate = Date.now();
      continue;
    } 
    else if (s.focused && s.initDate && !s.audible) {
      s.focused = false
      if ('consecutiveTime' in s) {
        s = await bookkeepConsecutiveTime(site, s)
      }
      s.totalTime += Math.round( (Date.now() - s.initDate) / 1000 );
      s.initDate = null;
    } 
    else {
      s.focused = false;
    }
  };
  return todayRecord
}


async function checkToggleAudible(site) {
  let audibleTabs = await chrome.tabs.query({audible : true});
  if (audibleTabs.length > 0 && audibleTabs.map(x => new URL(x.url).host).includes(site)) {
    return false;
  }
  return true;
}


async function bookkeepConsecutiveTime(site, siteRecord) {
  if (siteRecord.initDate 
    && !siteRecord.audible 
    && !siteRecord.focused) {
      siteRecord.consecutiveTime = Math.round( (Date.now() - siteRecord.initDate) / 1000);
      chrome.alarms.create(`${site}-consecutive-time-restriction-check`, {delayInMinutes : 2 })
      chrome.alarms.clear(`${site}-consecutive-time-restriction-begin`)
  }
  return siteRecord
}