import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest'
import * as bookkeeping from '../../worker/bookkeeping.js'
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

describe('interactions between close and focuss', () => {
    beforeEach(() => {
        global.chrome.tabs.query.mockReset();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 4, 21, 9, 58, 0));
      });
    
      afterEach(() => {
        vi.useRealTimers();
      });
    
      it('handles closing a tab and changing focus correctly', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;

        const todayRecord = { [currDate] :
            {
          "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
          "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        const expectedAfterClose = { [currDate] : 
            {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        const expectedAfterFocusChange = { [currDate] : 
            {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
                "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0 },
            }
        };
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records : todayRecord})
        await bookkeeping.bookkeeping('close', 1);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterClose});
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records: expectedAfterClose })
        await bookkeeping.bookkeeping('change-focus', 2, 'test2.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterFocusChange});
      });

        
      it('handles closing a tab with media playing and changing focus correctly', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;

        const todayRecord = { [currDate] :
            {
          "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
          "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        const expectedAfterClose = { [currDate] : 
            {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        const expectedAfterFocusChange = { [currDate] : 
            {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
                "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0 },
            }
        };
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records : todayRecord})
        await bookkeeping.bookkeeping('close', 1);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterClose});
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records: expectedAfterClose })
        await bookkeeping.bookkeeping('change-focus', 2, 'test2.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterFocusChange});
      });

      it('handles closing a tab and losing focus correctly', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;

        const todayRecord = { [currDate] :
            {
          "test.com": { audible: false, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
          "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        const expectedAfterClose = { [currDate] : 
            {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        const expectedAfterNoFocusChange = { [currDate] : 
            {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
                "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records : todayRecord})
        await bookkeeping.bookkeeping('close', 1);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterClose});
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records: expectedAfterClose })
        await bookkeeping.bookkeeping('no-focus');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterNoFocusChange});
      });

    it('handles closing a tab with media playing and losing focus correctly', async () => {
    let currDate = new Date().toISOString().split('T')[0] ;

    const todayRecord = { [currDate] :
        {
        "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
        }
    };

    vi.setSystemTime(new Date(2024,4,21,10,0,0))
    const expectedAfterClose = { [currDate] : 
        {
        "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
        "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
        }
    };

    const expectedAfterNoFocusChange = { [currDate] : 
        {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
        }
    };

    global.chrome.storage.local.get.mockResolvedValueOnce({records : todayRecord})
    await bookkeeping.bookkeeping('close', 1);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterClose});

    global.chrome.storage.local.get.mockResolvedValueOnce({records: expectedAfterClose })
    await bookkeeping.bookkeeping('no-focus');
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterNoFocusChange});
    });

    it('handles closing a tab and losing focus correctly with initDate null', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;

        const todayRecord = { [currDate] :
            {
          "test.com": { audible: true, focused: false, initDate: null, tabId: [1], totalTime: 0 },
          "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        const expectedAfterClose = { [currDate] : 
            {
            "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
            "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        const expectedAfterFocusChange = { [currDate] : 
            {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0 },
                "test2.com": { audible: false, focused: true, initDate: Date.now(), tabId: [2], totalTime: 0 },
            }
        };
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records : todayRecord})
        await bookkeeping.bookkeeping('close', 1);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterClose});
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records: expectedAfterClose })
        await bookkeeping.bookkeeping('change-focus', 2, 'test2.com');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterFocusChange});
      });

      it('handles no-focus first then closing a tab correctly (redirecting after alarm)', async () => {
        let currDate = new Date().toISOString().split('T')[0] ;

        const todayRecord = { [currDate] :
            {
          "test.com": { audible: true, focused: false, initDate: Date.now(), tabId: [1], totalTime: 0 },
          "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        vi.setSystemTime(new Date(2024,4,21,10,0,0))
        const expectedAfterNoFocusChange = { [currDate] : 
            {
                "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 120 },
                "test2.com": { audible: false, focused: false, initDate: null, tabId: [2], totalTime: 0 },
            }
        };
    
        global.chrome.storage.local.get.mockResolvedValueOnce({records: todayRecord })
        await bookkeeping.bookkeeping('no-focus');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterNoFocusChange});

        global.chrome.storage.local.get.mockResolvedValueOnce({records : expectedAfterNoFocusChange})
        await bookkeeping.bookkeeping('close', 1);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({records : expectedAfterNoFocusChange});
      });
})