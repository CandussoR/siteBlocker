import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { isRestricted, isRestrictedByTotalTime } from '../../worker/blocker/restrictionsHandler.js'
import { fakeRecord, fakeGroup, fakeSites } from './fakeData.js'

global.chrome = {
    alarms : {
        get : vi.fn(),
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

describe('totalTime', () => {
    beforeEach(() => {
        global.chrome.alarms.get.mockReset();
        global.chrome.alarms.create.mockReset();
        global.chrome.alarms.set.mockReset();
        global.chrome.storage.local.get.mockReset();
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should create an alarm if totalTime is not up', async () => {
        let [groupRestriction] = fakeGroup.groups.filter(x => x.name === 'Test')
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecord})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isRestrictedByTotalTime('test2.com', groupRestriction.restrictions.totalTime, false)
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('test2.com-total-time-restriction-begin', {delayInMinutes : 1})
        expect(result).toBe(false)
        expect(global.chrome.storage.local.get).toBeCalledTimes(2)
    })

    it('should be restricted if sum of totalTime for group in records is equal or superior to set totalTime', async () => {
        let [groupRestriction] = fakeGroup.groups.filter(x => x.name === 'Test')
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isRestrictedByTotalTime('test.com', groupRestriction.restrictions.totalTime, false)
        expect(result).toBe(true)
        expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
    })


    it('should be restricted if site totalTime is set, is lesser than its group totalTime and is already attained', async () => {
        let [groupRestriction] = fakeGroup.groups.filter(x => x.name === 'Test')
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let totalTimeRestrictionMock = [{"days" : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "totalTime" : 30}]
        let result = await isRestrictedByTotalTime('test.com', groupRestriction.restrictions.totalTime, true, totalTimeRestrictionMock)
        expect(result).toBe(true)
        expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
    })

    it('calls alarms create with the good parameter in case sites combined totalTime is inferior to group totalTime', async () => {
        let [groupRestriction] = fakeGroup.groups.filter(x => x.name === 'Test')
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 15, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 15, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isRestrictedByTotalTime('test.com', groupRestriction.restrictions.totalTime, false)

        expect(result).toBe(false)
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('test.com-total-time-restriction-begin', {delayInMinutes : 0.5})
    })
 })

 describe('is restricted', () => {
    beforeEach(() => {
        global.chrome.alarms.get.mockReset();
        global.chrome.alarms.create.mockReset();
        global.chrome.alarms.set.mockReset();
        global.chrome.storage.local.get.mockReset();
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    }) 

    it('should be restricted if sum of totalTime for group in records is equal or superior to set totalTime', async () => {
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeGroup)
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isRestricted('test.com', fakeSites.sites)
        expect(result).toBe(true)
        expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
    })
 })