import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import * as bookkeeping from '../../worker/bookkeeping.js'
import { fakeRecord } from './fakeData.js'

// let todayRecord = {
//     "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: null, totalTime: 0, },
//     "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
//   }

global.chrome = {
    storage : {
        local : {
            get : vi.fn().mockResolvedValue({records : fakeRecord}),
            set : vi.fn()
        }
    },
    tabs : {
        query : vi.fn()
    }
}

describe('handleOpen', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

   it('updates only tabId on tab open without focus', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([])
    let siteRecord = { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    let expectedSiteRecord = { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, }
    const result = await bookkeeping.handleOpen(siteRecord, 1, 'test.com')
    expect(result).toStrictEqual(expectedSiteRecord)
   })

   it('updates tabId and initDate on tab open without focus', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([{url : 'https://test.com', active : true}])
    let siteRecord = { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    let expectedSiteRecord = { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, }
    const result = await bookkeeping.handleOpen(siteRecord, 1, 'test.com')
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true });
    expect(result).toStrictEqual(expectedSiteRecord)
   })
})

describe('handleClose', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })
 
      
   it('should update initDate, tabId and totalTime if initDate and one tab in tabId', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([])

    vi.setSystemTime(new Date(2024,4,21,9,58,0))
    let todayRecord = {
        "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }
    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    let expectedTodayRecord = {
        "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    }
    const result = await bookkeeping.handleClose(todayRecord, 1)
    expect(result).toStrictEqual(expectedTodayRecord)
   })

   it('should update initDate, tabId and totalTime if initDate and multiple tabs in tabId', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([])

    vi.setSystemTime(new Date(2024,4,21,9,58,0))
    let todayRecord = {
        "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1,2], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }
    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    let expectedTodayRecord = {
        "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    }
    const result = await bookkeeping.handleClose(todayRecord, 2)
    expect(result).toStrictEqual(expectedTodayRecord)
   })

   // Need to check close when two tabs of same domain with audible true
   it('should toggle audible if no other tab of same domain is playing', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([])

    vi.setSystemTime(new Date(2024,4,21,9,58,0))
    let todayRecord = {
        "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1,2], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }
    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    let expectedTodayRecord = {
        "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    }
    const result = await bookkeeping.handleClose(todayRecord, 2)
    expect(result).toStrictEqual(expectedTodayRecord)
   })

   it("shouldn't toggle audible if another tab of same domain is playing", async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([{audible : true, url : "https://test.com", tabId: 1}])

    vi.setSystemTime(new Date(2024,4,21,9,58,0))
    let todayRecord = {
        "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1,2], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }
    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    let expectedTodayRecord = {
        "test.com": { audible: true, focused: false, initDate: todayRecord["test.com"].initDate, tabId: [1], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
    }
    const result = await bookkeeping.handleClose(todayRecord, 2)
    expect(result).toStrictEqual(expectedTodayRecord)
   })
})