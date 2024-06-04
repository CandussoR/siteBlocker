import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { fakeGroup, fakeSites } from './fakeData.js'
import { setRecords, cleanRecords } from '../../worker/settingRecord.js'

global.chrome = {
    alarms : {
        get : vi.fn(),
        getAll: vi.fn(),
        create : vi.fn(),
        set : vi.fn()
    },
    storage : {
        local : {
            get : vi.fn(),
            set : vi.fn()
        }
    }
}

describe('sth', () => {
    beforeEach(() => {
        global.chrome.storage.local.get.mockReset();
        global.chrome.storage.local.set.mockReset();
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should set records', async () => {
        let today = new Date().toISOString().split('T')[0];
        let rawFakeRecord = {
            "records"  : {"2024-05-20": {
                 "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                 "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                 }
               }
             };
        let fakeRecordResult = {
            "records"  : {
                "2024-05-20": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                },
                "2024-05-21": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    },
                }
            }
        global.chrome.storage.local.get.mockResolvedValueOnce(rawFakeRecord)
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeGroup)
        global.chrome.storage.local.get.mockResolvedValueOnce([])
        let result = await setRecords(today)
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(1, fakeRecordResult)
        expect(result).toStrictEqual(fakeRecordResult.records)
    })

    it('should clean past records', async () => {
        let fakeRecordInput = {
                "2024-05-20": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test3.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 600, }
                },
                "2024-05-21": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    },
                }
        let result = { 
            "records" : {
                "2024-05-20": {
                    "test3.com": 600
                },
                "2024-05-21": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    },
                } }
        let today = new Date().toISOString().split('T')[0];
        await cleanRecords(undefined, fakeRecordInput, today)
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(1, {lastCleaned : today})
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(2, result)
    })

    it('should not do anything if records has only today', async () => {
        let fakeRecordInput = {
                "2024-05-21": {
                    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                    },
                }
        let today = new Date().toISOString().split('T')[0];
        await cleanRecords(undefined, fakeRecordInput, today)
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(1, {lastCleaned : today})
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(2, {records : fakeRecordInput})
    })

    it('should not do anything if records has been cleaned today', async () => {
        let fakeRecordInput = {
          "2024-05-20": {
            "test3.com": 600,
          },
          "2024-05-21": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
          },
        }; 
        let today = new Date().toISOString().split('T')[0];
        await cleanRecords(undefined, fakeRecordInput, today)
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(1, {lastCleaned : today})
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(2, {records : fakeRecordInput})
    }) 

    it('should clean the right data', async () => {
        let fakeRecordInput = {
          "2024-05-19": {
            "test3.com": 600,
          },
          "2024-05-20": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 60, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 60 },
          },
          "2024-05-21": {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
          },
        }; 
        let result = { 
            "records" : {
                "2024-05-19": {
                "test3.com": 600,
                },
                "2024-05-20": {
                "test.com": 60,
                "test2.com": 60,
                },
                "2024-05-21": {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
                },
          } 
        }; 
        let today = new Date().toISOString().split('T')[0];
        await cleanRecords('2024-05-19', fakeRecordInput, today)
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(1, {lastCleaned : today})
        expect(global.chrome.storage.local.set).toHaveBeenNthCalledWith(2, result)
    }) 
})