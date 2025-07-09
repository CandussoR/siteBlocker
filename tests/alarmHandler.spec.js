import { afterEach, beforeEach, expect, vi } from 'vitest';
import { TimeSlotAlarmHandler } from '../worker/alarmsHandler.js';
import { EntitiesCache, Site } from '../worker/siteAndGroupModels.js';

console.log(process.env.NODE_ENV === 'test')
describe('alarms setup', () => {
    beforeEach(() => {
        vi.setSystemTime(new Date(2025,6,9,10,0,0))
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('should set timeSlot alarms for site entities', async () => {
    const site = new Site({
      name: 'test.com',
      restrictions: {
        timeSlot: [{ days: ['Wednesday'], time: [['09:00', '11:00']] }],
      },
    });

    const entitiesCache = new EntitiesCache();
    entitiesCache.sites = [site];

    const mockManager = {
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    };

    const tsah = new TimeSlotAlarmHandler(null, null, entitiesCache, mockManager);
    await tsah.initializeEveryAlarm();

    expect(mockManager.setAlarm).toHaveBeenCalledTimes(1)
    expect(mockManager.setAlarm).toHaveBeenCalledWith("test.com-time-slot-restriction-end", {delayInMinutes : 60});
  });
})