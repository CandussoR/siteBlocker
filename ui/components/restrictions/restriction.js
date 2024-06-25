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
        let html = ``
        let keys = Object.keys(this.restrictions) || []
        if (keys.length === 0) return '<p>No restriction yet, click on the update icon to add one.</p>';

        if (keys.includes('timeSlot')) {
            html += `
        <div id='time-slot-container' class="time-slot-container">
            <h3>Time Slots</h3>
                ${this.restrictions.timeSlot.map((element, index) => `
                    <ul id="slot-${index}">
                        <li id="days-${index}">
                            <div>
                                On ${element["days"].join(', ')} :
                                <ul id="time-list-${index}">
                                    ${element["time"].map((t, i) => `
                                        <li id="time-slot-${i}">from ${t[0]} to ${t[1]}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        </li>

                    </ul>`).join('')}
        </div>
        `
        }

        if (keys.includes('totalTime')) {
            html += `<div id="total-time-container">
                        <h3>Total Time</h3>
                        <ul id="total-time-list">
                      ${this.restrictions.totalTime
                          .map((el, index) =>
                            `<li id="total-time-${index}">${el.totalTime / 60} minutes on ${el.days.join('')}.</li>`
                      ).join('')}
                        </ul>
                     </div>`
          }
    
          if (keys.includes('consecutiveTime')) {
            html += `<div id="consecutive-time-container">
            <h3>Consecutive Time</h3>
            ${this.restrictions.consecutiveTime
              .map(
                (el, index) =>
                  `<ul id='consecutive-time-${index}-days'>
                    <li>
                      <div>
                        On ${el.days.join(", ")} :
                        <ul id='time-pause-${index}'>
                            <li>${ el.consecutiveTime / 60} consecutive minutes straight max, </li> 
                            <li>${ el.pause / 60} minutes pause between.</li>
                        </ul>
                      </div>
                    </li>
                </ul>`)
              .join("")}
           </div>`;
          }

        html += '</div>'
        return html
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