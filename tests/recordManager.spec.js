import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { RecordManager } from "../worker/recordManager";

describe('recordManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2025,6,12,10,0,0));
    })
    afterEach(() => {
        vi.useRealTimers();
    })

    it("should add a tab to record", () => {
      let currDate = new Date().toISOString().split("T")[0];
      let mockManager = new RecordManager(
        {
          [currDate]: {
            "test.com": {
              audible: false,
              focused: false,
              initDate: null,
              tabId: null,
              totalTime: 0,
            },
          },
        });
      mockManager.addTabToSite("test.com", 1)
      expect(mockManager.getTodaySiteRecord("test.com").tabId).toStrictEqual([1])
    });
});