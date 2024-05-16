import './totalTimeRestriction.js'
import './timeSlotRestrictionEditor.js'

class RestrictionEditor extends HTMLElement {
  constructor() {
    super();

    this.tempRestrictions = null;
    this.titleMapping = {"timeSlot" : "Time Slot", "totalTime" : "Total Time", "consecutiveTime" : "Consecutive Time"}
    this.idMapping = {"timeSlot" : "time-slot", "totalTime" : "total-time", "consecutiveTime" : "consecutive-time"}
  }

  connectedCallback() {
    this.tempRestrictions = this.restrictions || {};
    this.innerHTML = this.buildHTML();

    this.querySelector("#select-restriction").addEventListener('change', (e) => this.addNewRestriction(e))

    document.addEventListener('daysUpdate', (e) => { this.tempRestrictions[e.detail.restrictionType][e.detail.i].days = e.detail.days })
    document.addEventListener('slotUpdate', (e) => { this.tempRestrictions.timeSlot[e.detail.i].time = e.detail.time })
    document.addEventListener('timeInputChange', (e) => {console.log(e)})
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
    <h2> Restrictions </h2>
    <div id='new-restriction'>
      <label for='select-restriction'>New restriction card : </label>
      <select id="select-restriction" name='select-restriction'>
        <option value='' selected>--Choose a restriction--</option>
        <option value='timeSlot'>Time Slots</option>
        <option value='totalTime'>Total Time</option>
        <option value='consecutiveTime'>Consecutive Time</option>
      </select>
    </div>
    `

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
            (element, index) => `<time-slot-restriction-editor index='${index}' days='${JSON.stringify(element.days)}' time='${JSON.stringify(element.time)}'/>`)
            .join("")
        }
          </div>
        `
      }

      if (keys.includes("totalTime")) {
        html += `<div id="total-time-container">
          <h3>Total Time</h3>
          ${this.tempRestrictions.totalTime
            .map((element, index) => `<total-time-restriction-editor index='${index}' days='${element.days}' totalTime='${element.totalTime}'/>`)
            .join('')
          }
          </div>`
      }

      if (keys.includes('consecutiveTime')) {
        console.log("consecutiveTime");

        html += `<div id="consecutive-time-container">
          <h3>Consecutive Time</h3>
        ${this.tempRestrictions.consecutiveTime
          .map(
            (el, index) =>
              `<p id="total-time-${index}-days">On ${el.days.join("")}, ${
                el.consecutiveTime
              } consecutive minutes max with ${
                el.pause
              } minutes pause between.</p>`
          )
          .join("")}
       </div>`;
      }

    html += '</div>'
    return html
  }

  addNewRestriction(event) {
    let keys = this.tempRestrictions ? Object.keys(this.tempRestrictions) : []
    let type = event.target.value
    let idType = this.idMapping[type]
    let titleType = this.titleMapping[type]

    if (keys.length === 0) {

      this.tempRestrictions = {}
      this.insertAdjacentHTML("beforeend", "<div id='restrictions-container'></div>")
      this.querySelector('#restrictions-container').insertAdjacentHTML("beforeend", `<div id="${idType}-container"><h3>${titleType}</h3></div>`)
      let created = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(created, type)
      this.updateTempRestrictions("create", type)

    } else if (!keys.includes(type)) {

      this.querySelector('#restrictions-container').insertAdjacentHTML("beforeend", `<div id="${idType}-container"><h3>${titleType}</h3></div>`)
      let created = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(created, type)
      this.updateTempRestrictions("create", type)
      
    } else {

      let i = this.tempRestrictions[type].length
      let container = this.querySelector(`#${idType}-container`)
      this.addRestrictionCardIn(container, type, i)
      this.updateTempRestrictions("add", type, i)

    }
  }

  createNewRestrictionContainer(type) {
    return `<div id='${this.idMapping[type]}'><h3>${this.titleMapping[type]}</h3>`
  }
  
  addRestrictionCardIn(baseElement, type, index = 0) {
    let html = ""
      switch(type) {
        case ('timeSlot') :
          let slotTimeRestrictionEditor = document.createElement('time-slot-restriction-editor')
          slotTimeRestrictionEditor.index = index
          baseElement.insertAdjacentElement("beforeend", slotTimeRestrictionEditor)
          slotTimeRestrictionEditor.newCard(index)
            break;
        case ('totalTime') :
          let totalTimeRestrictionEditor = document.createElement('total-time-restriction-editor')
          totalTimeRestrictionEditor.index = index
          baseElement.insertAdjacentElement("beforeend", totalTimeRestrictionEditor)
          totalTimeRestrictionEditor.newCard(index)
            break;
        case ('consecutiveTime'):
          html += `<div id="consecutive-time-card-${index}" class="total-time-card">
                    <div id="card-${index}-days" class="day-column">
                        <h4>For days</h4>
                        <ul id="day-list-${index}"></ul>
                        <span id="add-day-${index}" class="add-day material-symbols-outlined"> add </span>
                    </div>
                    <div id="card-${index}-times" class="time-column">
                        <h4>Max time before the pause</h4>
                        <label for="consecutive-time-${index}">Max time straight :</label>
                        <input id="consecutive-time-${index}" name="consecutive-time-${index}" type="number">
                        <label for="pause-${index}">Pause :</label>
                        <input id="pause-${index}" name="pause-${index}" type="number">
                    </div>
                </div>`
            baseElement.insertAdjacentHTML("beforeend", html)
            this.querySelector(`#add-day-${index}`).addEventListener("click", (e) => this.addDayInput(e))
            this.querySelector(`#consecutive-time-${index}`).addEventListener("change", (e) => this.setTimeInMinutes(e, 'consecutiveTime', index, 'max'))
            this.querySelector(`#pause-${index}`).addEventListener("change", (e) => this.setTimeInMinutes(e, 'consecutiveTime', index, 'pause'))
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
    } else if (updateType === 'remove') {
      this.tempRestrictions[restrictionType].splice(index, 1)
    }
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

    if (keys.length === 0) return ;

    for (const key of keys) {
      for (let i = 0; i < this.tempRestrictions[key].length; i++) {
        this.sortDays(this.tempRestrictions[key][i].days);
      }
    }
    return this.tempRestrictions
  }
}

customElements.define( "restriction-editor", RestrictionEditor);

export default RestrictionEditor;
