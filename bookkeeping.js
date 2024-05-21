export async function bookkeeping(flag, tabId=undefined, host=undefined) {
  let date = new Date().toISOString().split('T')[0] ;
  console.log(date)

  let { records = [] } = await chrome.storage.local.get('records')

  let todayRecord = records[date]
  let rKeys = Object.keys(todayRecord)

  if (flag === 'close') {
    console.log("Oh so you're leaving ?")
    let sites = Object.keys(todayRecord)
    for (let i = 0; i < sites.length ; i++) {
      if (todayRecord[sites[i]].tabId !== tabId) {
        continue;
      } else {
        let site = todayRecord[sites[i]]
        console.log("The time should be :", Math.round( (Date.now() - site.initDate) / 1000 ))
        site.totalTime += Math.round( (Date.now() - site.initDate) / 1000 )
        site.initDate = null
        site.tabId = null
        site.audible = false
        site.focused = false
        break;
      }
    }
  }

  else if (flag === 'open') {
    let site = todayRecord[host]
    site.initDate = Date.now()
    site.tabId = tabId
    // do we need to focus ?
  }

  else if (flag === 'audible-start') {
    console.log("oh! you started to consume some media!")
    todayRecord[host].audible = true
    if (!todayRecord[host].initDate) todayRecord[host].initDate = Date.now()
  }

  else if (flag === 'audible-end') {
    console.log("You stopped consuming some media.")
    todayRecord[host].audible = false
    if (!todayRecord[host].focused) {
      console.log("and the tab is not focused, so it doesn't count anymore")
      todayRecord[host].totalTime += Math.round( (Date.now() - todayRecord[host].initDate) / 1000 )
      todayRecord[host].initDate = null
    }
    console.log("I deactivated audible, here is the new record", todayRecord[host])
  }

  else if (flag === 'no-focus') {
    console.log("You don't have any restricted site focused as of now.")
    for (let i=0; i<rKeys.length ; i++) {
      let el = todayRecord[rKeys[i]]
      if (!el.focused) {
        continue ;
      } else if (el.focused && !el.audible) {
        console.log("This was focused and nothing was playing so I'm resetting focused and initDate")
        el.totalTime += Math.round( (Date.now() - el.initDate) / 1000 )
        el.focused = false
        el.initDate = null
      } else if (el.focused && el.audible) {
        console.log("Oh here there is something playing so I'm just going to change the focused property.")
        el.focused = false
      }
    }
  }

  else if (flag === 'change-focus') {
    console.log('oh, you changed the focus of a tab')
    // infos : tabId and host
    for (let i=0; i<rKeys.length ; i++) {
      console.log("I'll be going through the sites present in records to note that.")
      let el = todayRecord[rKeys[i]]

      if (el.focused && el.audible) {
        console.log("but you're consuming some media on this one, so I won't stop counting time.")
        el.focused = false
      } else if (el.focused) {
        el.totalTime += Math.round( (Date.now() - el.initDate) / 1000 )
        el.initDate = null
        el.focused = false
      }
    }
    console.log("ok, and on this one you are focused now...")
    todayRecord[host].focused = true
    if (!todayRecord[host].initDate) todayRecord[host].initDate = Date.now()
  }

  console.log("Now this is today's record after its modification, is it alright ?", todayRecord)
  console.log("And those are the records, has it been modified the right way ?", records)
  console.log("I send it anyway, good luck")
  await chrome.storage.local.set({records : records})
}