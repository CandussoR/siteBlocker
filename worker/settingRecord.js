export async function setRecords(today) {

    let day = new Intl.DateTimeFormat("en-US", {"weekday" : "long"}).format(new Date())

    let { records = {} } = await chrome.storage.local.get('records') ;
    if (Object.keys(records).includes(today)) return records;

    let { sites = [] } = await chrome.storage.local.get('sites') ;
    let { groups = [] } = await chrome.storage.local.get('groups');
    if (groups.length === 0 && sites.length === 0) return ;
    
    records[today] = {}
    for (let i=0 ; i<sites.length ; i++) {
        records[today][sites[i].name] = {initDate : null, totalTime : 0, audible : false, tabId : null, focused : false } ;

        let group = groups.find(x => x.name === sites[i].group)
        let cT = undefined 
        if (group.restrictions && 'consecutiveTime' in group.restrictions) cT = group.restrictions.consecutiveTime
        if (sites[i].restrictions && 'consecutiveTime' in sites[i].restrictions) cT = sites[i].restrictions.consecutiveTime
        if (cT && cT.find(x => x.days.includes(day))) {
            records[today][sites[i].name].consecutiveTime = 0
            continue
        }
    }
    
    await chrome.storage.local.set({records : records}) ;

    return records
}

export async function cleanRecords(lastCleaned, records, todate) {
    let keys = Object.keys(records) ;
    
    let lastCleanIndex = keys.indexOf(lastCleaned)
    console.log("lastCleanIndex", lastCleanIndex)
    let beginAtIndex = ( !lastCleaned || lastCleanIndex === -1 ) ? 0 : lastCleanIndex;
    let dateToDelete = []


    for (let i = beginAtIndex ; i < keys.length ; i++) {

        if (keys[i] >= todate) continue ;

        let recDate = records[keys[i]] ;

        for (let site in recDate) {
            if (typeof recDate[site] === 'number') continue;
            else if (recDate[site].totalTime === 0) delete recDate[site]
            else recDate[site] = recDate[site].totalTime
        }
        
        if (Object.keys(recDate).length === 0) dateToDelete.push(keys[i])
    }

    dateToDelete.forEach(d => delete records[d])

    await chrome.storage.local.set({lastCleaned : todate}) ;
    await chrome.storage.local.set({records : records})
}