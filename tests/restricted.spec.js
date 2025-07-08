import { describe } from "vitest";
import { isRestrictedNew } from "../worker/restrictionsHandler";
import { Site, Group, EntitiesCache } from "../worker/siteAndGroupModels";
import { RecordManager } from "../worker/recordManager";

describe('isRestricted', () => {
    beforeEach(() => {
        vi.setSystemTime(new Date(2025,6,7,10,0,0))
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns not violated if not violated', () => {
        const site = new Site({name: "test.com"})
        const em = new EntitiesCache();
        em.sites = [site]
        const rm = new RecordManager({"2025-07-07" : {"test.com" : {totalTime:1000}}});
        const ret = isRestrictedNew("test.com", em, rm)
        expect(ret.isViolated).toBe(false);
    });

    it('returns violated if violated', () => {
    });
    
    it('returns the closest violation if not violated', () => {
    });
})