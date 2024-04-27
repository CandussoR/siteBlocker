class SlotTimeRestrictionEditor extends HTMLElement {
    constructor(rules) {
        super()
     }

    connectedCallback() {
        console.log("editor", this.rules)
        this.innerHTML = this.buildHTML()
    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'rules') this.innerHTML = this.buildHTML(newValue)
    }

    get rules() {
        let rules = this.getAttribute('rules')
        return JSON.parse(rules)
    }

    set rules(r) {
        this.setAttribute('rules', r)
    }

    buildHTML() {
        return `
        <div id='time-slot-container'>
            <h3>Time Slots</h3>
                <div id="time-slot-editor__cta">
                    <span id="done" class="material-symbols-outlined"> done </span>
                    <span id="cacel" class="material-symbols-outlined"> cancel </span>
                </div>
            ${this.rules.map((element, index) => `
                <div class="card">
                    <div class="day-column">
                        <h4>Day ${index + 1}</h4>
                        <ul>
                            ${element.days.map(day => `
                                <li>${day} <span id="remove-day" class='material-symbols-outlined'>remove</span></li>
                            `).join('')}
                            <li><span id="add-day" class="material-symbols-outlined"> add </span></li>
                        </ul>
                    </div>
                    <div class="time-column">
                        <h4>Restricted Slots</h4>
                        <ul>
                            ${element.time.map(time => `
                                <li>
                                    <input type="time" value="${time[0]}"> - <input type="time" value="${time[1]}">
                                    <span id="remove-day" class='material-symbols-outlined'>remove</span>
                                </li>
                            `).join('')}
                            <li><span id="add-time" class="material-symbols-outlined"> add </span></li>
                        </ul>
                    </div>
                </div>
            `).join('')}
        </div>
        `;
    }

        handleSave() {
            console.log("save")
    }
}

customElements.define('slot-time-restriction-editor', SlotTimeRestrictionEditor);

export default SlotTimeRestrictionEditor;