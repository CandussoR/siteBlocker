import { logger } from "./logger.js";
import { RecordManager, rm } from "./recordManager.js";

export async function bookkeeping(flag, tabId = undefined, host = undefined) {
  try {
  // logger.debug("In bookkeeping I have received", flag, tabId, host);
    const bookkeeper = new Bookkeeper(rm, tabId, host)
    logger.info("Entering bookkeeping with", JSON.parse(JSON.stringify(rm.todayRecord)));
    switch (flag) {
      case "audible-start":
        bookkeeper.handleAudibleStart();
        break;
      case "audible-end":
        bookkeeper.handleAudibleEnd();
        break;
      case "open":
        await bookkeeper.handleOpen()
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

  logger.debug("todayRecord, after the switch case", JSON.parse(JSON.stringify(rm.todayRecord)));
  await rm.save()
  } catch (error) {
  logger.error('Error in bookkeeping, avorting any change : ', error);
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
    // logger.debug("Handling open with site", this.todayRecord, this.tabId)
    // logger.info("handleOpen : todayRecord", this.todayRecord);
    // Deleting tab from last domain if it has changed
    const tabSite = this.rm.getSiteOfTab(this.tabId);
    if (tabSite && tabSite !== this.host) {
      await this.handleClose();
    }

    // Ascribing tab to domain
    this.rm.addTabToSite(this.host, this.tabId);

    // Handling focus and initDate
    let focused = await chrome.tabs.query({ active: true });
    if (focused && focused[0] && new URL(focused[0].url).host === this.host) {
      this.rm.addFocusToSite(this.host);
    }
  }

  /**
   *
   * Called on close or for redirection
   * @returns {object} this.rm.todayRecord[host]
   */
  async handleClose() {
    let siteRecord = this.rm.getTodaySiteRecord(
      this.rm.getSiteOfTab(this.tabId)
    );

    if (!siteRecord.tabId) {
      logger.error(
        "Trying to close a tab that has not been added",
        this.host,
        this.tabId,
        siteRecord
      );
    } else if (siteRecord.tabId.length > 1) {
      // if multiple Spotify tabs and one is closed while we listen, for example
      if (siteRecord.audible && (await this.shouldToggleAudible(site))) {
        siteRecord.audible = false;
      }
      let tabIndex = siteRecord.tabId.findIndex((x) => x === this.tabId);
      siteRecord.tabId.splice(tabIndex, 1);
    } else {
      siteRecord.tabId = null;
      siteRecord.focused = false;
      siteRecord.audible = false;
    }

    // If the site is still audible, we are still using it.
    if (siteRecord.audible) return;

    if (!siteRecord.initDate) {
      logger.error(
        "No init date has been previously set, or initDate has been nullified already." +
          "No need to (or cannot) compute either consecutiveTime or totalTime",
        this.host,
        this.siteRecord
      );
      return;
    }

    if (!siteRecord.initDate && "consecutiveTime" in siteRecord) {
      console.error(
        "Cannot manage consecutiveTime since there is no initDate!"
      );
      logger.error(
        `[Bookkeeper][${this.host}] Missing initDate for consecutiveTime`
      );
      throw new Error(
        "Cannot manage consecutiveTime since there is no initDate!",
        this.host
      );
    }

    // Only alarm handler resets consecutiveTime on -check alarms, just set
    // If reseted by begin alarm, already reseted, no initDate,
    // close called by redirection.
    this.rm.setConsecutiveTime(this.host);

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
      siteRecord.totalTime += Math.round( (Date.now() - siteRecord.initDate) / 1000);
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
