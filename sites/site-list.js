import SlotTimeRestriction from "../components/restriction.js"
import SiteComponent from "./siteComponent.js"

if ('customElements' in window) { 
    customElements.define('restriction-item', SlotTimeRestriction) 
    customElements.define('a-site', SiteComponent)
}


listSites()

async function listSites() {
    let { sites = []} = await chrome.storage.local.get('sites')

    let ul = document.getElementById('site-list')

    if (sites.length === 0) {
        ul.insertAdjacentHTML("beforebegin", "<p id='precisions'>No sites yet.</p>")
    }

    for (let i = 0; i < sites.length; i++) {
        let group = sites[i].group ? `group='${sites[i].group}'` : ''
        let restrictions = sites[i].restrictions ? `restrictions='${JSON.stringify(sites[i].restrictions)}'` : ''
        ul.insertAdjacentHTML("beforeend", `<a-site name='${sites[i].site}' ${ group } ${ restrictions }><a-site/>`)
    }
}

