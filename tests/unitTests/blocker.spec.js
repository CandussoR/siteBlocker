import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { bookkeeping } from '../../bookkeeping.js'
import { fakeRecord } from './fakeData.js'

global.chrome = {
    storage : {
        local : {
            get : vi.fn().mockResolvedValue({records : fakeRecord}),
            set : vi.fn()
        }
    }
}


describe('bookkeeping', () => {
    beforeEach(() => {
      // Reset mocks before each test
      global.chrome.storage.local.get.mockReset()
      global.chrome.storage.local.set.mockReset()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })
    
    afterEach(() => {
        vi.useRealTimers()
    })
    
    it('updates data on tab open', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecord})
        await bookkeeping('open', 100000000, 'test.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: {
                "2024-05-21": {
                  "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: 100000000, totalTime: 0, },
                  "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                }
            },
          })
    })

    it('updates data on tab close', async () => {
      global.chrome.storage.local.get.mockResolvedValueOnce({
        records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: 100000000, totalTime: 0, }, }, },
      });
      vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
      await bookkeeping("close", 100000000);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, }, }, },
      });
    })

    it('updates when audible is true', async() => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
          records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, }, },
        }); 
        vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
        await bookkeeping("audible-start", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, }, },
          }); 
    })

    it('will update totalTime if not focused on audible-end', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: 100000000, totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
        await bookkeeping("audible-end", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: 100000000, totalTime: 120, }, }, },
        });
      })

    it('will not update totalTime nor reinitialise initDate when focused on audible-end', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: Date.now(), tabId: 100000000, totalTime: 0, }, }, },
          });
        await bookkeeping("audible-end", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: 100000000, totalTime: 0, }, }, },
        });
    })

    it('will update total time when focus lost and no media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('no-focus')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: 100000000, totalTime: 120, }, }, },
          }); 
    })

    it('will not update total time nor reinitialise initDate when focus lost and media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('no-focus')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: true, focused: false, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, }, },
          }); 
    })

    it('will update total time when focus change and no media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: 100000000, totalTime: 0, }, 
                                       "test2.com": { audible: false, focused: false, initDate: null, tabId: 100000001, totalTime: 0, },
                                    }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('change-focus', 100000001, 'test2.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: 100000000, totalTime: 120, }, 
                                       "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: 100000001, totalTime: 0, },
                                    }, },
          });  
    })
})