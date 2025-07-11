import { describe, it, expect } from "vitest";
import { AlarmManager } from "../worker/alarmManager";

describe('alarmManager', () => {
    it('should set a consecutive time if there is none for entity', async () => {
        const mockManager = new AlarmManager([]);
        mockManager.setAlarm = vi.fn()
        await mockManager.handleRestrictionAlarm({
          host: "test",
          vs: {
            violated: false,
            minutesBeforeRes: 1,
            entity: "test",
            restriction: "consecutiveTime",
          },
        });
        expect(mockManager.setAlarm).toHaveBeenCalledOnce()
        expect(mockManager.setAlarm).toHaveBeenCalledWith('test-consecutive-time-restriction-begin', {delayInMinutes : 1})
    })

    it('should delete a consecutive time if there is one for entity', async () => {
        const mockManager = new AlarmManager([{name : 'test-consecutive-time-restriction-begin'}]);
        mockManager.deleteAlarm = vi.fn()
        mockManager.setAlarm = vi.fn()
        await mockManager.handleRestrictionAlarm({
          host: "test",
          vs: {
            violated: false,
            minutesBeforeRes: 1,
            entity: "test",
            restriction: "consecutiveTime",
          },
        });
        expect(mockManager.deleteAlarm).toHaveBeenCalledOnce()
    }) 
    it('should delete all consecutive time if there are multiple for entity', async () => {
        const mockManager = new AlarmManager([{name : 'test-consecutive-time-restriction-begin'}, {name : 'test-consecutive-time-restriction-check'}]);
        mockManager.deleteAlarm = vi.fn()
        mockManager.setAlarm = vi.fn()
        await mockManager.handleRestrictionAlarm({
          host: "test",
          vs: {
            violated: false,
            minutesBeforeRes: 1,
            entity: "test",
            restriction: "consecutiveTime",
          },
        });
        expect(mockManager.deleteAlarm).toHaveBeenCalledTimes(2)
        expect(mockManager.setAlarm).toHaveBeenCalledWith('test-consecutive-time-restriction-begin', {delayInMinutes : 1})
    }) 
});