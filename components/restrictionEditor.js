class SlotTimeRestrictionEditor extends HTMLElement {
  constructor(rules) {
    super();

    this.tempRules = null;
  }

  connectedCallback() {
    this.tempRules = this.rules;
    this.innerHTML = this.buildHTML();

    const saveButton = document.getElementById("done");
    saveButton.addEventListener("click", this.handleSave);

    const cancelButton = document.getElementById("cancel");
    cancelButton.addEventListener("click", this.handleCancel);

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
  }

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "rules") this.innerHTML = this.buildHTML(newValue);
  }

  get rules() {
    let rules = this.getAttribute("rules");
    return JSON.parse(rules);
  }

  set rules(r) {
    this.setAttribute("rules", r);
  }

  buildHTML() {
    return `
        <div id='time-slot-container'>
            <h3>Time Slots</h3>
                <div id="time-slot-editor__cta">
                    <span id="done" class="material-symbols-outlined"> done </span>
                    <span id="cancel" class="material-symbols-outlined"> cancel </span>
                </div>
            ${this.rules
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
                                    <input id="time-list-${index}-0" type="time" value="${time[0]}"> - <input id="time-list-${index}-1" type="time" value="${time[1]}">
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
        </div>
        `;
  }

  addDayInput(e) {
    const span = e.target;
    const i = span.id.split("-").pop();
    const ul = document.querySelector(`#day-list-${i}`);

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
    this.tempRules[i].days.push(selectedDay);
    ul.insertAdjacentHTML( "beforeend", `<li>${selectedDay} <span id="remove-day" class='material-symbols-outlined'>remove</span></li>`);
  }

  addTimeSlot(e) {
    const span = e.target
    const i = span.id.split("-").pop()
    const ul = document.querySelector(`#time-list-${i}`)
    const lastLi = ul.querySelectorAll('li').length

    const newLi = `<li>
                        <input id="time-list-${lastLi}-0" type="time" value=""> - <input id="time-list-${lastLi}" type="time" value="">
                        <span id="remove-time-${lastLi}" class='material-symbols-outlined'>remove</span>
                    </li>`
    ul.insertAdjacentHTML("beforeend", newLi)
    console.log(this.tempRules[i].time)
    this.tempRules[i].time.push(["", ""])
  }

  removeTimeSlot(e) {
    let ulIndex = e.target.closest('ul').id.split('-').pop()
    let i = e.target.id.split('-').pop()
    this.tempRules[ulIndex].time.splice(i, 1)
    e.target.parentNode.remove()
  }

  removeDay(e) {
    let iUl = e.target.closest("ul").id.split("-").pop();
    let iLi = e.target.id.split("-").pop();
    this.tempRules[iUl].days.splice(iLi, 1);
    this.tempRules[iUl].days = this.sortDays(this.tempRules[iUl].days);
    e.target.parentNode.remove();
  }

  // Using arrow function because "this" returns undefined if I don't. Find better.
  handleSave = async () => {
    for (let i = 0; i < this.tempRules.length; i++) {
      this.sortDays(this.tempRules[i].days);
    }
    this.tempRules.forEach(el => {
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
    sites[siteIndex].restrictions.slots = this.tempRules;

    await chrome.storage.local.set({ sites: sites });

    const restriction = document.createElement("restriction-item");
    restriction.setAttribute("rules", JSON.stringify(this.tempRules));
    this.replaceWith(restriction);
  };

  updateSlotTimes(event) {
    let i = event.target.closest("ul").id.split("-").pop();
    const [a,b, slotIndex, inputIndex] = event.target.id.split('-')
    this.tempRules[i].time[slotIndex][inputIndex] = event.target.value
  }

  handleCancel = () => {
    const restriction = document.createElement("restriction-item");
    restriction.setAttribute("rules", JSON.stringify(this.rules));
    this.replaceWith(restriction);
  };

  sortDays(unsorted) {
    const days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return unsorted.sort((a, b) => days.indexOf(a) - days.indexOf(b));
  }
}

customElements.define( "slot-time-restriction-editor", SlotTimeRestrictionEditor);

export default SlotTimeRestrictionEditor;
