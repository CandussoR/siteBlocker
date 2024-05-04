import SlotTimeRestrictionEditor from './restrictionEditor.js'

class SlotTimeRestriction extends HTMLElement {
    constructor() {
        super()
        this.handleEdit = this.handleEdit.bind(this)
     }

    connectedCallback() {
        this.innerHTML = this.buildHTML()
        console.log("restrictions sent from a-site to restriction-item", JSON.stringify(this.restrictions))
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

    buildHTML() {
        let html = ``
        let keys = Object.keys(this.restrictions) || []
        if (keys.length === 0) return;

        if (keys.includes('timeSlot')) {
            html += `
        <div id='time-slot-container' class="time-slot-container">

            <h3>Time Slots</h3>
                ${this.restrictions.timeSlot.map((element, index) => `
                    <span id="add-slot">

                    <ul id="slot-${index}">
                        <li id="days-${index}">
                            <span id="remove-slot-${index}" class='material-symbols-outlined'>remove</span>
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
                      ${this.restrictions.totalTime
                          .map((el, index) =>
                            `<p id="total-time-${index}-days">On ${el.days.join('')} for ${el.totalTime} minutes.</p>`
                      ).join('')}
                     </div>`
          }
    
          if (keys.includes('consecutiveTime')) {
            html += `<div id="consecutive-time-container">
            ${this.restrictions.consecutiveTime
              .map(
                (el, index) =>
                  `<p id="total-time-${index}-days">On ${el.days.join("")}, ${ el.consecutiveTime } consecutive minutes max with ${ el.pause } minutes pause between.</p>`)
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
}

export default SlotTimeRestriction;