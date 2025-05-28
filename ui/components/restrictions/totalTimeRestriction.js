import '../dayColumn.js'

class totalTimeRestrictionEditor extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.temp = { days: this.days, totalTime: this.totalTime };
    this.innerHTML = this.buildHTML();

    this.querySelector("[id^='delete-card-']").addEventListener( "click", async () => this.handleDelete());
    this.querySelector(`input#total-time-${this.index}`).addEventListener( "change", (e) => { this.setTimeInSeconds(e); });
  }

  get index() {
    return this.getAttribute("index");
  }
  set index(i) {
    this.setAttribute("index", i);
  }

  get days() {
    let days = this.getAttribute("days");
    if (!days) return [];
    return JSON.parse(days);
  }
  set days(d) {
    this.setAttribute("days", d);
  }

  get totalTime() {
    return this.getAttribute("totalTime");
  }
  set totalTime(t) {
    this.setAttribute("totalTime", t);
  }

  buildHTML() {
    return `<div class="flex flex-col w-full items-center justify-center mb-2 bg-base-300 p-4">
                    <div class="flex flex-col md:flex-row size-fit justify-around">
                <day-column index='${this.index}' days='${JSON.stringify( this.temp.days)}' restrictionType='totalTime'></day-column>
                <div class="grow flex flex-col mr-2 items-center">
                <table class="table-auto m-4">
                  <thead>
                    <th>Total time (minutes)</th>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input class="input w-full" id='total-time-${this.index}' type='number' value='${ this.temp.totalTime / 60 }' minimum='0' />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
                <button id='delete-card-${ this.index }' class='btn btn-error btn-outline m-4'><span class="material-symbols-outlined"> delete </span></button>
              </div>
            </div>`;
  }

  newCard(index) {
    this.innerHTML = `<div id="total-time-card-${index}" class="total-time-card">
        <span id="delete-card-${ this.index }" class="material-symbols-outlined"> delete </span>
        <day-column index='${this.index}' days='${JSON.stringify( this.days)}' restrictionType='totalTime'></day-column>
        <div id="total-time-card-${this.index}-times" class="time-column">
            <h4>Total Time</h4>
            <input id="total-time-${this.index}" type="number">
        </div>
    </div>`;
    this.querySelector(`#total-time-${index}`).addEventListener( "change", (e) => { this.setTimeInSeconds(e); });
  }

  async handleDelete() {
    this.dispatchEvent(new CustomEvent('deleteCard', {detail : {restrictionType: 'totalTime', i : this.index}, bubbles : true}))
    this.remove();
  }

  setTimeInSeconds(e) {
    this.temp.totalTime = e.target.value;
    this.dispatchEvent(
        new CustomEvent("timeInputChange", {
            detail: {
                restrictionType: "totalTime",
                key: "totalTime",
                time: parseInt(this.temp.totalTime) * 60,
                i: this.index,
            },
            bubbles: true })
    );
  }
}

customElements.define('total-time-restriction-editor', totalTimeRestrictionEditor)