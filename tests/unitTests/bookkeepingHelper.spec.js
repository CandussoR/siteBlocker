import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import * as bookkeeping from '../../worker/blocker/bookkeeping.js'
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
        vi.setSystemTime(new Date(2024,4,21,9,58,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

   it('updates only tabId on tab open without focus', async () => {
    global.chrome.tabs.query.mockResolvedValueOnce([])
    let todayRecord = {
        "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }
    let expectedTodayRecord = {
        "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
      }    
    const result = await bookkeeping.handleOpen(todayRecord, 1, 'test.com')
    expect(result).toStrictEqual(expectedTodayRecord)
   })

//    it('deletes tabId from older site when site changes in tab', async () => {
//     global.chrome.tabs.query.mockResolvedValueOnce([])
//     let todayRecord = {
//         "test.com": { audible: false, focused: false, initDate: new Date().getTime(), tabId: [1], totalTime: 0, },
//         "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
//       }
//     vi.setSystemTime(new Date(2024,4,21,10,0,0))
//     // global.chrome.tabs.query.mockImplementationOnce(() => [])
//     global.chrome.tabs.query.mockImplementationOnce(() => [ { url : 'https://test2.com', active: true}])
//     let expectedTodayRecord = {
//         "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, },
//         "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
//       }    
//     const result = await bookkeeping.handleOpen(todayRecord, 1, 'test2.com')
//     expect(global.chrome.tabs.query).toHaveBeenCalledWith({active : true})
//     expect(result).toStrictEqual(expectedTodayRecord)
//    })

it('deletes tabId from older site when site changes in tab', async () => {
    const initialTime = new Date(2024, 4, 21, 9, 58, 0).getTime();
    const todayRecord = {
      "test.com": { audible: false, focused: false, initDate: initialTime, tabId: [1], totalTime: 0 },
      "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
    };

    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    const expectedTodayRecord = {
      "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
      "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0 },
    };

    global.chrome.tabs.query.mockResolvedValueOnce([{ url: 'https://test2.com', active: true }]);

    const result = await bookkeeping.handleOpen(todayRecord, 1, 'test2.com');

    expect(global.chrome.tabs.query).toHaveBeenCalledWith({ active: true });
    expect(result).toStrictEqual(expectedTodayRecord);
  });


   it('updates tabId and initDate on tab open with focus', async () => {
       let todayRecord = {
           "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
           "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
    global.chrome.tabs.query.mockResolvedValue([{url : 'https://test.com', active : true}])
    let expectedTodayRecord = {
        "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
    }    
    const result = await bookkeeping.handleOpen(todayRecord, 1, 'test.com')
    expect(result).toStrictEqual(expectedTodayRecord)
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

   it("shouldn't update totalTime if no initDate", async () => {

   })
})

describe('handleAudibleStart', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

    it('updates audible and adds initDate if there is none', async () => {
        let siteRecord = { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, }
        let expectedSiteRecord = { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, }
        const result = await bookkeeping.handleAudibleStart(siteRecord)
        expect(result).toStrictEqual(expectedSiteRecord)
       })
})


describe('handleAudibleEnd', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

    it("doesn't calculate totalTime nor reinitialise initDate if focused", async () => {
        let siteRecord = { audible: true, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, }
        let expectedSiteRecord = { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, }
        const result = bookkeeping.handleAudibleEnd(siteRecord)
        expect(result).toStrictEqual(expectedSiteRecord)
       })

    it("doesn't calculate totalTime if no initDate nor focused", () => {
         let siteRecord = { audible: true, focused: false, initDate: null, tabId: [1], totalTime: 0, }
        let expectedSiteRecord = { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, }
        const result = bookkeeping.handleAudibleEnd(siteRecord)
        expect(result).toStrictEqual(expectedSiteRecord)
   })

    it("calculates totalTime and reinitialises initDate on audible end when not focused", () => {
        let siteRecord = { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, }
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        let expectedSiteRecord = { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, }
        const result = bookkeeping.handleAudibleEnd(siteRecord)
        expect(result).toStrictEqual(expectedSiteRecord)
   })
})

describe('handleNoFocus', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

    it('should return focused false for every site and calculate totalTime if not audible', () => {
        let todayRecord = {
            "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        let expectedTodayRecord = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
        }
        const result = bookkeeping.handleNoFocus(todayRecord)
        expect(result).toStrictEqual(expectedTodayRecord)
    })
    
    it("shouldn't calculate totalTime if audible", () => { 
        let todayRecord = {
            "test.com": { audible: true, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }
        let expectedTodayRecord = {
            "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, }
        }
        const result = bookkeeping.handleNoFocus(todayRecord)
        expect(result).toStrictEqual(expectedTodayRecord)
    })
})

describe('handleChangeFocus', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
      afterEach(() => {
          vi.useRealTimers()
      })

    it('should update totalTime and focused if not audible', () => {
        let todayRecord = {
            "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0, },
        }
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        let expectedTodayRecord = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, },
            "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0, }
        }
        const result = bookkeeping.handleChangeFocus(todayRecord, 'test2.com')
        expect(result).toStrictEqual(expectedTodayRecord)
    })
    
    it("shouldn't update totalTime if audible", () => { vi.setSystemTime(new Date(2024,4,21,9,58,0))
        let todayRecord = {
            "test.com": { audible: true, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0, },
        }
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        global.chrome.tabs.query.mockResolvedValueOnce([{url : 'https://test.com', audible : true}])
        let expectedTodayRecord = {
            "test.com": { audible: true, focused: false, initDate: todayRecord["test.com"].initDate, tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0, }
        }
        const result = bookkeeping.handleChangeFocus(todayRecord, 'test2.com')
        expect(result).toStrictEqual(expectedTodayRecord)
    })
})