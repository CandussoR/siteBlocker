import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { isRestricted, isGroupRestrictedByTotalTime, isGroupRestrictedByConsecutiveTime, isGroupRestricted } from '../worker/restrictionsHandler.js'
import { fakeRecord, fakeGroup, fakeSites } from './fakeData.js'

global.chrome = {
    alarms : {
        get : vi.fn(),
        getAll: vi.fn(),
        create : vi.fn(),
        set : vi.fn(),
        clear: vi.fn()
    },
    storage : {
        local : {
            get : vi.fn(),
            set : vi.fn()
        }
    }
}

describe('totalTime', () => {

    let groupRestriction = { days : ["Tuesday"], totalTime : 60 }
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
      let groupRestriction = { days : ["Tuesday"], totalTime : 60 }
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecord})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isGroupRestrictedByTotalTime('test2.com', groupRestriction, undefined)
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-total-time-restriction-begin', {delayInMinutes : 1})
        expect(result).toBe(false)
        expect(global.chrome.storage.local.get).toBeCalledTimes(2)
    })

    it('should be restricted if sum of totalTime for group in records is equal or superior to set totalTime', async () => {
        let groupRestriction = { days : ["Tuesday"], totalTime : 60 }
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isGroupRestrictedByTotalTime('test.com', groupRestriction, false)
        expect(result).toBe(true)
        expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
    })


    it('should be restricted if site totalTime is set, is lesser than its group totalTime and is already attained', async () => {
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let totalTimeRestrictionMock = {"days" : ["Tuesday"], "totalTime" : 30}
        let result = await isGroupRestrictedByTotalTime('test.com', groupRestriction, totalTimeRestrictionMock)
        expect(result).toBe(true)
        expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
    })

    it('calls alarms create with the good parameter in case sites combined totalTime is inferior to group totalTime', async () => {
        let groupTotalTimeRestriction = {
          days : ["Tuesday"],
          totalTime : 60
        }
      let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 15, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 15, },
            },
          };
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecords})
        global.chrome.storage.local.get.mockResolvedValueOnce(fakeSites)
        let result = await isGroupRestrictedByTotalTime('test.com', groupTotalTimeRestriction, false)

        expect(result).toBe(false)
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-total-time-restriction-begin', {delayInMinutes : 0.5})
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

    it('should not be restricted if effective consecutiveTime <= site consecutiveTime',
        async () => {
          // Setup
          let mockRecord = { "records" : { '2024-05-21' : {'test.com' : {consecutiveTime : 0, totalTime : 0}}}}
          let mockSite = { sites : 
            [
              {
                name : 'test.com',
                group: 'Test',
                restrictions : {
                  consecutiveTime : [
                    {"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60}
                  ]
                } 
              }
            ] 
          }
          global.chrome.alarms.getAll.mockResolvedValueOnce([])
          global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                         .mockResolvedValueOnce(mockSite)
          let ctGroup = {"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60}
          // test
          let result = await isGroupRestrictedByConsecutiveTime('test.com', ctGroup, {"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60})
          // result
          expect(global.chrome.storage.local.get).toHaveBeenCalledTimes(2)
          expect(result).toBe(false)
          expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-consecutive-time-restriction-begin', {delayInMinutes : 30})
        })


      it('should set an alarm for Group if the time left for the group is inferior to the time for the site',
        async () => {
          // Setup
          let mockRecord = { "records" : { '2024-05-21' : {'test.com' : {consecutiveTime : 0, totalTime : 0},
                                                          'test2.com': {consecutiveTime : 29*60, totalTime : 0}
                                                        }
                                          }
                            }
          let mockSite = { sites : [{name : 'test.com', restrictions : {consecutiveTime : {days : ["Tuesday"], consecutiveTime: 30*60, pause : 30*60}}, group: 'Test'},
                                    {name : 'test2.com', restrictions : { consecutiveTime : {days : ["Tuesday"], consecutiveTime: 30*60, pause : 30*60} }, group: 'Test'}
          ] }
          global.chrome.alarms.getAll.mockResolvedValueOnce([])
          global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                         .mockResolvedValueOnce(mockSite)
          let ctGroup = {"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60}
          // test
          let result = await isGroupRestrictedByConsecutiveTime('test.com', ctGroup, {days : ["Tuesday"], consecutiveTime: 30*60, pause : 30*60})
          // result
          expect(global.chrome.storage.local.get).toHaveBeenCalledTimes(2)
          expect(result).toBe(false)
          expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-consecutive-time-restriction-begin', {delayInMinutes : 1})
        })

        it('should set an alarm for site if the time left for the site is inferior to the time for the group',
          async () => {
            // Setup
            let mockRecord = { "records" : { '2024-05-21' : {'test.com' : {consecutiveTime : 0, totalTime : 0},
                                                            'test2.com': {consecutiveTime : 60, totalTime : 0}
                                                          }
                                            }
                              }
            let mockSite = { sites : [{name : 'test.com', restrictions : {consecutiveTime : [ {days : ["Tuesday"], consecutiveTime: 2*60, pause : 30*60} ]}, group: 'Test'},
                                      {name : 'test2.com', restrictions : { consecutiveTime : [ {days : ["Tuesday"], consecutiveTime: 2*60, pause : 30*60} ]}, group: 'Test'}
            ] }
            global.chrome.alarms.getAll.mockResolvedValueOnce([])
            global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                           .mockResolvedValueOnce(mockSite)
            let ctGroup = {"days" : ['Tuesday'], consecutiveTime: 30*60, pause: 60*60}
            // test
            let result = await isGroupRestrictedByConsecutiveTime('test2.com', ctGroup, {days : ["Tuesday"], consecutiveTime: 2*60, pause : 30*60})
            // result
            expect(result).toBe(false)
            expect(global.chrome.alarms.create).toHaveBeenCalledWith('test2.com-consecutive-time-restriction-begin', {delayInMinutes : 1})
          })
})


 describe('is restricted', () => {
    beforeEach(() => {
        global.chrome.alarms.get.mockReset();
        global.chrome.alarms.getAll.mockReset();
        global.chrome.alarms.create.mockReset();
        global.chrome.alarms.set.mockReset();
        global.chrome.storage.local.get.mockReset();
        vi.setSystemTime(new Date(2024,4,21,10,0,0));
    })

    afterEach(() => {
        vi.useRealTimers()
    }) 

    it('should be restricted if sum of totaltime for group in records is equal or superior to set totaltime', async () => {
      console.log("CHECK HERE FOR SPANS")
      global.chrome.alarms.getAll.mockResolvedValueOnce([])
        let fakeRecords = {
            "2024-05-21": {
              "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
              "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 30, },
            },
          };
      global.chrome.storage.local.get.mockImplementation(async (key) => {
        if (key == 'groups') return fakeGroup;
        if (key == 'records') return {records : fakeRecords};
        if (key == 'sites') return fakeSites;
      })
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

it('should be restricted if group is restricted and site has no restriction', async () => {
    let mockSites = [{name : "test.com", group : "Test"}]
    let mockGroups = { groups : [{name : 'Test', restrictions : {'timeSlot' : [{'days' : ['Tuesday'], 'time' : ['09:00:00', '11:00:00']}] } }] }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockResolvedValueOnce(mockGroups)
    let result = await isRestricted('test.com', mockSites)
    expect(result).toBe(true)
  })

  it('should be restricted if group is restricted and site has no restriction', async () => {
    let mockSites = [{name : "test.com", group : "Test"}]
    let mockGroups = { groups : [{name : 'Test', restrictions : {'timeSlot' : [{ 'days' : ['Tuesday'], 'time' : ['09:00:00', '11:00:00']}] } }] }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockResolvedValueOnce(mockGroups)
    let result = await isRestricted('test.com', mockSites)
    expect(result).toBe(true)
  })

  it('should create group-level alarm if site is unrestricted but group has upcoming restriction', async () => {
    console.log("PROBLEMATIC TEST")
    let sites = [{name : "test.com", group : "Test"}]
    let mockSites = { sites : [ {name : "test.com", group : "Test"} ] }
    let mockGroups = { groups : [{name : 'Test', restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] } }] }
    let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0, totalTime : 0 } } } }
    global.chrome.storage.local.get.mockImplementation(async (key) => {
        if (key == 'groups') return mockGroups;
        if (key == 'records') return mockRecords;
        if (key == 'sites') return mockSites;
      })
    global.chrome.alarms.getAll.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    let result = await isRestricted('test.com', sites)
    expect(global.chrome.alarms.create).toHaveBeenCalledTimes(1)
    expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-consecutive-time-restriction-begin', {delayInMinutes : 1})
    expect(result).toBe(false)
  })

  it('should not be restricted if site has no group and consecutiveTime <= to restriction consecutiveTime', async () => {
    let sites = [{name : "test.com"}]
    let mockSites = { sites : [ {name : "test.com", restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] }} ] }
    let mockGroups = { groups : [{name : 'Test', restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] } }] }
    let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0 } } } }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockResolvedValueOnce(mockGroups)
    global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
    global.chrome.storage.local.get.mockResolvedValueOnce(mockSites)
    let result = await isRestricted('test.com', sites)
    expect(result).toBe(false)
  })

  it('should create an alarm when site has a consecutive time set for the day', async () => {
    let mockSites = { sites : [ {name : "test.com", restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] }} ] }
    let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0 } } } }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    // global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
    global.chrome.storage.local.get.mockResolvedValueOnce(mockSites)
    let result = await isRestricted('test.com', mockSites.sites)
    expect(global.chrome.alarms.create).toBeCalledWith('test.com-consecutive-time-restriction-begin', {delayInMinutes : 1})
    expect(result).toBe(false)
  })

  it('should create an alarm when GROUP has a consecutive time set for the day', async () => {
  let mockSites = { sites : [{name : 'test.com', restrictions : {consecutiveTime : [{days : ["Tuesday"], consecutiveTime: 30*60, pause : 30*60}]}, group: 'Test'}] }
    let mockGroups = { groups : [{name : 'Test', restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] } }] };
    let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0 } } } }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.alarms.getAll.mockResolvedValueOnce([])  
      global.chrome.storage.local.get.mockImplementation(async (key) => {
      if (key == 'groups') return mockGroups;
      if (key == 'records') return mockRecords;
      if (key == 'sites') return mockSites;
    })
    let result = await isRestricted('test.com', mockSites.sites)
    expect(global.chrome.alarms.create).toBeCalledWith('Test-consecutive-time-restriction-begin', {delayInMinutes : 1})
    expect(result).toBe(false)
  })

  it('should create an alarm for the group if it has a consecutive time set for the day', async () => {
    let mockSites = { sites : [ {name : "test.com", group : 'Test', restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] }} ] };
    let mockGroups = { groups : [{name : 'Test', restrictions : {'consecutiveTime' : [{ 'days' : ['Tuesday'], 'consecutiveTime' : 60, 'pause' : 60}] } }] };
    let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0 } } } };
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockImplementation(async (key) => {
      if (key == 'groups') return mockGroups;
      if (key == 'records') return mockRecords;
      if (key == 'sites') return mockSites;
    })
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    let result = await isRestricted('test.com', mockSites.sites);
    expect(global.chrome.alarms.create).toBeCalledWith('Test-consecutive-time-restriction-begin', {delayInMinutes : 1})
    expect(result).toBe(false)
  })

  it('should not check restriction for if it is for another day in group and site does not have any', async () => {
  //   Setup
    let mockRecord = { "records" : { '2024-05-21' : {'test.com' : {consecutiveTime : 0, totalTime : 0},
                                                    'test2.com': {consecutiveTime : 0, totalTime : 0}
                                                    }
                                    }
                      }
    let mockSites = { sites : 
      [
        {name : 'test.com', restrictions : null, group: 'Test'},
        {name : 'test2.com', restrictions : null, group: 'Test'}
    ] }
    let mockGroups = { groups : [{name : 'Test', restrictions : {'consecutiveTime' : [{"days" : ['Wednesday'], consecutiveTime: 30*60, pause: 60*60}] } }] }
    global.chrome.alarms.getAll.mockResolvedValueOnce([])
    global.chrome.storage.local.get.mockResolvedValueOnce(mockGroups)
    global.chrome.storage.local.get.mockResolvedValueOnce(mockRecord)
                                    .mockResolvedValueOnce(mockSites)
  //   test
    let result = await isRestricted('test.com', mockSites.sites)
  //   result
    expect(global.chrome.storage.local.get).toHaveBeenCalledTimes(2)
    expect(result).toBe(false)
    expect(global.chrome.alarms.create).toHaveBeenCalledTimes(0)
  })
 })