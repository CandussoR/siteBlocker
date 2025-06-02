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

        this.querySelector("button[id^='add-time-']").addEventListener("click", (e) => this.addTimeSlot(e));
        this.querySelector(`#time-list-${this.index}`).addEventListener('change', (e) => { this.handleTimeSlotUpdate(e) })

        let removeButtons = this.querySelectorAll("[id^='remove-time']")
        if (removeButtons) {
            removeButtons.forEach((button) => button.addEventListener('click', (e) => { this.removeTimeSlot(e)}))
        }

        let deleteCardButtons = this.querySelectorAll("button[id^='delete-card']")
        if (deleteCardButtons) {
            deleteCardButtons.forEach((button) => button.addEventListener('click', async () => this.handleDelete()))
        }
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
        return `<div class="flex flex-col w-full items-center justify-center mb-2 bg-base-300 p-4">
            <div class="flex flex-col md:flex-row size-fit justify-around">
                <day-column index='${this.index}' days='${JSON.stringify(this.temp.days)}' restrictionType='timeSlot'></day-column>
                <div id="card-${this.index}-times" class="grow flex flex-col mr-2 items-center">
                    <table class="table-auto w-full m-4">
                      <colgroup span="2"></colgroup>
                      <col></col>
                        <thead>
                            <tr> <th colspan="2">Restricted Slots</th></tr>
                            <tr>
                                <th class="w-1/2">Beginning</th>
                                <th class="w-1/2">Ending</th>
                            </tr>
                        </thead>
                        <tbody id="time-list-${this.index}">
                            ${this.temp.time .map((time, i) => `
                                <tr id='list-item-${i}'>
                                    <td class="w-1/2"><input id="time-list-${i}-0" class="input w-full" type="time" value="${time[0]}"></td>
                                    <td class="w-1/2"><input id="time-list-${i}-1" class="input w-full" type="time" value="${time[1]}"></td>
                                    <td class="border-0">
                                        <button id="remove-time-${i}" class="material-symbols-outlined btn btn-ghost btn-xs"> remove </button>
                                    </td>
                                </tr> `) .join("")} 
                        </tbody>
                    </table>
                    <button id="add-time-${this.index}" class="btn btn-accent btn-outline">Add Slot</li>
                </div>
            <button id="delete-card-${this.index}" class="btn btn-error btn-outline m-4"><span class="material-symbols-outlined">delete</span></button>
            </div>
        </div>
        `
      }

    
      newCard(index) {
        this.innerHTML = `<div class="flex flex-col w-full items-center justify-center mb-2 bg-base-300 p-4">
            <div class="flex flex-col md:flex-row size-fit justify-around">
                <day-column index='${this.index}' days='${JSON.stringify(this.temp.days)}' restrictionType='timeSlot'></day-column>
                <div id="card-${this.index}-times" class="grow flex flex-col mr-2 items-center">
                    <table class="table-auto w-full m-4">
                      <colgroup span="2"></colgroup>
                      <col></col>
                        <thead>
                            <tr> <th colspan="2">Restricted Slots</th></tr>
                            <tr>
                                <th class="w-1/2">Beginning</th>
                                <th class="w-1/2">Ending</th>
                            </tr>
                        </thead>
                        <tbody id="time-list-${this.index}">
                            <tr id='list-item-0'>
                            <td class="w-1/2"> <input id="time-list-0-0" class="input w-full" type="time" value=""></td>
                            <td class="w-1/2"><input id="time-list-0-1" class="input w-full" type="time" value=""></td>
                            <td class="border-0">
                                <button id="remove-time-0" class="material-symbols-outlined btn btn-ghost btn-xs"> remove </button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    <button id="add-time-${this.index}" class="btn btn-accent btn-outline">Add Slot</li>
                </div>
            <button id="delete-card-${this.index}" class="btn btn-error btn-outline m-4"><span class="material-symbols-outlined">delete</span></button>
            </div>
        </div>
        `
        this.querySelector(`#remove-time-0`).addEventListener('click', (e) => this.removeTimeSlot(e))

        this.connectedCallback(true)
    }

    addTimeSlot(e) {
        e.preventDefault()
        const button = e.target
        const i = button.id.split("-").pop()
        const tdInput = this.querySelector(`#time-list-${i}`)
        const lastTr = tdInput.querySelectorAll('tr').length
        const newTr = `<tr id='list-item-${lastTr}'>
                            <td class="w-1/2"> <input id="time-list-${lastTr}-0" class="input w-full" type="time" value=""></td>
                            <td class="w-1/2"><input id="time-list-${lastTr}-1" class="input w-full" type="time" value=""></td>
                            <td class="border-0">
                                <button id="remove-time-${lastTr}" class="material-symbols-outlined btn btn-ghost btn-xs"> remove </button>
                            </td>
                        </tr>`
        tdInput.insertAdjacentHTML("beforeend", newTr)

        this.querySelector(`#remove-time-${lastTr}`).addEventListener('click', (e) => this.removeTimeSlot(e))
    }

    handleTimeSlotUpdate(e) {
        let [ , , slotIndex, inputIndex] = e.target.id.split('-')
        if (!this.temp.time[slotIndex]) this.temp.time.push([])
        this.temp.time[slotIndex][inputIndex] = e.target.value;
        console.log(this.temp.time)
        if (this.temp.time[slotIndex].length === 2) {
            this.dispatchEvent(new CustomEvent('slotUpdate', {detail : {i : this.index, time : this.temp.time}, bubbles : true }))
        }
    }

    removeTimeSlot(e) {
        e.preventDefault()
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