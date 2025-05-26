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
            <div id='${this.name}' class="border-2 border-secondary flex flex-col w-full">
                <div id='${this.name}-title-row' class="bg-primary flex w-full items-center justify-center relative p-3">
                    <h2 id="${this.name}-group-name" class="font-mono font-semibold uppercase"> ${this.name} </h2>
                    <div id='${this.name}-buttons' class="absolute right-2 gap-2">
                        <span id="edit-button" class='material-symbols-outlined'>edit</span>
                        <span id="remove-button" class='material-symbols-outlined'>remove</span>
                    </div>
                </div>
               <div id='${this.name}-details' class="class="flex justify-evenly items-center w-full p-3">
                    <div id='${this.name}-site-listing'>
                        <h3 id="g${this.name}-sites" class="font-mono font-semibold uppercase text-center">Sites</h3>
                    <ul id="site-listing">
                        ${this.sites.length !== 0 ? this.sites.map(s => `<li>${s.name}</li>`).join('') : 'No site yet.'}</p>
                        </ul>
                    </div>
                </div> 
            </div>
                    `


        let div = this.querySelector(`#${this.name}-details`)
        if (this.restrictions) {
            div.insertAdjacentHTML(
                "afterbegin", 
                `<div id='${this.name}-restrictions'>
                    <h3 class="font-mono font-semibold uppercase text-center">Restrictions</h3>
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