import '../../components/restrictions/restrictionEditor.js'
import './siteComponent.js'

class SiteEditor extends HTMLElement {
    constructor() {
        super()
    }
    
    connectedCallback() {
        this.dispatchEvent(new Event('edition', { bubbles: true, composed: true }))

        console.log("restrictions", this.restrictions)
        this.temp = {"name" : this.name, "group" : this.group, "restrictions" : this.restrictions}
        this.innerHTML = this.buildHTML()

        this.querySelector('#site-name').addEventListener('change', (e) => { this.temp.name = e.target.value })
        this.querySelector('#group-select').addEventListener('change', (e) => this.modifyName(e))
        this.querySelector('#add-group').addEventListener('click', () => this.renderCreateGroup())
        this.querySelector('form').addEventListener('submit', (event) => this.handleSubmit(event), false)
        this.querySelector('form button#cancel').addEventListener('click', () => this.handleCancel())
    }

    disconnectedCallback() {}

    onAttributeChange(name, oldValue, newValue) {}

    get name() { return this.getAttribute('name'); }
    set name(n) { this.setAttribute('name', n); }

    get group() { return this.getAttribute('group'); }
    set group(g) { this.setAttribute('group', g); }

    get restrictions() {
        let value = this.getAttribute('restrictions');
        return value ? JSON.parse(value) : null;
    }
    set restrictions(r) { this.setAttribute('restrictions', r); }

    get allGroups() { return JSON.parse(this.getAttribute('groups')); }
    set allGroups(g) { this.setAttribute('groups', g); }

    buildHTML() {
        this.innerHTML = `<li id='${this.temp.name}'>
                    <div id='site'>
                        <form id="siteForm" method="post">
                        <input type="text" value="${this.temp.name}" id="site-name">
                        <div id="group-name">
                            <span class="group-label">Group : </span>
                            <div id="group-select-add">
                                <select id="group-select">
                                    <option value="${this.temp.group ? this.temp.group : ''}" selected>${this.temp.group ? this.temp.group : "Select a group"}</option>
                                    ${this.allGroups !== null && this.allGroups !== undefined && this.allGroups.length !== 0 ? this.allGroups.map((el) => `<option value="${el}">${el}</option>`).join('') : ''}
                                </select>
                                <span id="add-group" class="material-symbols-outlined">add</span>
                            </div>
                        </div>
                            <input id="submit" type="submit" value="Save modifications">
                            <button id="cancel">Cancel</button>
                        </form>
                    </div>
                </li>`;
        const submit = this.querySelector('form input#submit')
        submit.insertAdjacentHTML("beforebegin", `<restriction-editor restrictions=${ JSON.stringify(this.temp.restrictions)} />`);
        return this.innerHTML;
    }

    async renderCreateGroup() {
        let groupSelectAdd = document.getElementById("group-select-add");

        let div = document.createElement("div");
        div.insertAdjacentHTML( "afterbegin",
          `<input id="group-value" type="text"> <button id="create-new-group">Add</button> <button id="cancel-group-modification">Cancel</button>`);
        div .querySelector("#create-new-group")
          .addEventListener("click", (e) => this.createGroup(e));
        div .querySelector("#cancel-group-modification")
          .addEventListener("click", () => { div.replaceWith(groupSelectAdd); });

        groupSelectAdd.replaceWith(div);
    }

    async createGroup(e) {
        e.preventDefault()
        let newGroup = document.getElementById('group-value').value
        let allGroups = this.allGroups || []
        allGroups.push({"name" : newGroup, "restrictions" : {}})
        await chrome.storage.local.set({ groups : allGroups })
        this.temp.group = newGroup.name
        this.buildHTML()
    }

    modifyName(e) {
        e.preventDefault()
        this.temp.name = e.target.value
    }

    handleCancel() {
        const site = document.createElement("a-site");
        site.setAttribute("name", this.name);
        site.setAttribute("group", this.group || '--');
        site.setAttribute("restrictions", JSON.stringify(this.restrictions));
        this.replaceWith(site);
    }

    async handleSubmit(e) {
        e.preventDefault()
        let site = {"name" : this.temp.name,
                    "group" : this.temp.group || '',
                    "restrictions" : this.querySelector('restriction-editor').getModifiedData()
        }

        console.log("site at submit", JSON.stringify(site))

        const data = await chrome.storage.local.get('sites')
        let siteIndex = data.sites.map(x => x.name).findIndex(x => x === this.name)
        data.sites[siteIndex] = site
        await chrome.storage.local.set({sites : data.sites})

        const s = document.createElement("a-site");
        s.setAttribute("name", site.name);
        s.setAttribute("group", site.group);
        s.setAttribute("restrictions", JSON.stringify(site.restrictions));
        this.replaceWith(s);
    }

}

customElements.define('site-editor', SiteEditor)