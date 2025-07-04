export class AlarmManager {
  #mapping = {
    consecutiveTime: "consecutive-time",
    totalTime: "total-time",
    timeSlots: "time-slots",
  };

  constructor(alarms) {
    this.alarms = alarms;
  }

  /**
   *
   * @param {'consecutiveTime'|'totalTime'|'timeSlots'} constraint
   * @returns
   */
  async getCurrentAlarms(constraint = null) {
    if (constraint && !(constraint in this.#mapping)) {
      throw Error("Constraint doesn't exist");
    }

    const alarms = await chrome.alarms.getAll();
    if (!constraint) {
      return alarms;
    } else {
      return alarms.filter((x) => this.#mapping(constraint) in x);
    }
  }

  getBeginAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms
        .filter((x) => x[x.length - 1] === "n" && x.startsWith(hostOrGroupName))
        .map((x) => x.name);
    else
      return this.alarms
        .filter((x) => x[x.length - 1] === "n")
        .map((x) => x.name);
  }
  getEndAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms
        .filter((x) => x[x.length - 1] === "d" && x.startsWith(hostOrGroupName))
        .map((x) => x.name);
    else
      return this.alarms
        .filter((x) => x[x.length - 1] === "d")
        .map((x) => x.name);
  }
  getCheckAlarms(hostOrGroupName) {
    if (hostOrGroupName)
      return this.alarms
        .filter((x) => x[x.length - 1] === "k" && x.startsWith(hostOrGroupName))
        .map((x) => x.name);
    else
      return this.alarms
        .filter((x) => x[x.length - 1] === "k")
        .map((x) => x.name);
  }

  async setAlarm(alarmName, delayInMinutes) {
    await chrome.alarms.create(alarmName, delayInMinutes);
  }
  async deleteAlarm(anAlarm) {
    await chrome.alarms.clear(anAlarm.name);
  }
}