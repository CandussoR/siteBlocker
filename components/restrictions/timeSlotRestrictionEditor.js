import '../dayColumn.js'

class TimeSlotRestrictionEditor extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback(refresh=false) {
        if (!refresh) {
            this.temp = {"days" : this.days, "time" : this.time || []}
            this.innerHTML = this.buildHTML()
        }

        this.querySelector("span[id^='add-time-']").addEventListener("click", (e) => this.addTimeSlot(e));
        this.querySelector(`#time-list-${this.index}`).addEventListener('change', (e) => { this.handleTimeSlotUpdate(e) })

        let removeButtons = this.querySelectorAll("[id^='remove-time']")
        if (!removeButtons) return ;
        removeButtons.forEach((button) => button.addEventListener('click', (e) => this.removeTimeSlot(e)))
    }

    get index() { return this.getAttribute('index') }
    set index(i) { this.setAttribute('index', i) }

    get days() { 
        let days = this.getAttribute('days')
        if (!days) return [];
        return JSON.parse(days)
     }
    set days(d) { this.setAttribute('days', d) }

    get time() { return JSON.parse(this.getAttribute('time')) }
    set time(t) { this.setAttribute('time', t) }

    buildHTML() {
        return `
            <div class="card">
                <day-column index='${this.index}' days='${JSON.stringify(this.temp.days)}' restrictionType='timeSlot'></day-column>
                <div id="card-${this.index}-times" class="time-column">
                    <h4>Restricted Slots</h4>
                    <ul id='time-list-${this.index}'>
                        ${this.temp.time
                          .map(
                            (time, i) => `
                            <li id='list-item-${i}'>
                                <input id="time-list-${i}-0" type="time" value="${time[0]}"> - <input id="time-list-${i}-1" type="time" value="${time[1]}">
                                <span id="remove-time-${i}" class='material-symbols-outlined'>remove</span>
                            </li>
                        `
                          )
                          .join("")}
                        </ul>
                        <span id="add-time-${this.index}" class="material-symbols-outlined"> add </span></li>
                </div>
            </div>
        `
      }
    
      newCard(index) {
        this.innerHTML = `<div id="time-slot-card-${index}" class="time-slot-card">
                    <span id="delete-card-${this.index}" class="material-symbols-outlined"> delete </span>
                    <day-column index='${this.index}' days='${JSON.stringify(this.temp.days)}' restrictionType='timeSlot'></day-column>
                    <div id="card-${this.index}-times" class="time-column">
                        <h4>Restricted Slots</h4>
                        <ul id="time-list-${this.index}"></ul>
                        <span id="add-time-${this.index}" class="material-symbols-outlined"> add </span></li>
                    </div>
                </div>`
        this.connectedCallback(true)
    }

    addTimeSlot(e) {
        const span = e.target
        const i = span.id.split("-").pop()
        const ul = this.querySelector(`#time-list-${i}`)
        const lastLi = ul.querySelectorAll('li').length
        const newLi = `<li id='list-item-${lastLi}'>
                            <input id="time-list-${lastLi}-0" type="time" value=""> - <input id="time-list-${lastLi}-1" type="time" value="">
                            <span id="remove-time-${lastLi}" class='material-symbols-outlined'>remove</span>
                        </li>`
        ul.insertAdjacentHTML("beforeend", newLi)

        this.querySelector(`#remove-time-${lastLi}`).addEventListener('click', (e) => this.removeTimeSlot(e))
    }

    handleTimeSlotUpdate(e) {
        let [ , , slotIndex, inputIndex] = e.target.id.split('-')

        if (!this.temp.time[slotIndex]) this.temp.time.push([])
        this.temp.time[slotIndex][inputIndex] = e.target.value;

        if (this.temp.time[slotIndex].length === 2) {
            this.dispatchEvent(new CustomEvent('slotUpdate', {detail : {i : this.index, time : this.temp.time}, bubbles : true }))
        }
    }

    removeTimeSlot(e) {
        let slotIndex = e.target.id.split('-').pop()
        this.temp.time.splice(slotIndex, 1)
        this.dispatchEvent(new CustomEvent('slotUpdate', {detail : {i : this.index, time : this.temp.time}, bubbles : true }))
        e.target.parentNode.remove()
    }

    async handleDelete() {
        this.dispatchEvent(new CustomEvent('deleteCard', {detail : {restrictionType: 'timeSlot', i : this.index}, bubbles : true}))
        this.remove()
    }
}

customElements.define('time-slot-restriction-editor', TimeSlotRestrictionEditor)