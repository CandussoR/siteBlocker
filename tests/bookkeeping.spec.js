import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import * as bookkeeping from '../worker/bookkeeping.js'
import { fakeRecord } from './fakeData.js'

// let todayRecord = {
//     "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: null, totalTime: 0, },
//     "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
//   }

global.chrome = {
    storage : {
        local : {
            get : vi.fn(),
            set : vi.fn()
        }
    },
    tabs : {
        query : vi.fn()
    },
    alarms : {
        create : vi.fn(),
        clear : vi.fn(),
        getAll : vi.fn()
    }
}

describe('bookkeeping', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,9,58,0))
    })
    
    afterEach(() => {
        vi.useRealTimers()
    })
    
    it('should correctly record the opening of a tab without focus', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;
        let todayRecord = {}
        todayRecord[currDate] = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            }
        
        let expectedRecord = {}
        expectedRecord[currDate] = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }    
        global.chrome.storage.local.get.mockResolvedValue({records: todayRecord})
        global.chrome.tabs.query.mockResolvedValueOnce([])
        await bookkeeping.bookkeeping('open', 1, 'test.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedRecord})
    })

    it('should correctly record the opening of a tab with focus', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;
        let todayRecord = {}
        todayRecord[currDate] = {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            }
        
        let expectedRecord = {}
        expectedRecord[currDate] = {
            "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
        }    
        global.chrome.storage.local.get.mockResolvedValue({records: todayRecord})
        global.chrome.tabs.query.mockImplementationOnce(() =>[{url: 'http://test.com', active : true}])
        await bookkeeping.bookkeeping('open', 1, 'test.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedRecord})
    })
})

let mockSite = {
    sites : 
        [
            {
                name: 'test.com', 
                group: 'Test',
                restrictions : {
                    'consecutiveTime' : [
                        {"days": ["Tuesday"], consecutiveTime : 3600, pause : 1800}
                    ]
                }
            }
        ]
    }

describe('handling of consecutiveTime', () => {
    beforeEach(() => {
        global.chrome.storage.local.get.mockReset();
        global.chrome.storage.local.set.mockReset();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 4, 21, 9, 58, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    }); 

    it('should handle consecutiveTime on close', async () => {
        let mockRecord = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    }
                }
        }
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        let result = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, consecutiveTime : 120},
                    }
                }
        } 
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                       .mockResolvedValueOnce(120)
                                       .mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([{ name : 'test.com-consecutive-time-restriction-begin', scheduledTime: Date.now() + 2000}])
        global.chrome.alarms.create.mockResolvedValue(true)
        await bookkeeping.bookkeeping('close', 1)
        expect(global.chrome.storage.local.set).toHaveBeenLastCalledWith(result)
    })

    it('should handle consecutiveTime on no-focus', async () => {
        // mock records
        let mockRecord = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    }
                }
        }
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        let result = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, consecutiveTime : 120},
                    }
                }
        } 
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                       .mockResolvedValueOnce(120)
                                       .mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([{ name : 'test.com-consecutive-time-restriction-begin', scheduledTime: Date.now() + 2000}])
        global.chrome.alarms.create.mockResolvedValue(true)
        await bookkeeping.bookkeeping('no-focus')
        expect(global.chrome.storage.local.set).toHaveBeenLastCalledWith(result)
    })


    it('should handle consecutiveTime on audible-end when not focused', async () => {
        // mock records
        let mockRecord = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    }
                }
        }
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        let result = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: null, tabId: [1], totalTime: 0, consecutiveTime : 120},
                    }
                }
        } 
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                       .mockResolvedValueOnce(2)
                                       .mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([{ name : 'test.com-consecutive-time-restriction-begin', scheduledTime: Date.now() + 2000}])
        global.chrome.alarms.create.mockResolvedValue(true)
        await bookkeeping.bookkeeping('audible-end', undefined, 'test.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(result)
    })


    it('should handle consecutiveTime on change of domain', async () => {
        let mockSites = mockSite
        mockSites['test2.com'] = mockSite.sites['test.com']
        // mock records
        let mockRecord = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    "test2.com": { 
                        audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0, consecutiveTime : 0},
                }
            }
        }
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        let result = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: null, tabId: [1], totalTime: 120, consecutiveTime : 120},
                    "test2.com": { 
                        audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0, consecutiveTime : 0},
                    }
                }
        } 
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                       .mockResolvedValueOnce(2)
                                       .mockResolvedValueOnce(mockSites)
        global.chrome.alarms.getAll.mockResolvedValueOnce([{ name : 'test.com-consecutive-time-restriction-begin', scheduledTime: Date.now() + 2000}])
        global.chrome.alarms.create.mockResolvedValue(true)
        await bookkeeping.bookkeeping('change-focus', 2, 'test2.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(result)
    })

    it('should handle consecutiveTime on change of domain in same tab', async () => {
        let mockRecord = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    "test2.com": { 
                        audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, consecutiveTime : 0},
                }
            }
        }
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        let result = { 
            records : 
                { '2024-05-21' : 
                    { "test.com": { 
                        audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, consecutiveTime : 120},
                    "test2.com": { 
                        audible: false, focused: true, initDate: Date.now(), tabId: [1], totalTime: 0, consecutiveTime : 0},
                    }
                }
        } 
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                       .mockResolvedValueOnce(2)
                                       .mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([{ name : 'test.com-consecutive-time-restriction-begin', scheduledTime: Date.now() + 2000}])
        global.chrome.tabs.query.mockResolvedValueOnce([{'url' : 'https://test2.com', active : true }])
        await bookkeeping.bookkeeping('open', 1, 'test2.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(result)
    })
})