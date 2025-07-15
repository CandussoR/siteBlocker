import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { RecordManager } from '../worker/recordManager.js';
import { Bookkeeper } from '../worker/bookkeeping.js';

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
        global.chrome.tabs.query.mockResolvedValue([{url: "http://test.com"}])
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


});