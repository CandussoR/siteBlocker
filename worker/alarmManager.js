/**
 * @typedef {Object} Infos
 * @property {string} host - website host
 * @property {import("./restrictions.js").ViolationStatus} vs
 */

export class AlarmManager {
  #mapped = {
    consecutiveTime: "consecutive-time",
    totalTime: "total-time",
    timeSlots: "time-slots",
  };

  constructor(alarms) {
    this.alarms = alarms;
  }

  async loadAlarms() {
    this.alarms = await chrome.alarms.getAll();
  }
  /**
   *
   * @param {string} alarmName
   * @param {{delayInMinutes : Number}} delayInMinutes
   */
  async setAlarm(alarmName, delayInMinutes) {
    await chrome.alarms.create(alarmName, delayInMinutes);
  }
  async deleteAlarm(anAlarm) {
    await chrome.alarms.clear(anAlarm.name);
    this.alarms.filter((x) => x.name === anAlarm);
  }

  /**
   *
   * @param {'consecutiveTime'|'totalTime'|'timeSlots'} [constraint]
   * @returns {object[]} - an array containing either all alarms or alarms filtered by constraint
   */
  async getCurrentAlarms(constraint = null) {
    if (constraint && !(constraint in this.#mapped)) {
      throw Error("Constraint doesn't exist");
    }

    const alarms = this.alarms
      ? JSON.parse(JSON.stringify(this.alarms))
      : await this.loadAlarms();

    return constraint
      ? alarms
      : alarms.filter((x) => this.#mapped[constraint] in x.name);
  }

  getBeginAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms.filter(
        (x) => x[x.length - 1] === "n" && x.startsWith(hostOrGroupName)
      );
    else return this.alarms.filter((x) => x[x.length - 1] === "n");
  }
  getEndAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms.filter(
        (x) => x[x.length - 1] === "d" && x.startsWith(hostOrGroupName)
      );
    else return this.alarms.filter((x) => x[x.length - 1] === "d");
  }
  getCheckAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms.filter(
        (x) => x.name[x.name.length - 1] === "k" && x.name.startsWith(hostOrGroupName)
      );
    else return this.alarms.filter((x) => x[x.name.length - 1] === "k");
  }

  /**
   * @param {string} host 
   * @param {string} group - name of the group the host belongs to if any
   * @returns {boolean} if there is one or more end alarm
   */
  hasEndAlarm(host, group) {
    return this.getEndAlarms(host).length || (group && this.getEndAlarms(group))
  }


  /**
   *
   * Handling the alarms we should set or not before entering the bookkeeping phase.
   * In general, timeSlot alarms are set at startup or when added / modified,
   * so it should only really handle consecutive time and total time.
   * Total time alarm is deleted when closed, so no need to delete before setting either.
   * @param {Infos} infos - everything needed to handle stuff
   */
  handleRestrictionAlarm(infos) {
    if (!infos.vs.minutesBeforeRes) return;
    if (infos.vs.restriction === "timeSlot") return;

    switch (infos.vs.restriction) {
      case "timeSlot":
        return;
      case "consecutiveTime":
        this.#setUpCTA(infos);
        return
      case "totalTime":
        this.setAlarm(
          [infos.vs.entity, this.#mapped[vs.restriction], "begin"].join("-"),
          { delayInMinutes: infos.vs.minutesBeforeRes }
        );
        return;
    }
  }

  /**
   *
   * @param {Infos} infos
   */
  async #setUpCTA(infos) {
    let beginCtas = await this.getCurrentAlarms(infos.vs.restriction)
    beginCtas = beginCtas.filter(
      (x) => x.name[x.name.length - 1] === "n" && x.name.startsWith(infos.vs.entity)
    );
    if (beginCtas.length) { for (let a of beginCtas) this.deleteAlarm(a.name); }

    const check = this.getCheckAlarms(infos.vs.entity)
    if (check.length) { for (let a of check) this.deleteAlarm(a.name); }

    this.setAlarm(
      infos.vs.entity + "-consecutive-time-restriction-begin",
      { delayInMinutes: infos.vs.minutesBeforeRes }
    );
  }
}