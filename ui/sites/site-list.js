import "../components/restrictions/restriction.js"
import './components/siteComponent.js'
import './components/siteEditor.js'

let { sites = [] } = await chrome.storage.local.get("sites");

listSites(sites)
createSiteMenu(sites)

async function listSites(sites) {
  // let { sites = [] } = await chrome.storage.local.get("sites");
  let { groups = [] } = await chrome.storage.local.get("groups");

  let div = document.getElementById("site-list");

  if (sites.length === 0) {
    div.insertAdjacentHTML(
      "beforebegin",
      "<p id='precisions'>No sites yet.</p>"
    );
  }

  for (let i = 0; i < sites.length; i++) {
    let group = sites[i].group ? `group='${sites[i].group}'` : "";
    let restrictions = sites[i].restrictions
      ? `restrictions='${JSON.stringify(sites[i].restrictions)}'`
      : "";
    div.insertAdjacentHTML(
      "beforeend",
      `<a-site index='${i}' name='${sites[i].name}' ${group} ${restrictions}><a-site/>`
    );
  }

  document.addEventListener("edition", () => {
    let editors = div.querySelectorAll("site-editor");
    if (groups.length !== 0)
      editors.forEach((editor) => {
        editor.setAttribute(
          "groups",
          JSON.stringify(groups.map((g) => g.name))
        );
      });
  });
}

function createSiteMenu(sites) {
  const template = document.querySelector('#site-anchor')
  let nav = document.getElementById('sites-nav')
  console.log(nav)

  for (let s of sites) {
    
    let clone = document.importNode(template.content, true);
    let a = clone.querySelector('.site-menu-item')
    a.href = `#${s.name}`
    a.textContent = s.name
    if (nav.getElementsByTagName('a').length === 0) {
      a.classList.add('selected')
    }
    nav.appendChild(clone)
  }
}

window.onhashchange = () => {
  let all = document.querySelectorAll('.site-menu-item')
  let prev = document.querySelector('.site-menu-item.selected')
  let sth = window.location.hash
  let curr = document.querySelector(`[href='${sth}']`)
  prev.classList.remove('selected')
  if (all.find(x => x.hash === sth)) {
    curr.classList.add('selected')
  }
}


