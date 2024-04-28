class SlotTimeRestrictionEditor extends HTMLElement {
    constructor(rules) {
        super()

        this.tempRules = null
     }

    connectedCallback() {
        this.tempRules = this.rules
        this.innerHTML = this.buildHTML()

        const addDayButtons = document.querySelectorAll("span[id^='add-day-']")
        addDayButtons.forEach(button => {
            button.addEventListener('click', (e) => this.addDayInput(e)); // Add event listener to each "add day" button
        });

        const removeDayButtons = document.querySelectorAll("span[id^='remove-day-']")
        removeDayButtons.forEach(button => {
             button.addEventListener('click', (e) => this.removeDay(e))
        })

        const saveButton = document.getElementById('done')
        saveButton.addEventListener('click', this.handleSave)
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
                    <span id="cancel" class="material-symbols-outlined"> cancel </span>
                </div>
            ${this.rules.map((element, index) => `
                <div class="card">
                    <div id="card-${index}-days" class="day-column">
                        <h4>Day ${index + 1}</h4>
                        <ul id="day-list-${index}">
                            ${element.days.map((day,i) => `
                                <li>${day} <span id="remove-day-${i}" class='material-symbols-outlined'>remove</span></li>
                            `).join('')}
                        </ul>
                        <span id="add-day-${index}" class="add-day material-symbols-outlined"> add </span>
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

    addDayInput(e) {
        const span = e.target
        const i = span.id.split('-').pop()
        const ul = document.querySelector(`#day-list-${i}`)

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const presentDays = [...ul.getElementsByTagName('li')]
            .filter(e => e.firstChild.data !== undefined)
            .map(e => e.firstChild.data.trim());
        const possibleDays = days.filter(x => !presentDays.includes(x))
        
        const form = document.createElement('form')
        form.innerHTML = ` 
            <select id="select-day">
                ${possibleDays.map((d,i) => `<option value=${d} ${i===0 ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <div id="time-slot-editor__cta">
                <input id="add-day-submit" type="submit" value="Add" />
                <!-- <span id="cancel-day-submit" class="material-symbols-outlined"> cancel </span> -->
            </div> `
        span.replaceWith(form)

        let submit = document.querySelector('input#add-day-submit')
        submit.addEventListener('click', (event) => this.addTempLi(ul, event, i))
    }

    addTempLi(ul, e, i) {
        e.preventDefault()
        let select = document.getElementById('select-day')
        let selectedDay = select.options[select.selectedIndex].value
        this.tempRules[i].days.push(selectedDay)
        ul.insertAdjacentHTML("beforeend", `<li>${selectedDay} <span id="remove-day" class='material-symbols-outlined'>remove</span></li>`)
        // this.setAttribute('rules', JSON.stringify(rules))
   }

   removeDay(e) {
        console.log(e)
   }
    
   // Using arrow function because "this" returns undefined if I don't. Find better.
    handleSave = async () => {
        console.log(this.tempRules)
        let { sites = {} } = await chrome.storage.local.get('sites')
        let s = sites.filter(x => x.site === this.closest('li').id)[0]
        let siteIndex = sites.findIndex(x => x === s)
        sites[siteIndex].restrictions.slots = this.tempRules
        await chrome.storage.local.set({sites : sites})
        const restriction = document.createElement('slot-time-restriction');

        // Set the rules attribute on the editor element
        restriction.setAttribute('rules', JSON.stringify(this.tempRules));
    
        // Replace the SlotTimeRestriction element with the SlotTimeRestrictionEditor element
        this.parentNode.replaceChild(restriction, this); 
    }
}

customElements.define('slot-time-restriction-editor', SlotTimeRestrictionEditor);

export default SlotTimeRestrictionEditor;