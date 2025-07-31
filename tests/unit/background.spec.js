import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EntitiesCache, Site } from "../../worker/siteAndGroupModels";
import { RecordManager } from "../../worker/recordManager";
import { onTabUpdated } from "../../worker/hookHandler.js";

global.chrome = {
    tabs: {
        get: vi.fn(),
        update: vi.fn(),
    },
    alarms: {
        getAll: vi.fn(),
    },
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
        },
    },
};

vi.mock("../../worker/alarmManager", () => {
    return {
        AlarmManager: vi.fn().mockImplementation(() => ({
            loadAlarms: vi.fn(),
            hasEndAlarm: vi.fn().mockReturnValue([]),
            handleRestrictionAlarm: vi.fn(),
            setAlarm: vi.fn(),
        })),
    };
});

describe("tabs.onUpdated", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2025, 6, 28, 10, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function getMocks() {}
    it("should create a consecutive time alarm if site has consecutive time restrction", async () => {
        const rec = {
            "2025-07-28": {
                "test.com": {
                    initDate: null,
                    tabId: null,
                    audible: false,
                    totalTime: 0,
                    consecutiveTime: 0,
                },
            },
        };
        const entitiesCache = {
            initialized: true,
            sites: [
                new Site({
                    name: "test.com",
                    restrictions: {
                        consecutiveTime: [
                            {
                                days: ["Monday"],
                                consecutiveTime: 60,
                                pause: 60,
                            },
                        ],
                    },
                }),
            ],
            groups: [],
            getSiteByName: vi.fn().mockReturnValue(
                new Site({
                    name: "test.com",
                    restrictions: {
                        consecutiveTime: [
                            {
                                days: ["Monday"],
                                consecutiveTime: 60,
                                pause: 60,
                            },
                        ],
                    },
                })
            ),
            getGroupByName: vi.fn(),
        };

        const rm = new RecordManager(rec);
        global.chrome.tabs.get = vi
            .fn()
            .mockResolvedValue([{ url: "http://test.com", id: 1 }]);

        global.chrome.alarms.getAll.mockResolvedValue([]);
        global.chrome.storage.local.get.mockResolvedValue({ busy: false });
        global.chrome.storage.local.set.mockResolvedValue({ busy: true });

        await onTabUpdated(
            entitiesCache,
            rm,
            1,
            { url: "http://test.com" },
            { incognito: false }
        );

        const { AlarmManager } = await import("../../worker/alarmManager");
        const instance = AlarmManager.mock.results[0].value;

        expect(instance.handleRestrictionAlarm).toHaveBeenCalledOnce();
        expect(instance.handleRestrictionAlarm).toHaveBeenCalledWith({
            host: "test.com",
            vs: {
                violated: false,
                minutesBeforeRes: 1,
                restriction: "consecutiveTime",
                entity: "test.com",
            },
        });
    });
});

// describe('tabs.onActivated', () => {});
// describe('window.onFocusChanged', () => {});
