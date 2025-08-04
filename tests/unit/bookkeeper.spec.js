import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { RecordManager } from '../../worker/recordManager.js';
import { Bookkeeper } from '../../worker/bookkeeping.js';

global.chrome = {
    tabs : {
        query : vi.fn()
    }
}

describe('bookkeeping', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2025,6,12,10,0,0))
    })
    
    afterEach(() => {
        vi.useRealTimers()
    })
    
    it('should correctly record the opening of a tab without focus', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;
        let todayRecord = {[currDate] : {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            }
        }
        let mockRm = new RecordManager(todayRecord);
        let mockBk = new Bookkeeper(mockRm, 1, 'test.com')
        global.chrome.tabs.query = vi.fn()
        global.chrome.tabs.query.mockResolvedValue([{url: "http://test2.com"}])
        let expectedRecord = {}
        expectedRecord[currDate] = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
        mockBk.handleOpen()
        expect(mockRm.records).toStrictEqual(expectedRecord)
    })

        it('should correctly record the opening of a tab with focus', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;
        let todayRecord = {}
        todayRecord[currDate] = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            }
        let mockRm = new RecordManager(todayRecord);
        let mockBk = new Bookkeeper(mockRm, 1, 'test.com')
        global.chrome.tabs.query = vi.fn()
        global.chrome.tabs.query.mockResolvedValue([{url: "http://test.com"}])
        let expectedRecord = {}
        expectedRecord[currDate] = {
            "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
        await mockBk.handleOpen()
        expect(mockRm.records).toStrictEqual(expectedRecord)
    })

    it('shouldnt add the same tab to the same site', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;
        let todayRecord = {}
        todayRecord[currDate] = {
            "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
        let mockRm = new RecordManager(todayRecord);
        let mockBk = new Bookkeeper(mockRm, 1, 'test.com')
        global.chrome.tabs.query = vi.fn()
        global.chrome.tabs.query.mockResolvedValue([{url: "http://test.com"}])
        await mockBk.handleOpen()
        expect(mockRm.records).toStrictEqual(todayRecord)
    })

    it("should handle consecutiveTime on close", async () => {
      let todayRecord = {
        "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime: 0, },
          },
      };
      vi.setSystemTime(new Date(2025, 6, 12, 10, 2, 0));
      let mockRm = new RecordManager(todayRecord);
      let mockBk = new Bookkeeper(mockRm, 1, "test.com");
      global.chrome.tabs.query = vi.fn();
      let result = {
          "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, consecutiveTime: 120, },
          },
      };
      await mockBk.handleClose();
      expect(mockRm.records).toStrictEqual(result);
    });

    it("should handle time and initDate even if close is called for a tab not in siteRecord tabId (bug)", async () => {
        let todayRecord = {
        "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
          },
      };
      vi.setSystemTime(new Date(2025, 6, 12, 10, 2, 0));
      let mockRm = new RecordManager(todayRecord);
      let mockBk = new Bookkeeper(mockRm, 2, "test.com");
      global.chrome.tabs.query = vi.fn();
      let result = {
          "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120 },
          },
      };
      await mockBk.handleClose();
      expect(mockRm.records).toStrictEqual(result); 
    });

    it("should handle consecutive time even if close is called for a tab is not in siteRecord tabId (bug)", async () => {
        let todayRecord = {
        "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0 },
          },
      };
      vi.setSystemTime(new Date(2025, 6, 12, 10, 2, 0));
      let mockRm = new RecordManager(todayRecord);
      let mockBk = new Bookkeeper(mockRm, 2, "test.com");
      global.chrome.tabs.query = vi.fn();
      let result = {
          "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, consecutiveTime : 120 },
          },
      };
      await mockBk.handleClose();
      expect(mockRm.records).toStrictEqual(result); 
    });

    it("should reset consecutive time if no init date and no end alarm (bug)", async () => {
       let todayRecord = {
        "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, consecutiveTime : 120 },
          },
      };
      vi.setSystemTime(new Date(2025, 6, 12, 10, 2, 0));
      let mockRm = new RecordManager(todayRecord);
      let mockBk = new Bookkeeper(mockRm, 2, "test.com");
      global.chrome.tabs.query = vi.fn();
      let am = {loadAlarms : vi.fn().mockResolvedValue([]), hasEndAlarm : vi.fn()}
      let result = {
          "2025-07-12": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, consecutiveTime : 0 },
          },
      };
      await mockBk.handleClose(undefined, am);
      expect(mockRm.records).toStrictEqual(result); 
})
});