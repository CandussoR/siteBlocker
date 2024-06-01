import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { isRestricted, isRestrictedByTotalTime, isRestrictedByConsecutiveTime } from '../../worker/blocker/restrictionsHandler.js'
import { fakeRecord, fakeGroup, fakeSites } from './fakeData.js'

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

 
 describe('consecutiveTime', () => {
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

    it('should not be restricted if effective consecutiveTime <= group or site consecutiveTime',
        async () => {
          // Setup
          let mockRecord = { "records" : { '2024-05-21' : {'test.com' : {consecutiveTime : 0, totalTime : 0}}}}
          let mockSite = { sites : [{name : 'test.com', restrictions : null}] }
          global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                         .mockResolvedValueOnce(mockSite)
          let ctGroup = [{"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60}]
          // test
          await isRestrictedByConsecutiveTime('test.com', ctGroup, undefined)
          // result
          expect(global.chrome.storage.local.get).toHaveBeenCalledTimes(2)
          expect(global.chrome.alarms.create).toHaveBeenCalledWith('test.com-consecutive-time-restriction-begin', {delayInMinutes : 30})
        })


 })


 describe('is restricted', () => {
    beforeEach(() => {
        global.chrome.alarms.get.mockReset();
        global.chrome.alarms.getAll.mockReset();
        global.chrome.alarms.create.mockReset();
        global.chrome.alarms.set.mockReset();
        global.chrome.storage.local.get.mockReset();
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    }) 

    it('should be restricted if sum of totalTime for group in records is equal or superior to set totalTime', async () => {
      global.chrome.alarms.getAll.mockResolvedValueOnce([])
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

    it('should be restricted if an alarm for consecutive time has been set with end',
    async () => {
      // Setup
      global.chrome.alarms.getAll.mockResolvedValueOnce([{name : 'test.com-consecutive-time-restriction-end', scheduledTime : new Date(2024,4,21,11,0,0).getTime()}])
      let mockSite = { sites : [{name : 'test.com', restrictions : null}] }
      global.chrome.storage.local.get.mockResolvedValueOnce(mockSite)
      // test
      let result =await isRestricted('test.com', mockSite.sites)
      // result
      expect(global.chrome.alarms.getAll).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    }
  )

  it('should be restricted if an alarm for consecutive time has been set with end for group',
  async () => {
    // Setup
    global.chrome.alarms.getAll.mockResolvedValueOnce([{name : 'Test-consecutive-time-restriction-end', scheduledTime : new Date(2024,4,21,11,0,0).getTime()}])
    let mockSite = { sites : [{name : 'test.com', restrictions : null, group : 'Test'}] }
    global.chrome.storage.local.get.mockResolvedValueOnce(mockSite)
    // test
    let result =await isRestricted('test.com', mockSite.sites)
    // result
    expect(global.chrome.alarms.getAll).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
  }
)
 })