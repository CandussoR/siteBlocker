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
          todayRecord[host] = await handleOpen(todayRecord[host], tabId, host)
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
      await chrome.storage.local.set({records : records})
    } catch (error) {
      console.log("Error in bookkeeping, avorting any change", error)
    }
  }

function getTodayRecord(records) {
    let date = new Date().toISOString().split('T')[0] ;
    return records[date]
}

async function handleOpen(siteRecord, tabId, host) {
  if (siteRecord.tabId && !siteRecord.tabId.includes(tabId)) siteRecord.tabId.push(tabId)
  else if (!siteRecord.tabId) siteRecord.tabId = [tabId]

  console.assert(siteRecord.tabId, `Error, no tabId : ${siteRecord}`)
  let focused = await chrome.tabs.query({active: true});
  if (focused[0] && new URL(focused[0].url).host === host) {
    siteRecord.focused = true 
    siteRecord.initDate = Date.now()
  }
  console.log("todayRecord after open", siteRecord)
  return siteRecord
}

function handleClose(todayRecord, tabId) {

  for (let site of Object.keys(todayRecord)) {
    if (!todayRecord[site].tabId || !todayRecord[site].tabId.includes(tabId)) { continue; } 

    console.assert(todayRecord[site].tabId, `Error, no tabId : ${todayRecord[site]}`)

    if (todayRecord[site].tabId.length > 1) {
      let tabIndex = todayRecord[site].tabId.findIndex(x => x === tabId)
      todayRecord[site].tabId.splice(tabIndex, 1)
    } else {
      todayRecord[site].tabId = null
      todayRecord[site].focused = false;
      todayRecord[site].audible = false;
    }
    
    if (todayRecord[site].initDate) {
      todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
      todayRecord[site].initDate = null;
    }
    console.assert(todayRecord[site].initDate === null)
    console.log("after close", todayRecord)
  }

  return todayRecord
}


function handleAudibleStart(siteRecord) {
  siteRecord.audible = true
  if (!siteRecord.initDate) siteRecord.initDate = Date.now()
  console.warn("siteRecord after handleAudibleStart", siteRecord)
  return siteRecord
}


function handleAudibleEnd(siteRecord) {
  siteRecord.audible = false
  if (!siteRecord.focused && siteRecord.initDate) {
    siteRecord.totalTime += Math.round( (Date.now() - siteRecord.initDate) / 1000 );
    siteRecord.initDate = null; 
  }
  console.warn("siteRecord after handleAudibleEnd", siteRecord)
  return siteRecord
}


function handleNoFocus(todayRecord) {
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

function handleChangeFocus(todayRecord, host) {
  for (let site of Object.keys(todayRecord)) {

    if (site === host) {
      todayRecord[site].focused = true;
      if (!todayRecord[site].initDate) todayRecord[site].initDate = Date.now();
      continue;
    } else if (todayRecord[site].initDate) {
      todayRecord[site].totalTime += Math.round( (Date.now() - todayRecord[site].initDate) / 1000 );
      todayRecord[site].initDate = null;
    }

    todayRecord[site].focused = false;
  };

  console.warn("record after handleChangeFocus", todayRecord)
  return todayRecord
}