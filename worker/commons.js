
export function findTodayRestriction(currentDay, restrictions, restrictionKey) {
    if (!restrictions || !(restrictionKey in restrictions)) {
        return undefined
    }
    return restrictions[restrictionKey].find(x => x.days.includes(currentDay))
}

/**
 * 
 * @param {Object} groupOrSite - the object group or object site to search
 * @returns {Object|undefined} - the Restriction object filtered or undefined
 */
export function findAllTodayRestrictionsFor(groupOrSite) {
      let currentDay = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
      }).format(new Date());

      if (!groupOrSite.restrictions) {
        console.debug("No restrictions propriety on groupOrSite");
        return undefined;
      }

      let ret = groupOrSite.restrictions;
      for (let rest of Object.keys(ret)) {
        ret[rest] = ret[rest].filter((x) => x.days.includes(currentDay));
        if (!ret[rest].length) {
          delete ret[rest];
        }
      }

      return Object.keys(ret).length === 0 ? undefined : ret;
}


export async function getSiteNamesOfGroup(name) {
    let { sites = [] } = await chrome.storage.local.get('sites')
    return sites.filter(x => x.group && x.group === name).map(x => x.name)
}