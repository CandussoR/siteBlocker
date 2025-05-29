class DayColumn extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback(refresh = false) {
        if (!refresh) this.tempDays = this.days
    
        this.buildHTML()

        this.querySelector("[id^='add-day-']").addEventListener('click', (e) => { this.addDayInput(e) })

        let removeButtons = this.querySelectorAll("[id^='remove-day-']")
        if (removeButtons.length === 0) return;
        removeButtons.forEach((button) => button.addEventListener('click', (e) => { this.removeDay(e) }))
    }

    get index() { return this.getAttribute('index') }
    set index(i) { this.setAttribute('index', i) }
    get days() { return JSON.parse(this.getAttribute('days')) }
    set days(d) { this.setAttribute('days', d) }
    get restrictionType() { return this.getAttribute('restrictionType') }
    set restrictionType(r) { return this.setAttribute('restrictionType', r) }

    buildHTML() {
        this.innerHTML = `<div id="card-${this.index}-days" class="flex flex-col justify-center items-center">
                    <table class="m-4">
                        <col></col>
                        <col></col>
                        <thead>
                            <th colspan="2">Days</th>
                        </thead>
                        <tbody id="day-list-${this.index}">
                            ${this.tempDays
                          .map(
                            (day, i) => `
                            <tr>
                                <td class="p-2">${day}</td>
                                <td class="border-0"><span id="remove-day-${i}" class='btn btn-ghost btn-xs material-symbols-outlined'>remove</span></td>
                            </tr>
                        `
                          )
                          .join("")}
                        </tbody>
                    </table>
                    <button id="add-day-${this.index}" class="btn btn-accent btn-outline"> Add day </button>
                </div>`
    }

    addDayInput(e) {
        e.preventDefault()
        const span = e.target;
        const i = span.id.split("-").pop();
        const tbody = this.querySelector(`[id$=day-list-${i}]`)
    
        const possibleDays = this.calculatePossibleDaysFrom(tbody)
        const div = this.buildSelect(possibleDays)
        span.replaceWith(div);

        this.querySelector('#select-day').addEventListener("change", (event) => {
            event.preventDefault()
            if (event.target.value === '') return;
            this.addTempRow(this.restrictionType, tbody, i)
            this.updateSelectDays( this.querySelector('#select-day'), tbody);
        })

        this.querySelector(`#done-select-${this.index}`).addEventListener('click', (e) => { this.connectedCallback(true) })
        this.querySelector(`#cancel-select-${this.index}`).addEventListener('click', (e) => { this.connectedCallback() })
    }

    buildSelect(possibleDays) {
        const div = document.createElement("div");
        div.innerHTML = ` 
                <select id="select-day" class="select">
                    <option value='' selected>--Choose your day--</option>
                    ${possibleDays
                      .map( (d, i) =>
                          `<option value=${d}>${d}</option>`
                      ) .join("")}
                </select>
                <div id="day-column-editor__cta" class="flex gap-7 justify-center align-center">
                    <button id="done-select-${this.index}" class="btn btn-accent btn-outline">Done</button>
                    <button id="cancel-select-${this.index}" class="btn">Cancel</button>
                </div> `;
        return div
    }

    calculatePossibleDaysFrom(ul) {
        const days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const presentDays = [...ul.getElementsByTagName("td")]
          .filter((e) => e.firstChild.data !== undefined)
          .map((e) => e.firstChild.data.trim());

        return days.filter((x) => !presentDays.includes(x));
    }


    updateSelectDays(select, ul) {
        let possibleDays = this.calculatePossibleDaysFrom(ul)
    
        select.innerHTML = ''
        select.insertAdjacentHTML("beforeend",
                    `<option value='' selected>--Choose your day--</option>
                    ${possibleDays
                        .map( (d, i) =>
                            `<option value=${d}>${d}</option>`
                        ) .join("")}`)
    }

    addTempRow(type, tbody, i) {
        let select = document.getElementById("select-day")
        let selectedDay = select.options[select.selectedIndex].value;
        this.tempDays.push(selectedDay);
        this.dispatchEvent(new CustomEvent('daysUpdate', { detail : {restrictionType : type, ul: tbody, i: i, days : this.tempDays}, bubbles : true }))
    
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${selectedDay} <span id="remove-day-${i}" class='btn btn-ghost material-symbols-outlined'>remove</span></td>`)
        document.getElementById(`remove-day-${i}`).addEventListener('click', (e) => this.removeDay(e));
    }

    removeDay(e) {
        let iTd = e.target.id.split("-").pop();
        this.tempDays.splice(iTd, 1);

        this.dispatchEvent(
          new CustomEvent("daysUpdate", {
            detail: { restrictionType: this.restrictionType, i: this.index, days: this.tempDays},
            bubbles: true })
        );

        e.target.parentNode.remove();
    }
}

customElements.define('day-column', DayColumn)