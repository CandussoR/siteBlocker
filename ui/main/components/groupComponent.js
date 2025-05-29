import '../components/groupEditor.js'
import '../../components/restrictions/restriction.js'

class GroupComponent extends HTMLElement {
    constructor() {
        super()
    }

    async connectedCallback() {
        let sites = await chrome.storage.local.get('sites')
        this.sites = sites.sites.filter(x => x.group === this.name)
        this.innerHTML = null
        this.buildHTML()
        this.querySelector('#edit-button').addEventListener('click', () => this.replaceComponent())
        this.querySelector('#remove-button').addEventListener('click', (e) => this.dispatchEvent(new Event('delete-group', {bubbles : true, composed : true} )))
    }

    get id() { return this.getAttribute('id') }
    set id(id) { return this.setAttribute('id', id) }

    get index() { return this.getAttribute('index') }
    set index(i) { return this.setAttribute('index', i) }

    get name() { return this.getAttribute('name') }
    set name(n) { this.setAttribute('name', n) }

    get restrictions() { return JSON.parse( this.getAttribute('restrictions') ) }
    set restrictions(r) { this.setAttribute('restrictions', r) }

    buildHTML() {
        this.innerHTML = `
            <div id='${this.name}' class="flex flex-col w-full rounded-lg shadow-xl">
                <div id='${this.name}-title-row' class="flex w-full items-center justify-center relative p-3">
                    <h2 id="${this.name}-group-name" class="font-mono font-semibold uppercase text-2xl"> ${this.name} </h2>
                    <div id='${this.name}-buttons' class="absolute right-2 gap-2">
                        <span id="edit-button" class='material-symbols-outlined hover:cursor-pointer'>edit</span>
                        <span id="remove-button" class='material-symbols-outlined hover:cursor-pointer'>remove</span>
                    </div>
                </div>
                <div id='${this.name}-details' class="class="flex items-center w-full p-3">

                <h3 id="g${this.name}-sites" class="font-mono font-semibold uppercase text-center mt-5">Sites</h3>
                    <p id="site-listing" class="text-center p-4 w-3/4 mx-auto">
                        ${this.sites.length !== 0 ? this.sites.map(s => `${s.name}`).join(', ') : 'No site yet.'}</p>
                    </div>
                </div> 
            </div>
                    `


        let div = this.querySelector(`#${this.name}-details`)
        if (this.restrictions) {
            div.insertAdjacentHTML(
                "afterbegin", 
                `<div id='${this.name}-restrictions'>
                    <h3 class="font-mono font-semibold uppercase text-center mt-3">Restrictions</h3>
                    <restriction-item item-type="group" restrictions='${JSON.stringify(this.restrictions)}' />
                </div>`)
        }
    }

    replaceComponent() {
        let editor = document.createElement('group-editor')
        editor.setAttribute('index', this.index)
        editor.setAttribute('name', this.name)
        editor.setAttribute('sites', JSON.stringify(this.sites.map(x => x.name)))
        if (this.restrictions) editor.setAttribute("restrictions", JSON.stringify(this.restrictions));
        this.replaceWith(editor)
    }
}

customElements.define('a-group', GroupComponent)