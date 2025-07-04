class Watched
{
  constructor(siteOrGroupObj) {
    this.name = siteOrGroupObj.name;
    this.restrictions = siteOrGroupObj.restrictions;
  }

  get todayRestrictions() {
    let currentDay = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(new Date());

    if (!this.restrictions) {
      return undefined;
    }

    let restClone = JSON.parse(JSON.stringify(this.restrictions));
    for (let rest of Object.keys(restClone)) {
      restClone[rest] = restClone[rest].filter((x) => x.days.includes(currentDay));
      if (!restClone[rest].length) {
        delete restClone[rest];
      }
    }

    return Object.keys(restClone).length === 0 ? undefined : restClone;
  }
}

export class Site extends Watched {
    constructor(siteObj) {
      super(siteObj);
      this.group = siteObj.group
    }
}

export class Group extends Watched {
    constructor(groupObj, allSites) {
      super(groupObj)
      this.sites = allSites.filter(x => x.group === this.name).map(x => x.name)
    }
}

export class EntitiesCache {
  constructor() {
       /**
     * Cached array of instantiated Site objects.
     * @type {Site[]}
     */
    this.sites = [];
    /**
     * Cached array of instantiated Group objects.
     * @type {Group[]}
     */
    this.groups = [];
    // Used to instantiate group
    this.rawSites = [];
  }

  async initialize() {
    try {
    const [{ sites = [] }, { groups = [] }] = await Promise.all([
      chrome.storage.local.get("sites"),
      chrome.storage.local.get("groups"),
    ]);
    this.rawSites = sites;
    this.sites = sites.map(x => new Site(x));
    this.groups = groups.map(x => new Group(x, sites));
    } catch(e) {
        console.error(e);
    }
  }

  async getSites() {
    let { sites = [] } = await chrome.storage.local.get("sites");
    if (chrome.runtime.lastError) {
      console.error("An error occurred while fetching your settings.");
      return;
    }
    return sites;
  }

  async getGroups() {
    let { sites = [] } = await chrome.storage.local.get("sites");
    if (chrome.runtime.lastError) {
      console.error("An error occurred while fetching your settings.");
      return;
    }
    return sites;
  }

  /**
   * Finds a Site instance from the cache by its name.
   *
   * @param {string} siteName - The name of the site to find.
   * @returns {Site|undefined} The matching Site instance, or undefined if not found.
   */
  getSiteByName(siteName) {
    return this.sites.find(x => x.name === siteName);
  }
   /**
   * Finds a Group instance from the cache by its name.
   *
   * @param {string} groupName - The name of the group to find.
   * @returns {Group|undefined} The matching Group instance, or undefined if not found.
   */
  getGroupByName(groupName) {
    return this.groups.find(x => x.name === groupName);
  }

  updateFromChange(changes) {
    if (changes.sites) {
        this.sites = changes.sites.newValue.map(x => new Site(x));
        this.rawSites = changes.sites.newValue;
    } else if (changes.groups) {
        this.groups = changes.groups.newValue.map(x => new Group(x, this.rawSites));
    }
  }
}

export const entitiesCache = new EntitiesCache()