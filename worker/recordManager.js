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
          entitiesCache.getSiteByName(site.name)?.todayRestrictions?.consecutiveTime
        ) {
          this.todayRecord[site.name].consecutiveTime = 0;
        }
      }
    }
  }

  async save() {
    await chrome.storage.local.set({ records: this.#records });
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
}

export const rm = new RecordManager()