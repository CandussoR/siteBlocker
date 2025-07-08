// Exactly the same tests as in totalTimeRestrictions, but with consecutiveTime
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsecutiveTimeRestriction } from '../worker/restrictions';
import { Site, Group } from '../worker/siteAndGroupModels';
import { RecordManager } from '../worker/recordManager';
import { EntitiesCache } from '../worker/siteAndGroupModels';

describe('ConsecutiveTimeRestriction', () => {
    beforeEach(() => {
        vi.setSystemTime(new Date(2025,6,7,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    })


  it('returns not violated if site no restriction and no group', () => {
    const site = new Site({"name": test.com})
    const rm = new RecordManager({"2025-07-07" : {"test.com" : {consecutiveTime: 0} } });
    const ec = new EntitiesCache();
    ec.sites = [site];
    ec.groups = [];

    const ttr = new ConsecutiveTimeRestriction(site, rm, ec);
    expect(ttr.isViolated()).toEqual({ violated: false, minutesBeforeRes: undefined });
  });

it('returns site violated if site exceeds time restriction and site has no group', () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        "consecutiveTime": [
          { consecutiveTime: 1800, days: ["Monday"] }
        ],
      },
    });
    const rm = new RecordManager({"2025-07-07" : {"test.com" : {consecutiveTime : 1800, initDate : null} } });
    const ec = new EntitiesCache();
    ec.sites = [site];
    ec.groups = [];

    const ttr = new ConsecutiveTimeRestriction(site, rm, ec);
    const res = ttr.isViolated();
    expect(res.violated).toBe(true);
    expect(res.minutesBeforeRes).toBe(0);
  });

  it('returns a Violated object corresponding to the smaller restriction if there are more than one for today', () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        "consecutiveTime": [
          { consecutiveTime: 1800, days: ["Monday"] },
          { consecutiveTime: 1700, days: ["Monday"] },
        ],
      },
    });
    const rm = new RecordManager({"2025-07-07" : {"test.com" : {consecutiveTime : 1800, initDate : null} } });
    const ec = new EntitiesCache();
    ec.sites = [site];
    ec.groups = [];

    const ttr = new ConsecutiveTimeRestriction(site, rm, ec);
    const res = ttr.isViolated();
    console.log(res)
    expect(res.violated).toBe(true);
    expect(res.minutesBeforeRes).toBeLessThan(0);
  })

  it('uses group restriction if site has none', () => {
    const site = new Site({ name: "test.com", group: "Test" });
    const group = new Group({name: "Test",
      restrictions: { "consecutiveTime": [ { consecutiveTime: 1800, days: ["Monday"] }, ] }
    }, [site])
    const rm = new RecordManager({"2025-07-07" : {"test.com" : {consecutiveTime : 1800, initDate : null} } });
    const ec = new EntitiesCache();
    ec.sites = [site];
    ec.groups = [group];

    const ttr = new ConsecutiveTimeRestriction(site, rm, ec);
    const res = ttr.isViolated();
    expect(res.violated).toBe(true);
    expect(res.minutesBeforeRes).toBe(0);
  });

  it('group is violated if combined site time exceeds group limit', () => {
    const group = new Group(
      {
        name: "Test",
        restrictions: { consecutiveTime: [{ days: ["Monday"], consecutiveTime: 1500 }] },
      },
      [{ name: "example.com", group: "Test"}, { name: "test.com", group : "Test" }]
    );
    const rm = new RecordManager({
      "2025-07-07": {
        "example.com": { consecutiveTime: 1000, initDate: null },
        "test.com": { consecutiveTime: 1800, initDate: null },
      },
    });

    const ec = new EntitiesCache();
    ec.groups = [group];

    const ttr = new ConsecutiveTimeRestriction(group, rm, ec);
    const res = ttr.isViolated();
    expect(res.violated).toBe(true);
  });

  it('prioritizes group restriction if group violates before site', () => {
    const site = new Site({
      name: "test.com",
      group: "Test",
      restrictions: { consecutiveTime: [ { consecutiveTime: 1800, days: ["Monday"] } ] },
    });
    const group = new Group(
      {
        name: "Test",
        restrictions: { consecutiveTime: [{ days: ["Monday"], consecutiveTime: 1500 }] },
      },
      [site]
    );
    const rm = new RecordManager({
      "2025-07-07": {
        "test.com": { consecutiveTime: 1500, initDate: null },
      },
    });

    const ec = new EntitiesCache();
    ec.sites = [site]
    ec.groups = [group];

    const ttr = new ConsecutiveTimeRestriction(site, rm, ec);
    const res = ttr.isViolated();

    expect(res.violated).toBe(true);
  });
})