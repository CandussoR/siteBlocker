export function findTodayRestriction(currentDay, restrictions, restrictionKey) {
    if (!restrictions || !(restrictionKey in restrictions)) {
        return undefined
    }
    return restrictions[restrictionKey].find(x => x.days.includes(currentDay))
}


export async function getSiteNamesOfGroup(name) {
    let { sites = [] } = await chrome.storage.local.get('sites')
    return sites.filter(x => x.group && x.group === name).map(x => x.name)
}