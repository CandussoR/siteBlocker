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
        this.innerHTML = `<div id='${this.name}' class="flex flex-col w-3-4 rounded-lg shadow-xl">
                            <div id='${this.name}-title-row' class="flex w-full items-center justify-center relative p-3 rounded-t-lg">
                                <h2 id="${this.name}-site-name" class="font-mono font-semibold uppercase text-2xl"> ${ this.name} </h2>
                                <div id='${this.name}-buttons' class="absolute right-2 gap-2">
                                    <span id="edit-button" class='material-symbols-outlined hover:cursor-pointer'>edit</span>
                                    <span id="remove-button" class='material-symbols-outlined hover:cursor-pointer'>remove</span>
                                </div>
                            </div>
                            <div id='${this.name}-details'>
                                <div id="group-name" class="flex flex-row items-center justify-center w-full p-3 gap-8">
                                    <h3 class="font-mono uppercase">Group</h3>
                                    <p class="font-mono uppercase font-semibold">${this.group !== null && this.group !== undefined ? this.group : '--'}</p>
                                </div>
                            </div>
                        </div>`

        if (!this.restrictions) {
            return  this.innerHTML
        }

        document
          .getElementById(`${this.name}-details`)
          .insertAdjacentHTML(
            "beforeend",
            `<div id='${ this.name }-restrictions'>
                <h3 class="font-mono font-semibold uppercase text-center">Restrictions</h3>
                <restriction-item item-type="site" restrictions=${JSON.stringify( this.restrictions)} />
            </div>`
          );

        return this.innerHTML
    }

    async handleRemove() {
        let siteName = this.querySelector("[id$='-site-name']").textContent.trim()

        if (confirm(`Are you sure you want to delete ${siteName}?`)) {
            let { sites = [] } = await chrome.storage.local.get('sites')
            let siteIndex = sites.findIndex(s => s.name === siteName)
            sites.splice(siteIndex, 1)
            await chrome.storage.local.set({ sites : sites })

            this.remove()
        }
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