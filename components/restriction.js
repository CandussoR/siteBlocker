class SlotTimeRestriction extends HTMLElement {

    static observedAttributes = ['rules']

    constructor() {
        super()
        this.isEdit = false
        this.innerHTML = null
    }

    connectedCallback() {
    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'rules') this.innerHTML = this.buildHTML(JSON.parse(newValue))
        
    }

    get rules() {
        return this.getAttribute('rules')
    }

    set rules(r) {
        this.setAttribute('rules', r)
    }

    // Rules : [ {"days" : [], "time" : [ [] ] }
    buildHTML(rules) {
        let restrictedTimeInDay = ``
        for (let i=0 ; i < rules.length ; i++) {
            restrictedTimeInDay += this.buildRestrictedTimeFor(i, rules[i]["days"], rules[i]["time"])
        }

        let html = 
        `
        <div id='time-slot-container'>
            <div id='time-slot-container__cta'>
                <span id="edit-button" class='material-symbols-outlined'>edit</span>
                <span id="remove-button" class='material-symbols-outlined'>remove</span>
            </div>
            <h3>Time Slots</h3>
            ${restrictedTimeInDay}
        </div>
        `
        return html
    }

    buildRestrictedTimeFor(index, day, times) {
        let result = `<p id="day-${index}"> On ${day.join(", ")} : `

        for (let j=0 ; j < times.length ; j++) {
            if (j===0) result += `from ${times[j][0]} to ${times[j][1]}`
            else result += `, from ${times[j][0]} to ${times[j][1]}`
        }

        result += '</p>'
        return result
    }

}

export default SlotTimeRestriction;