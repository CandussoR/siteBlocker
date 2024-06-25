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
            <div id='${this.name}'>
                <div id='${this.name}-buttons'>
                    <span id="edit-button" class='material-symbols-outlined'>edit</span>
                    <span id="remove-button" class='material-symbols-outlined'>remove</span>
                </div>
                    <p id="${this.name}-group-name"> ${this.name} </p>
                    <p id="g${this.name}-sites">
                  </p>
                  <p id="site-listing"><span class="sites-label">Sites : </span>
                    ${this.sites.length !== 0 ? this.sites.map(s => s.name).join(', ') : 'No site yet.'}</p>
                    </p>
                    </div>
                    `
        let div = this.querySelector(`#${this.name}`)
        if (this.restrictions) {
            div.insertAdjacentHTML("beforeend", `<restriction-item item-type="group" restrictions='${JSON.stringify(this.restrictions)}' />`)
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