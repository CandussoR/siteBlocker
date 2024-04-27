import SlotTimeRestrictionEditor from './restrictionEditor.js'

class SlotTimeRestriction extends HTMLElement {
    constructor() {
        super()
        this.isEdit = false
        this.handleEdit = this.handleEdit.bind(this)
     }

    connectedCallback() {
        this.innerHTML = this.buildHTML()
        const editButton = document.getElementById("restriction-edit-button")
        editButton.addEventListener('click', this.handleEdit)

    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'rules') this.innerHTML = this.buildHTML(newValue)
    }

    get rules() {
        let rules = this.getAttribute('rules')
        return JSON.parse(rules)
    }

    set rules(r) {
        this.setAttribute('rules', r)
    }

    buildHTML() {
        return `
        <div id='time-slot-container'>
            <div id='time-slot-container__cta'>
                <span id="restriction-edit-button" class='material-symbols-outlined'>edit</span>
                <span id="restriction-remove-button" class='material-symbols-outlined'>remove</span>
            </div>
            <h3>Time Slots</h3>
                ${this.rules.map((element, index) => `

                    <ul id="slot-${index}">

                        <li id="days-${index}"> 
                            On ${element["days"].join(', ')} :

                            <ul id="time-list-${index}">
                                ${element["time"].map((t, i) => `
                                    <li id="time-slot-${i}">from ${t[0]} to ${t[1]}</li>
                                `).join('')}
                            </ul>

                        </li>

                    </ul>`).join('')}
        </div>
        `
    }

    handleEdit() {
        const editor = document.createElement('slot-time-restriction-editor');

        // Set the rules attribute on the editor element
        editor.setAttribute('rules', JSON.stringify(this.rules));
    
        // Replace the SlotTimeRestriction element with the SlotTimeRestrictionEditor element
        this.parentNode.replaceChild(editor, this);  
    }
}

export default SlotTimeRestriction;