import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { createAlarms, getItemsWithNewRestrictions, handleOnAlarm, handleStorageChange } from '../../worker/alarmsHandler.js'


global.chrome = {
    storage : {
        local : {
            get : vi.fn(),
            set : vi.fn()
        }
    },
    alarms: {
        create: vi.fn(),
        getAll : vi.fn().mockResolvedValueOnce([]),
        clear: vi.fn(),
        clearAll : vi.fn().mockResolvedValue(true)
    },
    tabs : {
        query : vi.fn()
    }
}


describe('createAlarms', () => {
    beforeEach(() => {
        // Reset mocks before each test
        global.chrome.storage.local.get.mockReset()
        global.chrome.storage.local.set.mockReset()
        // global.chrome.tabs.query.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
    afterEach(() => {
        vi.useRealTimers()
    })

    it('should only create the very next timeSlot alarm for end of restriction', async () => {
        let mockGroup = {
            groups : 
            [
                {
                    name: 'Test', 
                    restrictions : {
                                'timeSlot': [{'days' : ['Tuesday'], 'time': [['09:00', '11:00']]}],
                                'consecutiveTime' : [{'days': ['Saturday'], 'consecutiveTime': 60, 'pause': 60}]
                            }
                }
            ]
        }

        let mockSites = {
            sites : 
            [
                {
                    name: 'test.com', 
                    group: 'Test',
                    restrictions : null
                }
            ]
        }
        //mock groups with restrictions
        global.chrome.storage.local.get.mockResolvedValueOnce(mockGroup)
        // mock sites with or without restrictions
        global.chrome.storage.local.get.mockResolvedValueOnce(mockSites)
        await createAlarms()
        expect(global.chrome.alarms.create).toHaveBeenCalledOnce()
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-time-slot-restriction-end', {delayInMinutes : 60})
    })

    it('should create an alarm for the beginning of the next restriction period', async () => {
       let mockGroup = {
            groups : 
            [
                {
                    name: 'Test', 
                    restrictions : {
                                'timeSlot': [{'days' : ['Tuesday'], 'time': [['08:00', '09:00'], ['11:00', '13:00']]}],
                                'consecutiveTime' : [{'days': ['Saturday'], 'consecutiveTime': 60, 'pause': 60}]
                            }
                }
            ]
        }

        let mockSites = {
            sites : 
            [
                {
                    name: 'test.com', 
                    group: 'Test',
                    restrictions : null
                }
            ]
        }
        //mock groups with restrictions
        global.chrome.storage.local.get.mockResolvedValueOnce(mockGroup)
        // mock sites with or without restrictions
        global.chrome.storage.local.get.mockResolvedValueOnce(mockSites)
        await createAlarms()
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('Test-time-slot-restriction-begin', {delayInMinutes : 60})
    })
})


describe('handleStorageChange', () => {
    beforeEach(() => {
        // Reset mocks before each test
        global.chrome.storage.local.get.mockReset()
        global.chrome.storage.local.set.mockReset()
        global.chrome.alarms.create.mockReset()
        global.chrome.alarms.getAll.mockReset()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
      })
      
    afterEach(() => {
        vi.useRealTimers()
    })

    it('should adapt to a modification of time slot when restriction has changed', async () => {
        let oldSites = [ { name: 'test.com', group: 'Test', restrictions : null } ]
        let newSites = [ { name: 'test.com', group: 'Test', restrictions : {'timeSlot' : [{'days' : ['Tuesday'], 'time': [['09:00', '11:00']] } ] } } ]
        let changes = 
            { sites : 
                {
                    newValue : newSites,
                    oldValue : oldSites
                }
            }
        let mockRecords = { records : { '2024-05-21' : { 'test.com' : { totalTime : 0} } } }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        expect(global.chrome.storage.local.set).toBeCalledWith(mockRecords)
        expect(global.chrome.alarms.create).toHaveBeenCalledOnce()
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('test.com-time-slot-restriction-end', {delayInMinutes : 60})
    })

    it('should add consecutiveTime in records if consecutiveTime has been extended to today', async () => {
        let newSites = [ { name: 'test.com', group: 'Test', restrictions : {'consecutiveTime' : [{'days' : ['Monday', 'Tuesday'], 'consecutiveTime': 60, 'pause' : 60 } ] } } ]
        let  oldSites = [ { name: 'test.com', group: 'Test', restrictions : {'consecutiveTime' : [{'days' : ['Monday'], 'consecutiveTime': 60, 'pause' : 60 } ] } } ]
        let changes = 
            { sites : 
                {
                    newValue : newSites,
                    oldValue : oldSites
                }
            }
        let mockRecords = { records : { '2024-05-21' : { 'test.com' : { totalTime : 0} } } }
        let mockRecordsResult = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 0, totalTime : 0} } } }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        expect(global.chrome.storage.local.set).toHaveBeenCalledOnce()
        expect(global.chrome.storage.local.set).toBeCalledWith(mockRecordsResult)
    })
    
    it('should not do anything if group without site has been added a restriction', async () => {
        let oldGroup = [ { name: 'Test', restrictions : null } ]
        let newGroup = [ { name: 'Test', restrictions : {'consecutiveTime' : [{'days' : ['Monday'], 'time': 60, 'pause' : 60 } ] } } ]
        let changes = 
            { groups : 
                {
                    newValue : newGroup,
                    oldValue : oldGroup
                }
            }
        let mockRecords = { records : { '2024-05-21' : { 'test.com' : { totalTime : 0} } } }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.storage.local.get.mockResolvedValueOnce({sites : []})
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(mockRecords)
    })

    it('should add consecutiveTime to sites of a group on adding consecutive time to group for today', async () => {
        let oldGroup = [ { name: 'Test', restrictions : null } ]
        let newGroup = [ { name: 'Test', restrictions : {'consecutiveTime' : [{'days' : ['Tuesday'], 'time': 60, 'pause' : 60 } ] } } ]
        let changes = 
            { groups : 
                {
                    newValue : newGroup,
                    oldValue : oldGroup
                }
            }
        let mockRecords = { records : { '2024-05-21' : { 'test.com' : { initDate : null, totalTime : 0} } } }
        let mockRecordsResult = { records : { '2024-05-21' : { 'test.com' : { initDate : null, consecutiveTime : 0, totalTime : 0} } } }
        let mockSite = { sites : [ { name : 'test.com', group: 'Test', restrictions : null } ] }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.storage.local.get.mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        expect(global.chrome.storage.local.set).toHaveBeenCalledOnce()
        expect(global.chrome.storage.local.set).toBeCalledWith(mockRecordsResult)
    })

    it('should delete anything related to a site deleted consecutiveTime restriction', async () => {
        let newGroup = [ { name: 'test.com', restrictions : null } ]
        let oldGroup = [ { name: 'test.com', restrictions : {'consecutiveTime' : [{'days' : ['Tuesday'], 'time': 60, 'pause' : 60 } ] } } ]
        let changes = 
            { sites : 
                {
                    newValue : newGroup,
                    oldValue : oldGroup
                }
            }
        let mockRecords = { records : { '2024-05-21' : { 'test.com' : { consecutiveTime : 60, totalTime : 0} } } }
        let mockRecordsResult = { records : { '2024-05-21' : { 'test.com' : { totalTime : 60} } } }
        let mockSite = { sites : [ { name : 'test.com', group: 'Test', restrictions : null } ] }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.storage.local.get.mockResolvedValueOnce(mockSite)
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        
        expect(global.chrome.storage.local.set).toHaveBeenCalledOnce()
        expect(global.chrome.storage.local.set).toBeCalledWith(mockRecordsResult) 
    })

    it('should not set a consecutiveTime alarm end on first arrival on site', async () => {
    })
})


// describe('handleOnAlarm', () => {
//     beforeEach(() => {
//         // Reset mocks before each test
//         global.chrome.storage.local.get.mockReset()
//         global.chrome.storage.local.set.mockReset()
//         global.chrome.alarms.create.mockReset()
//         global.chrome.alarms.getAll.mockReset()
//         vi.useFakeTimers()
//         vi.setSystemTime(new Date(2024,4,21,10,0,0))
//       })
      
//     afterEach(() => {
//         vi.useRealTimers()
//     })



//     // a tester : 
//     //  - si nom d'alarme commence par groupe, est-ce que tous les domaines du groupe sont restreints ?
//     //  - est-ce que toutes les propriétés consecutiveTime des domaines du groupe dans records sont remises à 0 au end et au check ?
// })