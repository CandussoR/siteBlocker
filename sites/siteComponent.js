class SiteComponent extends HTMLElement {
    constructor() {
        super()
        console.log("constructed")
    }

    connectedCallback() {
        console.log("connected")
        console.log(this.name, this.group, this.restrictions)
        this.innerHTML = this.buildHTML()
    }

    disconnectedCallback() {
    }

    attributeChangeCallback(name, oldValue, newValue) {
    }

    get name() { return this.getAttribute('name'); }
    set name(n) { this.setAttribute('name', n); }

    get group() { return this.getAttribute('group'); }
    set group(g) { this.setAttribute('group', g); }

    get restrictions() { 
        let value = this.getAttribute('restrictions'); 
        return value ? JSON.parse(value) : null
    }
    set restrictions(r) { console.log(r) 
        this.setAttribute('restrictions', r); }

    buildHTML() {
        this.innerHTML = `<li id='${this.name}'>
                    <div id='site'>
                        <div id='buttons'>
                            <span id="edit-button" class='material-symbols-outlined'>edit</span>
                            <span id="remove-button" class='material-symbols-outlined'>remove</span>
                        </div>
                        <p id="site-name"> ${this.name} </p>
                        <p id="group-name">
                            <span class="group-label">Group : </span>
                            ${this.group !== null && this.group !== undefined ? this.group : '--'}
                        </p>
                    </div>
                </li>`
        if (this.restrictions && this.restrictions.slots) {
            document.querySelector('#group-name').insertAdjacentHTML("afterend", `<restriction-item rules=${JSON.stringify(this.restrictions.slots)} />`)
            console.log(this.restrictions.slots)
        }

        return this.innerHTML
    }

    handleRemove() {
    }

    createRestrictionComponent() {
        console.log(this.restrictions)
    }

}

export default SiteComponent