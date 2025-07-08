import { beforeEach, describe } from "vitest";
import { TimeSlotRestriction } from "../worker/restrictions";
import { EntitiesCache, Group, Site } from "../worker/siteAndGroupModels";

describe('TimeSlotRestriction', () => {
    beforeEach(() => {
        vi.setSystemTime(new Date(2025,6,7,10,0,0))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns violated if between to slots', () => {
        const site = new Site({name: "test.com", restrictions: {timeSlot:[{ "days" : ["Monday"], "time" : [["09:00", "11:00"]]}]}})
        const em = new EntitiesCache()
        em.sites = [site]
        const rest = new TimeSlotRestriction(site, em)
        const res = rest.isViolated();
        expect(res.violated).toBe(true);
    })
    it('returns right minuteBeforeRes when between two slots', () => {
        const site = new Site({name: "test.com", restrictions: {timeSlot:[{ "days" : ["Monday"], "time" : [["09:00", "11:00"]]}]}})
        const em = new EntitiesCache()
        em.sites = [site]
        const rest = new TimeSlotRestriction(site, em)        
        const res = rest.isViolated();
        expect(res.minutesBeforeRes).toBe(60);
    })
    it('returns right minutesBeforeRes when multiple slots in one rest', () => {
        const siterest = [{ "days" : ["Monday"], "time" : [["09:00", "11:00"], ["12:00", "14:00"]]}]
        const site = new Site({name: "test.com", restrictions: {timeSlot: siterest}})
        const em = new EntitiesCache()
        em.sites = [site]
        const rest = new TimeSlotRestriction(site, em)
        const res = rest.isViolated();
        expect(res.minutesBeforeRes).toBe(60);
    });
    it('returns not violated if no more slots for the day', () => {
        const site = new Site({name: "test.com", restrictions: {timeSlot: [{"days": ["Monday"], "time": [["08:00", "09:00"]]}]}})
        const em = new EntitiesCache()
        em.sites = [site]
        const rest = new TimeSlotRestriction(site, em)       
        const res = rest.isViolated();
        expect(res.violated).toBe(false);
        expect(res.minutesBeforeRes).toBe(undefined);
    });
    it('return right minutesBeforeRes if end time is midnight', () => {
        vi.setSystemTime(new Date(2025,6,7,23,0,0))
        const site = new Site({name: "test.com", restrictions: {timeSlot: [{ "days" : ["Monday"], "time" : [["09:00", "00:00"]]}]}})
        const em = new EntitiesCache()
        em.sites = [site]
        const rest = new TimeSlotRestriction(site, em)  
        const res = rest.isViolated();
        expect(res.minutesBeforeRes).toBe(60);
    });
    it('return group violation if site has no violation and group has', () => {
        const site = new Site({name: "test.com", group: "Test"})
        const group = new Group({name: "Test", restrictions: {timeSlot: [{ "days" : ["Monday"], "time" : [["09:00", "11:00"]]}]}}, [site])
        const em = new EntitiesCache()
        em.sites = [site]
        em.groups = [group]
        const rest = new TimeSlotRestriction(site, em)         
        const res = rest.isViolated();
        expect(res.violated).toBe(true);
        expect(res.minutesBeforeRes).toBe(60)
    })
    it('return site violation if site has closer violation than group', () => {
        const site = new Site({name: "test.com", group: "Test", restrictions: {timeSlot: [{ "days" : ["Monday"], "time" : [["09:00", "10:30"]]}]}})
        const group = new Group({name: "Test", restrictions: {timeSlot: [{ "days" : ["Monday"], "time" : [["09:00", "11:00"]]}]}}, [site])
        const em = new EntitiesCache()
        em.sites = [site]
        em.groups = [group]
        const rest = new TimeSlotRestriction(site, em)         
        const res = rest.isViolated();
        expect(res.violated).toBe(true);
        expect(res.minutesBeforeRes).toBe(30)
    })
})