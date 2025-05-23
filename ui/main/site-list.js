import "../components/restrictions/restriction.js"
import './components/siteComponent.js'
import './components/siteEditor.js'

let { sites = [] } = await chrome.storage.local.get("sites");
let { groups = [] } = await chrome.storage.local.get("groups");

const params = new URLSearchParams(window.location.search);
const type = params.get('t');
const ind = params.get('i');

createMenu(sites, groups, type, ind)
loadComponentsAndFocus(type, {'sites' : sites, 'groups' : groups }, ind)
// listSites(sites)

function createMenu(sites, groups, type, selectedIndex) {
  if (!sites && !groups) return;

  let selected = null
  if (!type) {
    selected = "settings"
  }
  else {
    selected = type + '-summary'
    document.getElementById(type + '-details').setAttribute('open', true)
  }
  document.getElementById(selected).classList.remove('btn-ghost')
  document.getElementById(selected).classList.add('btn-primary')
  
  const currentBaseUrl = location.pathname;
  const siteUl = document.getElementById('menu-site-list')
  for (let i=0; i < sites.length; i++) {
    console.log("populating menu with site", sites[i])
    siteUl.insertAdjacentHTML('beforeend', `<li id="ml${i}"><a href="${currentBaseUrl}?t=s&i=${i}">${sites[i].name}</li></a>`)
    if (selectedIndex && i == selectedIndex) {
      document.getElementById(`ml${i}`).classList.add('bg-primary')
    }
  }

  const groupUl = document.getElementById('menu-group-list')
  for (let i=0; i < groups.length; i++) {
    console.log("populating menu with group", groups[i])
    groupUl.insertAdjacentHTML('beforeend', `<li><a href="${currentBaseUrl}?t=g&i=${i}">${groups[i].name}</li></a>`)
  }

  for (let a of document.getElementsByTagName('a')) {
    a.addEventListener('click', (e) => updateMenu(e))
  }
}

function updateMenu(e) {
      e.preventDefault();

      // Switching headers highlighting if necessary
      const currentSearch = new URLSearchParams(window.location.search).get("t");
      const incomingSearch = new URLSearchParams(e.target.search).get("t");
      if (currentSearch != incomingSearch) {
        document .querySelector(`summary#${currentSearch}-summary`).classList.remove("btn-primary")
        document .querySelector(`summary#${currentSearch}-summary`).classList.add("btn-ghost")
        document .querySelector(`summary#${incomingSearch}-summary`).classList.add("btn-primary")
        document .querySelector(`summary#${incomingSearch}-summary`).classList.remove("btn-ghost")
      }

      // Switching colors between old and new
      document.querySelector('li.bg-primary').classList.remove('bg-primary')
      e.target.parentElement.classList.add('bg-primary');

      // Updating the URL without reload
      history.pushState({}, '', e.target.href)
}


function loadComponentsAndFocus(type, elements, focusedElementIndex) {
  type == 's' ? listSites(elements) : listGroups(elements)
}

function listSites(sitesAndGroups) {
//   // let { sites = [] } = await chrome.storage.local.get("sites");
//   let { groups = [] } = await chrome.storage.local.get("groups");

  let { sites, groups } = sitesAndGroups;
  console.log(sites, groups)

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
      `<a-site id='s-{0}' index='${i}' name='${sites[i].name}' ${group} ${restrictions}><a-site/>`
    );
    // document.getElementById('s-' + i).addEventListener('click', (e) => focusOn('site', e.id));
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


// window.onhashchange = () => {
//   let all = document.querySelectorAll('.site-menu-item')
//   let prev = document.querySelector('.site-menu-item.selected')
//   let sth = window.location.hash
//   let curr = document.querySelector(`[href='${sth}']`)
//   prev.classList.remove('selected')
//   if (all.find(x => x.hash === sth)) {
//     curr.classList.add('selected')
//   }
// }

function listGroups(groups) {
  console.log("Groups not yet listed")
}