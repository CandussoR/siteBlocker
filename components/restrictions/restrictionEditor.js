console.log("loading restriction editor")

class SlotTimeRestrictionEditor extends HTMLElement {
  constructor() {
    super();

    this.tempRestrictions = null;
    this.titleMapping = {"timeSlot" : "Time Slot", "totalTime" : "Total Time", "consecutiveTime" : "Consecutive Time"}
    this.idMapping = {"timeSlot" : "time-slot", "totalTime" : "total-time", "consecutiveTime" : "consecutive-time"}
  }

  connectedCallback() {
    this.tempRestrictions = this.restrictions || {};
    console.log("restrictions received in restriction-editor", JSON.stringify(this.restrictions))
    this.innerHTML = this.buildHTML();
    const addDayButtons = document.querySelectorAll("span[id^='add-day-']");
    addDayButtons.forEach((button) => {
      button.addEventListener("click", (e) => this.addDayInput(e));
    });

    const removeDayButtons = document.querySelectorAll(
      "span[id^='remove-day-']"
    );
    removeDayButtons.forEach((button) => {
      button.addEventListener("click", (e) => this.removeDay(e));
    });

    const addTimeSlotButton = document.querySelectorAll(
      "span[id^='add-time-']"
    );
    addTimeSlotButton.forEach((button) => {
      button.addEventListener("click", (e) => this.addTimeSlot(e));
    });

    const dayColumns = document.querySelectorAll("div[id^='card-'][id$='-times']")
    dayColumns.forEach((column) => column.addEventListener("change", (e) => this.updateSlotTimes(e) ))

    const removeTimeSlotButton = document.querySelectorAll(
      "span[id^='remove-time-']"
    );
    removeTimeSlotButton.forEach((button) => {
      button.addEventListener("click", (e) => this.removeTimeSlot(e));
    });

    this.querySelector("#select-restriction").addEventListener('change', (e) => this.addNewRestriction(e))
  }

  disconnectedCallback() {
    console.log("disconnected")
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "restrictions") {this.buildHTML();
    }
  }

  get restrictions() {
    let rules = this.getAttribute("restrictions");
    return JSON.parse(rules);
  }

  set restrictions(r) {
    this.setAttribute("restrictions", r);
  }

  buildHTML() {
    let keys = Object.keys(this.tempRestrictions)
    let html = `<div id="restrictions-container">
    <div id='new-restriction'>
      <label for='select-restriction'>New restriction ?</label>
      <select id="select-restriction" name='select-restriction'>
        <option value='' selected>--Choose a restriction--</option>
        <option value='timeSlot'>Time Slots</option>
        <option value='totalTime'>Total Time</option>
        <option value='consecutiveTime'>Consecutive Time</option>
      </select>
    </div>
    `

    console.log("are there not-restrictions?", !this.tempRestrictions)
    if (!this.tempRestrictions) {
      html += "</div>"
      return html
    }

    if (keys.includes('timeSlot')) {
      html += `
      <div id='time-slot-container'>
      <h3>Time Slots</h3>
        ${this.tempRestrictions.timeSlot
          .map(
            (element, index) => `
            <div class="card">
                <div id="card-${index}-days" class="day-column">
                    <h4>For days</h4>
                    <ul id="day-list-${index}">
                        ${element.days
                          .map(
                            (day, i) => `
                            <li>${day} <span id="remove-day-${i}" class='material-symbols-outlined'>remove</span></li>
                        `
                          )
                          .join("")}
                    </ul>
                    <span id="add-day-${index}" class="add-day material-symbols-outlined"> add </span>
                </div>
                <div id="card-${index}-times" class="time-column">
                    <h4>Restricted Slots</h4>
                    <ul id="time-list-${index}">
                        ${element.time
                          .map(
                            (time, i) => `
                            <li>
                                <input id="time-list-${i}-0" type="time" value="${time[0]}"> - <input id="time-list-${i}-1" type="time" value="${time[1]}">
                                <span id="remove-time-${i}" class='material-symbols-outlined'>remove</span>
                            </li>
                        `
                          )
                          .join("")}
                        </ul>
                        <span id="add-time-${index}" class="material-symbols-outlined"> add </span></li>
                </div>
            </div>
        `
          )
          .join("")}
      `
      }

      if (keys.includes('totalTime')) {
        html += `<div id="total-time-container">
                  ${this.tempRestrictions.totalTime
                      .map((el, index) =>
                        `<p id="total-time-${index}-days">On ${el.days.join('')} for ${el.totalTime} minutes.</p>`
                  ).join('')}
                 </div>`
      }

      if (keys.includes('consecutiveTime')) {
        console.log("consecutiveTime")
        html += `<div id="consecutive-time-container">
        ${this.tempRestrictions.consecutiveTime
          .map(
            (el, index) =>
              `<p id="total-time-${index}-days">On ${el.days.join("")}, ${ el.consecutiveTime } consecutive minutes max with ${ el.pause } minutes pause between.</p>`)
          .join("")}
       </div>`;
      }

    html += '</div>'
    return html
  }

  addDayInput(e) {
    const span = e.target;
    const i = span.id.split("-").pop();
    const ul = this.querySelector(`#day-list-${i}`);

    const days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const presentDays = [...ul.getElementsByTagName("li")]
      .filter((e) => e.firstChild.data !== undefined)
      .map((e) => e.firstChild.data.trim());
    const possibleDays = days.filter((x) => !presentDays.includes(x));

    const form = document.createElement("form");
    form.innerHTML = ` 
            <select id="select-day">
                ${possibleDays
                  .map( (d, i) =>
                      `<option value=${d} ${
                        i === 0 ? "selected" : ""
                      }>${d}</option>`
                  ) .join("")}
            </select>
            <div id="time-slot-editor__cta">
                <input id="add-day-submit" type="submit" value="Add" />
                <!-- <span id="cancel-day-submit" class="material-symbols-outlined"> cancel </span> -->
            </div> `;
    span.replaceWith(form);

    let submit = document.querySelector("input#add-day-submit");
    submit.addEventListener("click", (event) => this.addTempLi(ul, event, i));
  }

  addTempLi(ul, e, i) {
    e.preventDefault();
    let select = document.getElementById("select-day");
    let selectedDay = select.options[select.selectedIndex].value;
    this.tempRestrictions.timeSlot[i].days.push(selectedDay);
    ul.insertAdjacentHTML( "beforeend", `<li>${selectedDay} <span id="remove-day" class='material-symbols-outlined'>remove</span></li>`);
  }

  addTimeSlot(e) {
    const span = e.target
    const i = span.id.split("-").pop()
    const ul = this.querySelector(`#time-list-${i}`)
    const lastLi = ul.querySelectorAll('li').length

    const newLi = `<li>
                        <input id="time-list-${lastLi}-0" type="time" value=""> - <input id="time-list-${lastLi}" type="time" value="">
                        <span id="remove-time-${lastLi}" class='material-symbols-outlined'>remove</span>
                    </li>`
    ul.insertAdjacentHTML("beforeend", newLi)
    this.tempRestrictions.timeSlot[i].time.push(["", ""])
  }

  addNewRestriction(event) {
    console.log(event.target, event.target.value)
    let keys = this.tempRestrictions ? Object.keys(this.tempRestrictions) : []
    let type = event.target.value
    let idType = this.idMapping[type]
    let titleType = this.titleMapping[type]
    console.log(keys, type, idType)

    if (keys.length === 0) {
      this.tempRestrictions = {}
      this.insertAdjacentHTML("beforeend", "<div id='restrictions-container'></div>")
      this.querySelector('#restrictions-container').insertAdjacentHTML("beforeend", `<div id="${idType}-container"><h3>${titleType}</h3></div>`)
      let created = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(created, type)
      this.updateTempRestrictions("create", type)
    }


    else if (!keys.includes(type)) {
      this.querySelector('#restrictions-container').insertAdjacentHTML("beforeend", `<div id="${idType}-container"><h3>${titleType}</h3></div>`)
      let created = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(created, type)
      this.updateTempRestrictions("create", type)
    }

    else {
      let i = this.tempRestrictions[type].length
      let container = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(container, type, i)
      this.updateTempRestrictions("add", type, i)
    }
  }

  createNewRestrictionContainer(id) {
    switch (id) {
      case 'time-slot' :
        return `<div id='time-slot-container'><h3>Time Slots</h3></div>`
      case 'total-time':
        return `<div id='total-time-container'><h3>Total Time</h3></div>`
      case 'consecutive-time':
        return `<div id='consecutive-time-container'><h3>Total Time</h3></div>`
    }

  }

  addRestrictionCardIn(baseElement, type, index = 0) {
    let html = ""
      switch(type) {
        case ('timeSlot') :
          html += `<div id="time-slot-card-${index}" class="time-slot-card">
                    <div id="card-${index}-days" class="day-column">
                        <h4>For days</h4>
                        <ul id="day-list-${index}"></ul>
                        <span id="add-day-${index}" class="add-day material-symbols-outlined"> add </span>
                    </div>
                    <div id="card-${index}-times" class="time-column">
                        <h4>Restricted Slots</h4>
                        <ul id="time-list-${index}"></ul>
                        <span id="add-time-${index}" class="material-symbols-outlined"> add </span></li>
                    </div>
                </div>`
            baseElement.insertAdjacentHTML("beforeend", html)
            this.querySelector(`#add-day-${index}`).addEventListener("click", (e) => this.addDayInput(e))
            this.querySelector(`#add-time-${index}`).addEventListener("click", (e) => this.addTimeSlot(e))
            break;
        case ('totalTime') :
            break;
        case ('consecutiveTime'):
            break;
        default:
            console.error("Inexisting type", type)
    }
  }

  // updateType is "create", "add", "remove"
  updateTempRestrictions(updateType, restrictionType, index = null) {
    let init = {
      timeSlot: { days: [], time: [] },
      totalTime: { days: [], totalTime: 0 },
      consecutiveTime: { days: [], time: 0, pause: 0 },
    };  

    if (updateType === 'create') {
      this.tempRestrictions[restrictionType] = [ init[restrictionType] ]
    } else if (updateType === 'add') {
      this.tempRestrictions[restrictionType].push(init[restrictionType])
    }

    console.log("after switch", this.tempRestrictions)
  }

  removeTimeSlot(e) {
    let ulIndex = e.target.closest('ul').id.split('-').pop()
    let i = e.target.id.split('-').pop()
    this.tempRestrictions[ulIndex].time.splice(i, 1)
    e.target.parentNode.remove()
  }

  removeDay(e) {
    let iUl = e.target.closest("ul").id.split("-").pop();
    let iLi = e.target.id.split("-").pop();
    this.tempRestrictions[iUl].days.splice(iLi, 1);
    this.tempRestrictions[iUl].days = this.sortDays(this.tempRestrictions[iUl].days);
    e.target.parentNode.remove();
  }

  // Using arrow function because "this" returns undefined if I don't. Find better.
  handleSave = async () => {
    
    this.tempRestrictions.forEach(el => {
        el.time.forEach(slot => {
            if (slot[0] === '' || slot[1] === '') {
                console.error("Some times are missing.")
                return;
            }
        })}
    )

    let { sites = {} } = await chrome.storage.local.get("sites");
    let s = sites.filter((x) => x.site === this.closest("li").id)[0];
    let siteIndex = sites.findIndex((x) => x === s);
    sites[siteIndex].restrictions.timeSlot = this.tempRestrictions;

    await chrome.storage.local.set({ sites: sites });

    const restriction = document.createElement("restriction-item");
    restriction.setAttribute("rules", JSON.stringify(this.tempRestrictions));
    this.replaceWith(restriction);
  };

  updateSlotTimes(event) {
    let i = event.target.closest("ul").id.split("-").pop();
    const [a,b, slotIndex, inputIndex] = event.target.id.split('-')
    this.tempRestrictions[i].time[slotIndex][inputIndex] = event.target.value
  }

  handleCancel = () => {
    const restriction = document.createElement("restriction-item");
    restriction.setAttribute("rules", JSON.stringify(this.restrictions));
    this.replaceWith(restriction);
  };

  sortDays(unsorted) {
    const days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return unsorted.sort((a, b) => days.indexOf(a) - days.indexOf(b));
  }

  getModifiedData() {
    let keys = Object.keys(this.tempRestrictions)

    for (const key of keys) {
      for (let i = 0; i < this.tempRestrictions[key].length; i++) {
        this.sortDays(this.tempRestrictions.key[i].days);
      }
    }
    return this.tempRestrictions
  }
}

customElements.define( "restriction-editor", SlotTimeRestrictionEditor);

export default SlotTimeRestrictionEditor;
