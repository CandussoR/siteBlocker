export class TabManager {
  async getAll() {
    return await chrome.tabs.query({});
  }

  /**
   * @param {Site[]|string[]} sitesToBeRedirected - array containing all the Site objects of a group or the host name
   * @param {*} tabs
   * @param {null} endOfRestriction - do not fill, will soon be deleted when handling alarms end better
   */
  async redirectTabsRestrictedByAlarm(
    sitesToBeRedirected,
    tabs,
    endOfRestriction = null
  ) {
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const url = encodeURIComponent(tab.url);
      const host = encodeURIComponent(new URL(tab.url).host);

      if (!sitesToBeRedirected.includes(host)) {
        continue;
      }

      await chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL(
          `ui/redirected/redirected.html?url=${url}&host=${host}${
            endOfRestriction ? "&eor=" + endOfRestriction : ""
          }`
        ),
      });
    }
  }
}
