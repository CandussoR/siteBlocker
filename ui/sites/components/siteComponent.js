class SiteComponent extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        console.log("site properties", this.name, this.group, this.restrictions)
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
        this.innerHTML = `<div id='site'>
                        <div id='buttons'>
                            <span id="edit-button" class='material-symbols-outlined'>edit</span>
                            <span id="remove-button" class='material-symbols-outlined'>remove</span>
                        </div>
                        <p id="site-name"> ${this.name} </p>
                        <p id="group-name">
                            <span class="group-label">Group : </span>
                            ${this.group !== null && this.group !== undefined ? this.group : '--'}
                        </p>
                    </div>`

        if (!this.restrictions) {
            return  this.innerHTML
        }

        this.querySelector('#group-name').insertAdjacentHTML("afterend", `<restriction-item item-type="site" restrictions=${JSON.stringify(this.restrictions)} />`)

        return this.innerHTML
    }

    async handleRemove() {
        let siteName = this.querySelector('#site-name').textContent.trim()

        let { sites = [] } = await chrome.storage.local.get('sites')
        console.log("sites before", sites)
        let siteIndex = sites.findIndex(s => s.name === siteName)
        sites.splice(siteIndex, 1)
        console.log("sites after", sites)
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