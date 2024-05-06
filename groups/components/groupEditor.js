import '../../components/restrictions/restrictionEditor.js'
import '../components/groupComponent.js'

class GroupEditor extends HTMLElement {
  constructor() {
    super();
  }

  async connectedCallback() {
    let data = await chrome.storage.local.get('sites')

    this.allSites = data.sites
    this.allSitesName = data.sites.map(el => el.name)
    this.tempSites = this.allSites;
    this.tempGroup = { name: this.name, restrictions: this.restrictions };
    this.buildHTML();

    this.querySelector('#group-name').addEventListener('change', (e) => this.updateGroupName(e))
    console.log(this.innerHTML, this.querySelector('#submit'))
    this.querySelector('#submit').addEventListener('click', (e) => this.handleSubmit(e))
    this.querySelector('#cancel').addEventListener('click', () => this.handleCancel())
    let addSite = this.querySelector('#add-site')
    if (addSite !== null) this.querySelector('#add-site').addEventListener('click', () => this.createSiteSelect())
  }

  get index() { return this.getAttribute("i"); }
  set index(i) { return this.setAttribute("i", i); }

  get name() { return this.getAttribute("name"); }
  set name(n) { this.setAttribute("name", n); }

  get restrictions() { return JSON.parse(this.getAttribute("restrictions")); }
  set restrictions(r) { this.setAttribute("restrictions", r); }

  get sites() { return JSON.parse(this.getAttribute("sites")); }
  set sites(s) { this.setAttribute("sites", s); }

  buildHTML() {
    this.innerHTML = `
            <div id="${this.name}-editor">
              <form id="group-form" method="post">
                <input type="text" value="${ this.tempGroup.name }" id="group-name">
                <div id="group-sites">
                <span class="sites-label">Sites : </span>
                  <ul id="sites-in-group"></ul>
                  <span id="add-site" class="material-symbols-outlined">add</span>
                </div>
                <restriction-editor restrictions="${JSON.stringify(this.restrictions)}"></restriction-editor>
                <input id="submit" type="submit" value="Save modifications">
                <button id="cancel">Cancel</button>
              </form>
            </div>
        `;

      let label = this.querySelector("sites-label")

      if (this.sites.length === 0) {
        this.createSiteSelect()
      } else {
        let list =`${this.sites.map((s,i) => `
                  <li id="site-${i}">
                    ${s.name} 
                    <span id="remove-site-${i}" class='material-symbols-outlined'>remove</span>
                  </li>`).join("")}`
        this.querySelector('#sites-in-group').insertAdjacentHTML("beforeend", list)

        let removeButtons = this.querySelectorAll("[id^='remove-site-']")
        removeButtons.forEach(button => button.addEventListener('click', (e) => {
          this.removeFromGroup(e)
          this.deleteTempLi(e)
      }))
    }
  }

  createSiteSelect() {
    let addButton = this.querySelector('#add-site')
    let possibleSites = this.allSites.filter(s => (s.group !== undefined || s.group !== '') && s.group !== this.name).map(s => s.name)
    let divSelect = document.createElement('div')
    divSelect.id = 'site-select-add'
    let selectHtml = `<select id="site-select-add">
                        <option value="" selected>--Choose a site to add--</option>
                            ${ possibleSites.map( (el) => `<option value="${el}">${el}</option>`).join("") }
                      </select>
                      <button id="cancel-site-modification">Cancel</button>`
    divSelect.insertAdjacentHTML('afterbegin', selectHtml)
    addButton.replaceWith(divSelect)
    this.querySelector('#site-select-add').addEventListener('change', (e) => {
      this.addSiteToGroup(e)
      this.addTempSiteToList(e)
    }
    )
    this.querySelector('#cancel-site-modification').addEventListener('click', () => divSelect.replaceWith(addButton))
  }

  addSiteToGroup(e) {
    console.log(this.tempSites)
    let siteIndex = this.tempSites.findIndex(x => x.name === e.target.value)
    console.log(siteIndex)
    this.tempSites[siteIndex]["group"] = this.tempGroup.name
  }

  addTempSiteToList(e) {
    let ul = this.querySelector('#sites-in-group')
    let numberLi = ul.querySelectorAll('li').length
    ul.insertAdjacentHTML('beforeend', `<li id="site-${numberLi}">
                                          ${e.target.value} 
                                          <span id="remove-site-${numberLi}" class='material-symbols-outlined'>remove</span>
                                        </li>`)
    this.querySelector(`#site-${numberLi}`).addEventListener('click', (e) => {
      this.removeFromGroup(e)
      this.deleteTempLi(e)
    })
  }

  removeFromGroup(e) {
  }

  deleteTempLi(e) {
  }

  updateGroupName(e) {
    this.tempGroup.name = e.target.value
    for (let i=0 ; i < this.tempSites.length ; i++) {
        if (this.tempSites[i].group && this.tempSites[i].group === this.name) this.tempSites[i].group = e.target.value
    }
  }

  async handleSubmit(e) {
    e.preventDefault()

    let groups = await chrome.storage.local.get('groups')
    groups[this.index] = {"name": this.tempGroup.name, "restrictions" : this.querySelector('restriction-editor').getModifiedData()}

  }
}

customElements.define('group-editor', GroupEditor)