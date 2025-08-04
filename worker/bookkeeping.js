import { logger } from "./logger.js";
import { RecordManager, rm } from "./recordManager.js";
import { AlarmManager } from "./alarmManager.js";

export async function bookkeeping(flag, tabId = undefined, host = undefined) {
    try {
        const bookkeeper = new Bookkeeper(rm, tabId, host);
        logger.info(
            "Entering bookkeeping with",
            JSON.parse(JSON.stringify(rm.todayRecord))
        );
        switch (flag) {
            case "audible-start":
                bookkeeper.handleAudibleStart();
                break;
            case "audible-end":
                bookkeeper.handleAudibleEnd();
                break;
            case "open":
                await bookkeeper.handleOpen();
                break;
            case "close":
                await bookkeeper.handleClose();
                break;
            case "no-focus":
                await bookkeeper.handleNoFocus();
                break;
            case "change-focus":
                await bookkeeper.handleChangeFocus();
                break;
            default:
                logger.error("There's a typo in flag", flag);
        }

        logger.debug(
            "todayRecord, after the switch case",
            JSON.parse(JSON.stringify(rm.todayRecord))
        );
        await rm.save();
    } catch (error) {
        if (error instanceof Error) {
            logger.error(
                "Error in bookkeeping, aborting any change: ",
                error.message
            );
            logger.debug("Stack trace:", error.stack);
        } else {
            logger.error("Error in bookkeeping, aborting any change: ", error);
        }
    }
}

/**
 * Bookkeeper class that's used to mutate the records through the use of the RecordManager.
 * Should also be used in alarms handlers since they bookkeep stuff,
 * but I'm only doing minimum refactor and won't use it for now.
 */
export class Bookkeeper {
    /**
     *
     * @param {RecordManager} rm
     * @param {Number} tabId
     * @param {string} host
     */
    constructor(rm, tabId, host) {
        this.tabId = tabId;
        this.host = host;
        this.rm = rm;
    }

    async handleOpen() {
        // Deleting tab from last domain if it has changed
        const tabSite = this.rm.getSiteOfTab(this.tabId);
        if (tabSite && tabSite !== this.host) {
            await this.handleClose(tabSite);
        }

        this.rm.addTabToSite(this.host, this.tabId);

        // Handling focus and initDate
        let focused = await chrome.tabs.query({ active: true });
        if (
            focused &&
            focused[0] &&
            new URL(focused[0].url).host === this.host
        ) {
            this.rm.addFocusToSite(this.host);
        }
    }

    /**
     *
     * Called on close or for redirection.
     * Only handleOpen should call the function with a host parameter.
     * @param {String|undefined} host -- a different host than this.host, used to switch tab from one site to another
     * @param {AlarmManager} am -- only passed to make dependency explicit and to ease testing, used when resetting consecutive time
     */
    async handleClose(host = undefined, am = new AlarmManager()) {
        // only handleOpen gives a host different than this.host, but keeps this.tabId
        // otherwise, we ALWAYS have this.tabId
        logger.debug("Entering handleClose", this.tabId, host, this.host);
        let h = host && host !== this.host
                ? host
                : this.rm.getSiteOfTab(this.tabId);

        if (!h) {
            h = this.host;
        }

        let siteRecord = this.rm.getTodaySiteRecord(h);

        if (!siteRecord) {
            // Close shouldn't have been called if no tabId in records AND host not monitored.
            logger.warning(
                "No siteRecord for this tabId",
                this.tabId,
                this.rm.todayRecord
            );
            return;
        }

        if (!siteRecord.tabId) {
            throw new Error(
                "Trying to close a tab that has not been added." +
                    ` host=${this.host}, tabId=${this.tabId},` +
                    ` siteRecord=${JSON.stringify(siteRecord)}`
            );
        }

        try {
            logger.info("handleCLose siteRecord is", siteRecord);
            if (
                siteRecord.tabId instanceof Array &&
                siteRecord.tabId.length > 1
            ) {
                // if multiple Spotify tabs and one is closed while we listen, for example
                if (siteRecord.audible && (await this.shouldToggleAudible(h))) {
                    siteRecord.audible = false;
                }
                logger.info("Filtering tabId", siteRecord, siteRecord.tabId);
                let filt = siteRecord.tabId.filter((x) => x !== this.tabId);
                siteRecord.tabId = filt.length ? filt : null;
            } else {
                if (siteRecord.tabId[0] === this.tabId) {
                    siteRecord.tabId = null;
                }
                siteRecord.focused = false;
                siteRecord.audible = false;
            }
        } catch (e) {
            throw new Error(
                `Problem when handling the reset of siteRecord in close : ${e}`
            );
        }

        // If the site is still audible, we are still using it.
        if (siteRecord.audible) return;

        if (!siteRecord.initDate) {
            logger.warning(
                `[Bookkeeper][${this.host}] Missing initDate : `,
                this.host,
                this.siteRecord
            );

            // Breaking the responsibility thing but feels clearer
            let endAlarms = await am.hasEndAlarm(h);
            if (!endAlarms.length && siteRecord.consecutiveTime) {
                logger.debug("No -end alarms and consecutiveTime, we reset it");
                siteRecord.consecutiveTime = 0;
            }

            return;
        }

        // Only alarm handler resets consecutiveTime on -check or -end alarms,
        // here we just set the consecutive time for the violation check.
        // If reset by begin alarm, no initDate, and handleClose is called by the redirection.
        if ("consecutiveTime" in siteRecord) {
            this.rm.setConsecutiveTime(h);
        }

        siteRecord.totalTime += Math.round(
            (Date.now() - siteRecord.initDate) / 1000
        );

        siteRecord.initDate = null;
    }

    async shouldToggleAudible(site) {
        let audibleTabs = await chrome.tabs.query({ audible: true });
        if (
            audibleTabs.length > 0 &&
            audibleTabs.map((x) => new URL(x.url).host).includes(site)
        ) {
            return false;
        }
        return true;
    }

    handleAudibleStart() {
        this.rm.todayRecord[this.host].audible = true;
        if (!this.rm.todayRecord[this.host].initDate)
            this.rm.todayRecord[this.host].initDate = Date.now();
    }

    handleAudibleEnd() {
        let siteRecord = this.rm.getTodaySiteRecord(this.host);
        siteRecord.audible = false;

        if (!siteRecord.initDate) {
            logger.error(
                "SiteRecord has no initDate when handleAudibleEnd ! Should never happen !",
                this.host,
                JSON.parse(JSON.stringify(siteRecord))
            );
            throw new Error(
                `SiteRecord has no initDate when handleAudibleEnd ! Should never happen ! ${this.host}, ${siteRecord}`
            );
        }

        if (siteRecord.focused) return;

        if ("consecutiveTime" in siteRecord) {
            this.rm.setConsecutiveTime(this.host);
        } else {
            siteRecord.totalTime += Math.round(
                (Date.now() - siteRecord.initDate) / 1000
            );
        }

        siteRecord.initDate = null;
    }

    async handleNoFocus() {
        // logger.debug("Handling no-focus")
        for (let site in this.rm.todayRecord) {
            let siteRecord = this.rm.getTodaySiteRecord(site);
            siteRecord.focused = false;

            if (siteRecord.audible) {
                continue;
            }

            if (siteRecord.initDate && !("consecutiveTime" in siteRecord)) {
                siteRecord.totalTime += Math.round(
                    (Date.now() - siteRecord.initDate) / 1000
                );
            }

            if ("consecutiveTime" in siteRecord) {
                siteRecord = this.rm.setConsecutiveTime(site);
            }

            // logger.warning("setting initDate to null", todayRecord[site], console.trace())
            siteRecord.initDate = null;
        }
    }

    async handleChangeFocus() {
        let oldFocus = this.rm.getSiteFocused();

        let siteRecord = this.rm.getTodaySiteRecord(siteOfTab);
        siteRecord.focused = true;
        if (!siteRecord.initDate) siteRecord.initDate = Date.now();

        // Reusing siteRecord to bookkeep the old focused site
        siteRecord = this.rm.getTodaySiteRecord(oldFocus);
        siteRecord.focused = false;
        if ("consecutiveTime" in siteRecord) {
            this.rm.setConsecutiveTime(oldFocus);
        }
        siteRecord.totalTime += Math.round(
            (Date.now() - siteRecord.initDate) / 1000
        );
        // logger.warning("setting initDate to null", s, console.trace())
        siteRecord.initDate = null;
    }
}
