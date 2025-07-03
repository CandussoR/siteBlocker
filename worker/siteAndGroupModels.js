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

    let ret = this.restrictions;
    for (let rest of Object.keys(ret)) {
      ret[rest] = ret[rest].filter((x) => x.days.includes(currentDay));
      if (!ret[rest].length) {
        delete ret[rest];
      }
    }

    return Object.keys(ret).length === 0 ? undefined : ret;
  }
}

class Site extends Watched {
    constructor(siteObj) {
      super(siteObj);
      this.group = siteObj.group
    }
}

class Group extends Watched {
    constructor(groupObj, allSites) {
      super(groupObj)
      this.sites = allSites.filter(x => x.group === this.name).map(x => x.name)
    }
}