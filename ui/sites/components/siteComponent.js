class SiteComponent extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.innerHTML = this.buildHTML()

        this.querySelector('#edit-button').addEventListener('click', () => this.handleEdit())
        this.querySelector('#remove-button').addEventListener('click', () => this.handleRemove())
    }

    get name() { return this.getAttribute('name'); }
    set name(n) { this.setAttribute('name', n); }

    get index() { return this.getAttribute('index') }
    set index(i) { return this.setAttribute('index', i) }
    
    get group() { return this.getAttribute('group'); }
    set group(g) { this.setAttribute('group', g); }

    get restrictions() { 
        let value = this.getAttribute('restrictions'); 
        return value ? JSON.parse(value) : null
    }
    set restrictions(r) { console.log(r) 
        this.setAttribute('restrictions', r); }

    buildHTML() {
        this.innerHTML = `<div id='${this.name}'>
                            <div id='${this.name}-title-row'>
                                <h2 id="${this.name}-site-name"> ${this.name} </h2>
                                <div id='${this.name}-buttons'>
                                    <span id="edit-button" class='material-symbols-outlined'>edit</span>
                                    <span id="remove-button" class='material-symbols-outlined'>remove</span>
                                </div>
                            </div>
                            <div id='${this.name}-details'>
                                <div id="group-name">
                                    <h3>Group </h3>
                                    <p>${this.group !== null && this.group !== undefined ? this.group : '--'}</p>
                                </div>
                            </div>
                        </div>`

        if (!this.restrictions) {
            return  this.innerHTML
        }

        document.getElementById(`${this.name}-details`).insertAdjacentHTML("beforeend", `<div id='${this.name}-restrictions'><h3>Restrictions</h3><restriction-item item-type="site" restrictions=${JSON.stringify(this.restrictions)} /></div>`)

        return this.innerHTML
    }

    async handleRemove() {
        let siteName = this.querySelector("[id$='-site-name']").textContent.trim()

        let { sites = [] } = await chrome.storage.local.get('sites')
        let siteIndex = sites.findIndex(s => s.name === siteName)
        sites.splice(siteIndex, 1)
        await chrome.storage.local.set({ sites : sites })

        this.remove()
    }

    handleEdit() {
        const editor = document.createElement("site-editor");
        if (this.restrictions) editor.setAttribute("restrictions", JSON.stringify(this.restrictions));
        editor.setAttribute("name", this.name)
        if (this.group) editor.setAttribute("group", this.group)
        this.replaceWith(editor);
    }

}

customElements.define('a-site', SiteComponent)

export default SiteComponent