import "../components/restrictions/restriction.js"
import './components/siteComponent.js'
import './components/groupComponent.js'
import './components/siteEditor.js'

let { sites = [] } = await chrome.storage.local.get("sites");
let { groups = [] } = await chrome.storage.local.get("groups");

const params = new URLSearchParams(window.location.search);
const type = params.get('t');
const ind = params.get('i');

updateTitle(type)
createMenu(sites, groups, type, ind)
loadComponents(type, {'sites' : sites, 'groups' : groups }, ind)

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
    siteUl.insertAdjacentHTML('beforeend', `<li id="msl${i}"><a href="${currentBaseUrl}?t=s&i=${i}">${sites[i].name}</li></a>`)
    if (selectedIndex && i == selectedIndex && type == 's') {
      document.getElementById(`msl${i}`).classList.add('bg-primary')
    }
  }

  const groupUl = document.getElementById('menu-group-list')
  for (let i=0; i < groups.length; i++) {
    groupUl.insertAdjacentHTML('beforeend', `<li id="mgl${i}"><a href="${currentBaseUrl}?t=g&i=${i}">${groups[i].name}</li></a>`)
    if (selectedIndex && i == selectedIndex && type == 'g') {
      document.getElementById(`mgl${i}`).classList.add('bg-primary')
    }
  }

  for (let a of document.getElementsByTagName('a')) {
    a.addEventListener('click', (e) => {
      if (e.target.search) {
        e.preventDefault()
      }
      console.log(e.target.search)
      const currentSearch = new URLSearchParams(window.location.search).get("t");
      const incomingSearch = new URLSearchParams(e.target.search);
      if (!incomingSearch.size) {
        history.pushState({}, '', e.target.href)
        return
      } else {
      const incomingSearchType = incomingSearch.get('t');
      updateMenu(e, currentSearch, incomingSearchType)

      if (currentSearch != incomingSearchType) {
        updateTitle(incomingSearchType)
        loadComponents(incomingSearchType, {'sites' : sites, 'groups' : groups }, null)
      }
      document.getElementById(incomingSearchType == 's' ? `site-${incomingSearch.get('i')}` :`group-${incomingSearch.get('i')}`).focus()
    }
  })
  }
}

function updateMenu(e, currentSearch, incomingSearch) {
      console.log("need to update menu!", e.target.search)
      // Switching headers highlighting if necessary
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

function updateTitle(incomingSearch) {
  document.querySelector('h1#top').innerHTML = incomingSearch == 's' ? 'Your sites' : 'Your groups'
}

function loadComponents(type, elements, focusedElementIndex) {
  type == 's' ? listSites(elements) : listGroups(elements)
}

function listSites(sitesAndGroups) {

  let { sites, groups } = sitesAndGroups;

  let div = document.getElementById("element-list");
  div.textContent = ''

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
      `<a-site id="site-${i}" tabindex = '${i}' index='${i}' name='${sites[i].name}' ${group} ${restrictions}><a-site/>`
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

function listGroups(sitesAndGroups) {
    let { sites, groups } = sitesAndGroups;
    let div = document.getElementById('element-list')
    console.log("div.textContent", div.textContent)
    div.textContent = ''
    for (let i = 0 ; i < groups.length ; i++) {
        console.log(groups[i].restrictions)
        let restrictions = groups[i].restrictions ? `restrictions='${JSON.stringify(groups[i].restrictions)}'` : ''
        div.insertAdjacentHTML("beforeend", `<a-group id="group-${i}" tabindex="${i}" index="${i}" name="${groups[i].name}" ${restrictions}/>`)
        document.getElementById(`group-${i}`).addEventListener('delete-group', async (e) => await confirmDeleteGroup(e.target.index))
    }
}

async function confirmDeleteGroup(index) {
    let { groups = [] } = await chrome.storage.local.get('groups')
    
    if (confirm('Are you sure you want to delete this group?')) {
        let group = groups.splice(index, 1)[0];

        let {sites = [] } = await chrome.storage.local.get('sites')
        for (let s of sites) {
            if (s.group && s.group === group.name) delete s.group
        }
        await chrome.storage.local.set({sites : sites})

        await chrome.storage.local.set({ groups: groups });

        listGroups(groups);
    }
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