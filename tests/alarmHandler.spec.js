import { afterEach, beforeEach, expect, vi } from 'vitest';
import { TimeSlotAlarmHandler, ConsecutiveTimeAlarmHandler } from '../worker/alarmsHandler.js';
import { EntitiesCache, Site } from '../worker/siteAndGroupModels.js';
import { TabManager } from '../worker/tabManager.js';

describe("alarms setup", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2025, 6, 9, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should set timeSlot alarms for site entities", async () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        timeSlot: [{ days: ["Wednesday"], time: [["09:00", "11:00"]] }],
      },
    });

    const entitiesCache = new EntitiesCache();
    entitiesCache.sites = [site];

    const mockManager = {
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    };

    const tsah = new TimeSlotAlarmHandler(null, null, entitiesCache);
    tsah.initializeEveryAlarm(mockManager);
    expect(mockManager.setAlarm).toHaveBeenCalledTimes(1);
    expect(mockManager.setAlarm).toHaveBeenCalledWith(
      "test.com-time-slot-restriction-end",
      { delayInMinutes: 60 }
    );
  });

  it("should set timeSlot begin alarms for site entities when it receives end", async () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        timeSlot: [{ days: ["Wednesday"], time: [["10:00", "11:00"]] }],
      },
    });

    const mockEc = new EntitiesCache();
    mockEc.sites = [site];

    const mockAm = { setAlarm: vi.fn(), deleteAlarm: vi.fn() };

    const tabManager = {
      getAll: vi.fn(() => [{ url: "http://test.com", id: [1] }]),
      redirectTabsRestrictedByAlarm: vi.fn(),
    };

    const mockParsed = {
      isGroup: false,
      phase: "end",
      restriction: "time",
      target: "test.com",
    };

    const ctah = new TimeSlotAlarmHandler(
      { name: "test.com-time-slot-restriction-end" },
      mockParsed,
      mockEc
    );
    await ctah.handle(tabManager, mockAm);

    expect(mockAm.setAlarm).toHaveBeenCalledTimes(1);
    expect(mockAm.setAlarm).toHaveBeenCalledWith(
      "test.com-time-slot-restriction-begin",
      { delayInMinutes: 60 }
    );
  });

    it("should set timeSlot end alarms for site entities and redirect when it receives begin", async () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        timeSlot: [{ days: ["Wednesday"], time: [["10:00", "11:00"]] }],
      },
    });

    const mockEc = new EntitiesCache();
    mockEc.sites = [site];

    const mockAm = { setAlarm: vi.fn(), deleteAlarm: vi.fn() };

    const tabs = [{ url: "http://test.com", id: [1] }]
    const tabManager = {
      getAll: vi.fn(() => tabs),
      redirectTabsRestrictedByAlarm: vi.fn(),
    };

    const mockParsed = {
      isGroup: false,
      phase: "begin",
      restriction: "time",
      target: "test.com",
    };

    const ctah = new TimeSlotAlarmHandler(
      { name: "test.com-time-slot-restriction-begin" },
      mockParsed,
      mockEc
    );
    await ctah.handle(tabManager, mockAm);

    expect(mockAm.setAlarm).toHaveBeenCalledTimes(1);
    expect(mockAm.setAlarm).toHaveBeenCalledWith(
      "test.com-time-slot-restriction-end",
      { delayInMinutes: 60 }
    );
    expect(tabManager.redirectTabsRestrictedByAlarm).toHaveBeenCalled(1);
    expect(tabManager.redirectTabsRestrictedByAlarm).toHaveBeenLastCalledWith(["test.com"], tabs, "11:00")
  });

  it("should set consecutiveTime end alarms for site entities", async () => {
    const site = new Site({
      name: "test.com",
      restrictions: {
        consecutiveTime: [
          { days: ["Wednesday"], consecutiveTime: 60, pause: 60 },
        ],
      },
    });

    const mockEc = new EntitiesCache();
    mockEc.sites = [site];

    const mockAm = { setAlarm: vi.fn(), deleteAlarm: vi.fn() };

    const tabManager = {
      getAll: vi.fn(() => [{ url: "http://test.com", id: [1] }]),
      redirectTabsRestrictedByAlarm: vi.fn(),
    };

    const mockParsed = {
      isGroup: false,
      phase: "begin",
      restriction: "consecutive",
      target: "test.com",
    };

    const ctah = new ConsecutiveTimeAlarmHandler(
      { name: "test.com-consecutive-time-restriction-begin" },
      mockParsed,
      mockEc
    );
    await ctah.handle(tabManager, mockAm);

    const sth = new Date(
      new Date().getTime() +
        site.todayRestrictions.consecutiveTime[0].pause * 1000
    );
    expect(tabManager.redirectTabsRestrictedByAlarm).toHaveBeenCalledTimes(1);
    expect(tabManager.redirectTabsRestrictedByAlarm).toHaveBeenCalledWith(
      ["test.com"],
      [{ url: "http://test.com", id: [1] }],
      sth.toLocaleTimeString()
    );
  });
});