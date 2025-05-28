import '../dayColumn.js'
class ConsecutiveTimeRestrictionEditor extends HTMLElement {

    constructor() {
        super()
    }

    connectedCallback() {
        console.log("consecutive time editor connected", this.index, this.days, this.consecutiveTime)
        this.temp = {days: this.days, consecutiveTime : this.consecutiveTime, pause : this.pause};
        console.log(this.temp)
        this.innerHTML = this.buildHTML();

        this.querySelector("[id^='delete-card-']").addEventListener( "click", async () => this.handleDelete());
        let inputs = this.querySelectorAll(`input`);
        inputs.forEach((inp) => inp.addEventListener( "change", (e) => { this.setTimeInSeconds(e); }));
    }

    get index() { return this.getAttribute("index"); }
    set index(i) { this.setAttribute("index", i); }

    get days() {
        let days = this.getAttribute("days");
        if (!days) { return []; }
        return JSON.parse(days);
    }
    set days(d) { this.setAttribute("days", d); }

    get consecutiveTime() { return this.getAttribute("consecutiveTime"); }
    set consecutiveTime(t) { this.setAttribute("consecutiveTime", t); }

    get pause() { return this.getAttribute("pause"); }
    set pause(p) { this.setAttribute("pause", p); }

    buildHTML() {
        return `<div class="flex flex-col w-full items-center justify-center mb-2 bg-base-300 p-4">
                    <div class="flex flex-col md:flex-row size-fit justify-around">
                        <day-column index='${this.index}' days='${JSON.stringify(this.temp.days)}' restrictionType='consecutiveTime'></day-column>
                        
                        <div class="grow flex flex-col mr-2 items-center">
                            <table class="table-auto w-30 m-4">
                                <tbody>
                                    <tr>
                                        <th class="text-wrap">Consecutive Time (m)</th>
                                    </tr>
                                    <tr>
                                        <td>
                                            <input class="input" id='consecutive-time-${this.index}' type='number' value='${ this.temp.consecutiveTime / 60 }' minimum='1' />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th class="text-wrap">Pause (minutes)</th>
                                    </tr>
                                    <tr>
                                        <td>
                                            <input class="input" id='pause-${this.index}' type='number' value='${ this.temp.pause / 60 }' minimum = '1' />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <button id="delete-card-${this.index}" class="btn btn-error btn-outline m-4">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>`;
    }


  async handleDelete() {
    this.dispatchEvent(new CustomEvent('deleteCard', {detail : {restrictionType: 'consecutiveTime', i : this.index}, bubbles : true}))
    this.remove();
  }

  setTimeInSeconds(e) {
    let inputKey = e.target.id.split('-')[0] === 'pause' ? 'pause' : 'consecutiveTime';
    this.temp[inputKey] = e.target.value;

    if (this.temp.pause === 0) return;
    
    this.dispatchEvent(
        new CustomEvent("timeInputChange", {
            detail: {
                restrictionType: "consecutiveTime",
                key: inputKey,
                time: parseInt(this.temp[inputKey]) * 60,
                i: this.index,
            },
            bubbles: true })
    );
  }
}

customElements.define('consecutive-time-restriction-editor', ConsecutiveTimeRestrictionEditor)