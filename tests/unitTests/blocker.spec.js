import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import { bookkeeping } from '../../worker/bookkeeping.js'
import { fakeRecord } from './fakeData.js'

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


describe('bookkeeping', () => {
    beforeEach(() => {
      // Reset mocks before each test
      global.chrome.storage.local.get.mockReset()
      global.chrome.storage.local.set.mockReset()
      global.chrome.tabs.query.mockReset()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024,4,21,10,0,0))
    })
    
    afterEach(() => {
        vi.useRealTimers()
    })
    
    it('updates tabId on tab open without focus', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecord})
        global.chrome.tabs.query.mockResolvedValueOnce([])
        await bookkeeping('open', 100000000, 'test.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: {
                "2024-05-21": {
                  "test.com": { audible: false, focused: false, initDate: null, tabId: [100000000], totalTime: 0, },
                  "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
                }
            },
          })
    })

    it('updates tabId focused and initDate on tab open with focus', async () => {
      global.chrome.storage.local.get.mockResolvedValueOnce({records : fakeRecord})
      global.chrome.tabs.query.mockResolvedValueOnce([{url : 'https://test.com', active : true}])
      await bookkeeping('open', 100000000, 'test.com')
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
          records: {
              "2024-05-21": {
                "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [100000000], totalTime: 0, },
                "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
              }
          },
        })
  })

    it('updates data on tab close', async () => {
      global.chrome.storage.local.get.mockResolvedValueOnce({
        records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [ 100000000 ], totalTime: 0, }, }, },
      });
      global.chrome.tabs.query.mockResolvedValueOnce([])
      vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
      await bookkeeping("close", 100000000);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120, }, }, },
      });
    })

    it('updates when audible is true', async() => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
          records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, }, },
        }); 
        vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
        await bookkeeping("audible-start", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, }, },
          }); 
    })

    it('will update totalTime if not focused on audible-end', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [100000000], totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024, 4, 21, 10, 2, 0));
        await bookkeeping("audible-end", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: [100000000], totalTime: 120, }, }, },
        });
      })

    it('will not update totalTime nor reinitialise initDate when focused on audible-end', async () => {
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: Date.now(), tabId: [100000000], totalTime: 0, }, }, },
          });
        await bookkeeping("audible-end", 100000000, 'test.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: Date.now(), tabId: [100000000], totalTime: 0, }, }, },
        });
    })

    it('will update total time when focus lost and no media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('no-focus')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: [100000000], totalTime: 120, }, }, },
          }); 
    })

    it('will not update total time nor reinitialise initDate when focus lost and media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: true, focused: true, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('no-focus')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: true, focused: false, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, }, },
          }); 
    })

    it('will update total time when focus change and no media is playing', async () => {
        let mockInitDate = Date.now()
        global.chrome.storage.local.get.mockResolvedValueOnce({
            records: { "2024-05-21": { "test.com": { audible: false, focused: true, initDate: mockInitDate, tabId: [100000000], totalTime: 0, }, 
                                       "test2.com": { audible: false, focused: false, initDate: null, tabId: [100000001], totalTime: 0, },
                                    }, },
          }); 
        vi.setSystemTime(new Date(2024,4,21,10,2,0))
        await bookkeeping('change-focus', 100000001, 'test2.com')
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
            records: { "2024-05-21": { "test.com": { audible: false, focused: false, initDate: null, tabId: [100000000], totalTime: 120, }, 
                                       "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [100000001], totalTime: 0, },
                                    }, },
          });  
    })
})