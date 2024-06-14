import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { createAlarms, handleStorageChange } from '../../worker/alarms/alarmsHandler'


global.chrome = {
    storage : {
        local : {
            get : vi.fn(),
            set : vi.fn()
        }
    },
    alarms: {
        create: vi.fn(),
        getAll : vi.fn(),
        clear: vi.fn()
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
        let mockRecords = { records : { '2024-05-21' : { name : 'test.com', totalTime : 0} } }
        global.chrome.storage.local.get.mockResolvedValueOnce(mockRecords)
        global.chrome.alarms.getAll.mockResolvedValueOnce([])

        await handleStorageChange(changes, 'local')
        expect(global.chrome.storage.local.set).toBeCalledTimes(0)
        expect(global.chrome.alarms.create).toHaveBeenCalledOnce()
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('test.com-time-slot-restriction-end', {delayInMinutes : 60})
    })
})