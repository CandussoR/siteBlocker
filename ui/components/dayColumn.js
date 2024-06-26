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
        this.innerHTML = `<div id="card-${this.index}-days" class="day-column">
                    <h4>For days</h4>
                    <ul id="day-list-${this.index}">
                        ${this.tempDays
                          .map(
                            (day, i) => `
                            <li>${day} <span id="remove-day-${i}" class='material-symbols-outlined'>remove</span></li>
                        `
                          )
                          .join("")}
                    </ul>
                    <span id="add-day-${this.index}" class="add-day material-symbols-outlined"> add </span>
                </div>`
    }

    addDayInput(e) {
        e.preventDefault()
        const span = e.target;
        const i = span.id.split("-").pop();
        const ul = this.querySelector(`[id$=day-list-${i}]`)
    
        const possibleDays = this.calculatePossibleDaysFrom(ul)
        const div = this.buildSelect(possibleDays)
        span.replaceWith(div);

        this.querySelector('#select-day').addEventListener("change", (event) => {
            event.preventDefault()
            if (e.target.value === '') return;
            this.addTempLi(this.restrictionType, ul, i)
            this.updateSelectDays( this.querySelector('#select-day'), ul);
        })

        this.querySelector(`#done-select-${this.index}`).addEventListener('click', (e) => { this.connectedCallback(true) })
        this.querySelector(`#cancel-select-${this.index}`).addEventListener('click', (e) => { this.connectedCallback() })
    }

    buildSelect(possibleDays) {
        const div = document.createElement("div");
        div.innerHTML = ` 
                <select id="select-day">
                    <option value='' selected>--Choose your day--</option>
                    ${possibleDays
                      .map( (d, i) =>
                          `<option value=${d}>${d}</option>`
                      ) .join("")}
                </select>
                <div id="day-column-editor__cta">
                    <button id="done-select-${this.index}">Done</button>
                    <button id="cancel-select-${this.index}">Cancel</button>
                </div> `;
        return div
    }

    calculatePossibleDaysFrom(ul) {
        const days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const presentDays = [...ul.getElementsByTagName("li")]
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

    addTempLi(type, ul, i) {
        let select = document.getElementById("select-day")
        let selectedDay = select.options[select.selectedIndex].value;
        this.tempDays.push(selectedDay);
        this.dispatchEvent(new CustomEvent('daysUpdate', { detail : {restrictionType : type, ul: ul, i: i, days : this.tempDays}, bubbles : true }))
    
        let listItem = document.createElement('li');
        listItem.textContent = selectedDay;
        let removeButton = document.createElement('span');
        removeButton.classList.add('material-symbols-outlined');
        removeButton.textContent = 'remove';
        removeButton.id = `remove-day-${i}`;
        listItem.appendChild(removeButton);
        
        ul.appendChild(listItem);
        
        removeButton.addEventListener('click', (e) => this.removeDay(e));
    }

    removeDay(e) {
        let iLi = e.target.id.split("-").pop();
        this.tempDays.splice(iLi, 1);

        this.dispatchEvent(
          new CustomEvent("daysUpdate", {
            detail: { restrictionType: this.restrictionType, i: this.index, days: this.tempDays},
            bubbles: true })
        );

        e.target.parentNode.remove();
    }
}

customElements.define('day-column', DayColumn)