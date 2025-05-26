import SlotTimeRestrictionEditor from './restrictionEditor.js'

class SlotTimeRestriction extends HTMLElement {
    constructor() {
        super()
        this.handleEdit = this.handleEdit.bind(this)
     }

    connectedCallback() {
        console.log('type is' , this.itemType)
      this.innerHTML = this.buildHTML();

      const removeSlotButton = document.querySelectorAll( "span[id^='remove-slot-']");

      removeSlotButton.forEach((button) => {
        button.addEventListener("click", (e) => this.removeSlotCard(e));
      });
    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'restrictions') this.innerHTML = this.buildHTML()
    }

    get restrictions() {
        let restrictions = this.getAttribute('restrictions')
        return JSON.parse(restrictions)
    }

    set restrictions(r) {
        this.setAttribute('restrictions', r)
    }

    get itemType() { return this.getAttribute('item-type') }
    set itemType(t) { this.setAttribute('item-type', t) }

    buildHTML() {
        let html = ``;
        let keys = Object.keys(this.restrictions) || [];
        if (keys.length === 0)
          return "<p>No restriction yet, click on the update icon to add one.</p>";

        if (keys.includes("timeSlot")) {
          html += `
        <div id='time-slot-container'">
            <h3 class="font-mono font-semibold uppercase p-2 m-1">Time Slots</h3>
            <div class="flex flex-col w-full items-center justify-center mb-2">
            <table class="w-3/4">
              <thead>
                <col>
                <colgroup span="2"></colgroup>
              <tr class="border">
                <th rowspan="2">Days</th>
                <th colspan="2" scope="colgroup">Restricted Slots</th>
              </tr>
              <tr>
                      <th scope="col">Begin</th>
                      <th scope="col">End</th>
              </tr>
              </thead>
              <tbody>
            ${this.restrictions.timeSlot
              .map(
                (element, index) => `
              <tr>
                <td rowspan="${element["time"].length}">${element["days"].join(
                  ", "
                )}</td>
                ${element["time"]
                  .map(
                    (t, i) => ` ${i != 0 ? `<tr>` : ""}
                    <td scope="col">${t[0]}</td>
                    <td scope="col">${t[1]}</td>
              </tr>`
                  )
                  .join("")}
              `
              )
              .join("")}
              </tbody>
            </table>
            </div>
          </div>`;
        }

        if (keys.includes("totalTime")) {
          html += `<div id="total-time-container">
                        <h3 class="class="font-mono font-semibold uppercase p-2 m-1">Total Time</h3>
                        <div class="flex flex-col w-full items-center justify-center mb-2">
                          <table class="w-3/4">
                            <thead>
                              <th>Days</th>
                              <th>Max time (minutes)</th>
                            </thead>
                            <tbody>
                              ${this.restrictions.totalTime.map( (el, index) =>
                                    `<tr>
                                      <td>${el.days.join(", ")}</td>
                                      <td>${ el.totalTime / 60 }</td>
                                    </tr>`
                                ) .join("")}
                            </tbody>
                          </table>
                        </div>
                     </div>`;
        }

        if (keys.includes("consecutiveTime")) {
          html += `<div id="consecutive-time-container">
            <h3 class="font-mono font-semibold uppercase p-2 m-1">Consecutive Time</h3>
              <div class="flex flex-col w-full items-center justify-center mb-2">
                <table class="w-3/4">
                  <thead>
                    <th>Days</th>
                    <th>Max consecutive Time (minutes)</th>
                    <th>Pause (minutes)</th>
                  </thead>
                  <tbody>
                    ${this.restrictions.consecutiveTime
                      .map(
                        (el, index) =>
                          `<tr>
                            <td>${el.days.join(", ")}</td>
                            <td>${el.consecutiveTime / 60}</td>
                            <td>${el.pause / 60}</td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
           </div>`;
        }
        html += "</div>";
        return html;
    }

    handleEdit() {
        const editor = document.createElement('restriction-editor');
        editor.setAttribute('restrictions', JSON.stringify(this.restrictions));
        this.parentNode.replaceChild(editor, this);  
    }

    async removeSlotCard(e) {
        let ul = e.target.closest('ul')
        let id = ul.id.split('-').pop()
        if (this.itemType === 'group') {
            let groupIndex = this.closest('a-group').index
            let { groups } = await chrome.storage.local.get('groups')
            groups[groupIndex].restrictions.timeSlot.splice(id,1)
            await chrome.storage.local.set({groups : groups})
        } else if (this.itemType === 'site') {
            let siteIndex = this.closest('a-site').index
            let { sites } = await chrome.storage.local.get('sites')
            console.log(sites, sites[siteIndex])
            sites[siteIndex].restrictions.timeSlot.splice(id,1)
            await chrome.storage.local.set({sites : sites}) 
        }
        ul.remove()
      }
}

customElements.define('restriction-item', SlotTimeRestriction)
export default SlotTimeRestriction;