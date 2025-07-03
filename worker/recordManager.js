export class RecordManager {
  #records;
  constructor(records) {
    this.#records = records
  }
  
  get records() {
    return this.#records
  }
  set records(rec) {
    this.#records = rec
  }
  
  get todayRecord() {
    let today = new Date().toISOString().split('T')[0];
    return this.#records[today]
  }
  set todayRecord(rec) {
    let today = new Date().toISOString().split('T')[0];
    this.#records[today] = rec;
  }

  getTodaySiteRecord(site) {
    return this.todayRecord[site]
  }

  async getAll() {
    const {records = []} = await chrome.storage.local.get("records");
    this.#records = records;
  }

  async save() {
    await chrome.storage.local.set({records : this.#records})
  }
}