import './totalTimeRestriction.js'
import './timeSlotRestrictionEditor.js'
import './consecutiveTimeRestrictionEditor.js'

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

    document.addEventListener('deleteCard', (e) => {
      if (this.tempRestrictions[e.detail.restrictionType].length === 1) delete this.tempRestrictions[e.detail.restrictionType]
      else this.tempRestrictions[e.detail.restrictionType].splice(e.detail.i, 1)
    })

    document.addEventListener('daysUpdate', (e) => { this.tempRestrictions[e.detail.restrictionType][e.detail.i].days = e.detail.days })
    document.addEventListener('slotUpdate', (e) => { this.tempRestrictions.timeSlot[e.detail.i].time = e.detail.time })
    document.addEventListener('timeInputChange', (e) => { this.tempRestrictions[e.detail.restrictionType][e.detail.i][e.detail.key] = e.detail.time })
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
            (element, index) => `<time-slot-restriction-editor index='${index}' days='${JSON.stringify(element.days)}' time='${JSON.stringify(element.time)}'></time-slot-restriction-editor>`)
            .join("")
        }
          </div>
        `
      }

      if (keys.includes('totalTime')) {
        console.log("yep I found a totalTime constraint")
        html += `<div id='total-time-container'>
          <h3>Total Time</h3>
          ${this.tempRestrictions.totalTime
            .map((element, index) => `<total-time-restriction-editor index='${index}' days='${JSON.stringify(element.days)}' totalTime='${JSON.stringify(element.totalTime)}'></total-time-restriction-editor>`)
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
            (element, index) =>
              `<consecutive-time-restriction-editor index='${index}' days='${JSON.stringify(element.days)}' consecutiveTime='${JSON.stringify(element.consecutiveTime)}' pause='${element.pause}'`
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
          totalTimeRestrictionEditor.totalTime = 0
          baseElement.insertAdjacentElement("beforeend", totalTimeRestrictionEditor)
          totalTimeRestrictionEditor.newCard(index)
            break;
        case ('consecutiveTime'):
          let consecutiveTimeRestrictionEditor = document.createElement('consecutive-time-restriction-editor')
          consecutiveTimeRestrictionEditor.index = index
          consecutiveTimeRestrictionEditor.consecutiveTime = 0
          consecutiveTimeRestrictionEditor.pause = 0
          baseElement.insertAdjacentElement("beforeend", consecutiveTimeRestrictionEditor)
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
