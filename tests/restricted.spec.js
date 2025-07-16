import { describe } from "vitest";
import { isRestricted } from "../worker/restrictionsHandler";
import { Site, Group, EntitiesCache } from "../worker/siteAndGroupModels";
import { RecordManager } from "../worker/recordManager";

describe("isRestricted", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2025, 6, 7, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns not violated if not violated", () => {
    const site = new Site({ name: "test.com" });
    const em = new EntitiesCache();
    em.sites = [site];
    const rm = new RecordManager({
      "2025-07-07": { "test.com": { totalTime: 1000 } },
    });
    const ret = isRestricted("test.com", em, rm);
    expect(ret.violated).toBe(false);
  });

  it("returns violated if timeSlot is violated", () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        timeSlot: [{ days: ["Monday"], time: [["09:00", "11:00"]] }],
      },
    });
    const em = new EntitiesCache();
    em.sites = [site];
    const rm = new RecordManager({
      "2025-07-07": { "test.com": { totalTime: 1000 } },
    });
    const ret = isRestricted("test.com", em, rm);
    expect(ret.violated).toBe(true);
    expect(ret.restriction).toBe("timeSlot");
  });

  it("returns the closest violation if not violated", () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        timeSlot: [{ days: ["Monday"], time: [["11:00", "12:00"]] }],
        consecutiveTime: [
          { days: ["Monday"], consecutiveTime: 1800, pause: 600 },
        ],
        totalTime: [{ days: ["Monday"], totalTime: 2000 }],
      },
    });
    const ec = new EntitiesCache();
    ec.sites = [site];
    const rm = new RecordManager({
      "2025-07-07": {
        "test.com": { totalTime: 1000, consecutiveTime: 500, initDate: null },
      },
    });
    const ret = isRestricted("test.com", ec, rm);
    expect(ret.violated).toBe(false);
    expect(ret.restriction).toBe("totalTime");
  });

  // Old test converted
  it("should be restricted if site totalTime is set, is lesser than its group totalTime and is already attained", async () => {
    const site = new Site({
      name: "test.com",
      restrictions: { totalTime: [{ days: ["Monday"], totalTime: 30 }] },
    });
    const ec = new EntitiesCache();
    ec.sites = [site];
    let records = {
      "2025-07-07": {
        "test.com": {
          audible: false,
          focused: false,
          initDate: null,
          tabId: null,
          totalTime: 30,
        },
        "test2.com": {
          audible: false,
          focused: false,
          initDate: null,
          tabId: null,
          totalTime: 0,
        },
      },
    };
    const rm = new RecordManager(records);
    const ret = isRestricted("test.com", ec, rm);
    expect(ret.violated).toBe(true);
    expect(ret.minutesBeforeRes).toBe(0);
  });

  it("should not be restricted if effective consecutiveTime <= site consecutiveTime", async () => {
    let mockSite = new Site({
      name: "test.com",
      group: "Test",
      restrictions: {
        consecutiveTime: [
          { days: ["Monday"], consecutiveTime: 30 * 60, pause: 60 * 60 },
        ],
      },
    });
    let ctGroup = [{"days" : ['Monday'], consecutiveTime: 30*60, pause: 60*60}]
    let group = new Group({name : "Test", restrictions : {consecutiveTime : ctGroup}}, [mockSite])
    let rm = new RecordManager({ "2025-07-07": { "test.com": { consecutiveTime: 0, totalTime: 0 } } });
    let ec = new EntitiesCache();
    ec.sites = [mockSite]
    ec.groups = [group]
    let ret = isRestricted("test.com", ec, rm);
    expect(ret.violated).toBe(false);
    expect(ret.minutesBeforeRes).toBe(30);
    expect(ret.restriction).toBe("consecutiveTime")
    expect(ret.entity).toBe("Test");
  });
});