import { updateMenuGroups } from '../../common/menu.js'
import '../../components/restrictions/restrictionEditor.js'
import './siteComponent.js'

class SiteEditor extends HTMLElement {
    constructor() {
        super()
    }
    
    connectedCallback() {
        this.dispatchEvent(new Event('edition', { bubbles: true, composed: true }))

        this.temp = {"name" : this.name, "group" : this.group, "restrictions" : this.restrictions}
        this.innerHTML = this.buildHTML()

        this.querySelector('#site-name').addEventListener('change', (e) => { this.temp.name = e.target.value })
        this.querySelector('#group-select').addEventListener('change', (e) => this.modifyGroupName(e))
        this.querySelector('#add-group').addEventListener('click', (e) => this.renderCreateGroup(e))
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
        this.innerHTML = `<div id='site' class="flex flex-col rounded-lg shadow-xl p-3">
                        <form id="siteForm" method="post">
                        <div class="flex flex-col md:flex-row gap-3 md:gap-7 m-5 items-center">
                            <label for="site-name" class="font-mono font-semibold uppercase"> Host : </label>
                            <input name="site-name" class="input focus:input-primary" type="text" value="${this.temp.name}" id="site-name">
                        </div>
                        <div id="group-name" class="flex flex-col md:flex-row gap-3 md:gap-7 m-5 items-center">
                            <label for="group-select" class="font-mono font-semibold uppercase">Group : </label>
                                <select id="group-select" name="group-select" class="select">
                                    <option value="${this.temp.group ? this.temp.group : ''}" selected>${this.temp.group ? this.temp.group : "Select a group"}</option>
                                    ${this.allGroups !== null && this.allGroups !== undefined && this.allGroups.length !== 0 ? this.allGroups.map((el) => `<option value="${el}">${el}</option>`).join('') : ''}
                                </select>
                                <button id="add-group" class="btn btn-accent btn-outline" title="Add to a new group"><span class="material-symbols-outlined">add</span></button>
                        </div>
                        <div id="submit-div" class="flex gap-7 justify-center align-center m-5">
                            <input id="submit" class="btn btn-accent" type="submit" value="Save modifications">
                            <button id="cancel" class="btn">Cancel</button>
                        </div>
                        </form>
                    </div>`;
        const submit = this.querySelector('form div#submit-div')
        submit.insertAdjacentHTML("beforebegin", `<restriction-editor restrictions=${ JSON.stringify(this.temp.restrictions)} />`);
        return this.innerHTML;
    }

    async renderCreateGroup(e) {
        e.preventDefault()
        let groupSelectAdd = document.getElementById("add-group");

        let div = document.createElement("div");
        div.id = 'cgdiv'
        div.classList.add('flex', 'flex-col', 'w-full', 'justify-center')
        div.insertAdjacentHTML("afterbegin",
          `<div class="flex gap-7 justify-center items-center w-full">
            <label for="new-group" class="font-mono font-semibold uppercase">New group name : </label>
            <input id="group-value" class="input" type="text" minsize="1" required>
            </div>
            <div class="w-full flex justify-center items-center gap-7 p-2">
            <button id="create-new-group" class="btn btn-accent">Add site to group</button> <button id="cancel-group-modification" class="btn">Cancel</button>
            </div>`);
        div.querySelector("#create-new-group").addEventListener("click", (e) => this.createGroupAndAddSite(e));
        div.querySelector("#cancel-group-modification").addEventListener("click", () => { div.replaceWith(groupSelectAdd); });

        e.target.closest('div').after(div);
        groupSelectAdd.classList.add('invisible')
    }

    async createGroupAndAddSite(e) {
        e.preventDefault()
        let newGroup = document.getElementById('group-value').value
        let { groups } = await chrome.storage.local.get('groups')
        groups.push({"name" : newGroup, "restrictions" : null})
        await chrome.storage.local.set({ groups : groups })
        updateMenuGroups(groups)
        this.temp.group = newGroup
        this.setAttribute('groups', JSON.stringify(groups.map(x => x.name)))
        this.updateHTMLAfterNewGroup()
    }

    updateHTMLAfterNewGroup() {
        const select = document.getElementById('group-select')
        select.innerText = ''
        select.insertAdjacentHTML("afterbegin",
                                    `<option value="${this.temp.group ? this.temp.group : ''}" selected>${this.temp.group ? this.temp.group : "Select a group"}</option>
                                    ${this.allGroups !== null && this.allGroups !== undefined && this.allGroups.length !== 0 ? this.allGroups.map((el) => `<option value="${el}">${el}</option>`).join('') : ''}`
        )
        document.getElementById('cgdiv').remove();
        document.getElementById("add-group").classList.remove('invisible');
    }

    modifyGroupName(e) {
        e.preventDefault()
        this.temp.group = e.target.value
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

        const data = await chrome.storage.local.get('sites')
        let siteIndex = data.sites.map(x => x.name).findIndex(x => x === this.name)
        data.sites[siteIndex] = site
        await chrome.storage.local.set({sites : data.sites})

        const s = document.createElement("a-site");
        s.setAttribute("name", site.name);
        s.setAttribute("group", site.group);
        if (site.restrictions) {
            s.setAttribute("restrictions", JSON.stringify(site.restrictions));
        }
        this.replaceWith(s);
    }

}

customElements.define('site-editor', SiteEditor)