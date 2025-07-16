import { Site } from "./siteAndGroupModels";
export class RecordManager {
  #records;

  constructor(records = null) {
    this.#records = records;
  }

  async initialize() {
    const { records = [] } = await chrome.storage.local.get("records");
    this.#records = records;
  }

  get records() {
    return this.#records;
  }
  set records(rec) {
    this.#records = rec;
  }

  get todayRecord() {
    let today = new Date().toISOString().split("T")[0];
    return this.#records[today];
  }
  set todayRecord(rec) {
    let today = new Date().toISOString().split("T")[0];
    this.#records[today] = rec;
  }

  /**
   * 
   * @param {string} site - a host
   * @returns {object|undefined} The record of the site given or undefined if there is not
   */
  getTodaySiteRecord(site) {
    return this.todayRecord[site];
  }

  updateFromStorageChange(changes, entitiesCache) {
    if (
      !changes.sites ||
      changes.sites.newValue.length < changes.sites.oldValue.length
    )
      return;

    for (let site of changes.sites.newValue) {
      if (!(site.name in this.todayRecord)) {
        this.todayRecord[site.name] = {
          initDate: null,
          totalTime: 0,
          audible: false,
          tabId: null,
          focused: false,
        };
        if (
          entitiesCache.getSiteByName(site.name)?.todayRestrictions
            ?.consecutiveTime
        ) {
          this.todayRecord[site.name].consecutiveTime = 0;
        }
      }
    }
  }

  async save() {
    await chrome.storage.local.set({ records: this.#records });
  }

  /**
   * 
   * @param {Site|Group|String} entityOrHost 
   */
  setConsecutiveTime(entityOrHost) {
    const siteRecord = typeof entityOrHost === "string"? this.getTodaySiteRecord(entityOrHost) : this.getTodaySiteRecord(entityOrHost.name);
    siteRecord.consecutiveTime = Math.round((new Date() - siteRecord.initDate) / 1000);
  }

  resetConsecutiveTime(entity) {
    let sitesToReset = entity instanceof Site ? [entity.name] : entity.sites;
    const record = this.todayRecord;
    sitesToReset.forEach((s) => {
      record[s].totaltime += record[s].consecutivetime;
      record[s].consecutiveTime = 0;
    });
    this.save();
  }

  /**
   *
   * @param {Number} tabId
   * @returns {string|undefined} the name of the site in this tabId
   */
  getSiteOfTab(tabId) {
    for (let site in this.todayRecord) {
      if (this.todayRecord[site].tabId?.includes(tabId)) {
        return site;
      }
    }
  }

  addTabToSite(site, tabId) {
    let siteRecord = this.getTodaySiteRecord(site);
    if (siteRecord.tabId instanceof Array && siteRecord.tabId.includes(tabId))
      siteRecord.tabId.push(tabId);
    else siteRecord.tabId = [tabId];
  }

  async addFocusToSite(site) {
    let siteRecord = this.getTodaySiteRecord(site);
    siteRecord.focused = true;
    siteRecord.initDate = Date.now();
    console.log(this.todayRecord[site])
  }
  /**
   *
   * @returns {string} site - the name of the focused site
   */

  getSiteFocused() {
    for (let site in this.todayRecord) {
      if (this.todayRecord[site].focused) {
        return site;
      }
    }
  }
}

export const rm = new RecordManager();
