import './components/groupComponent.js'

let { groups = [] } = await chrome.storage.local.get('groups')
await buildGroupComponents(groups)
createGroupMenu(groups)

document.querySelector('#create-group-button').addEventListener('click', async (event) => {
    event.preventDefault();
    let { groups = [] } = await chrome.storage.local.get("groups")

    let error = document.querySelector('#error')
    if (error) error.remove()

    let inputValue = document.getElementById("new-group").value

    let isDuplicate = await checkDuplicateValue(groups, inputValue)
    if (isDuplicate) {
        document.querySelector('form').insertAdjacentHTML("beforeend", "<p id='error'>There is already a group with this name.</p>")
        return ;
    }

    // Push the new group to the local variable
    groups.push({"name": inputValue, "restrictions": {}})
    
    // Update the groups in Chrome local storage
    await chrome.storage.local.set({ groups: groups })

    await buildGroupComponents(groups)
})

async function checkDuplicateValue(v) {
    let {groups = []} = await chrome.storage.local.get('groups')
    if (groups.length === 0) {
        return false;
    } else if (groups.findIndex(el => el.name === v) !== -1) {
        return true ;
    }
}

async function buildGroupComponents(groups) {
    let div = document.getElementById('group-list')
    div.textContent = ''
    for (let i = 0 ; i < groups.length ; i++) {
        console.log(groups[i].restrictions)
        let restrictions = groups[i].restrictions ? `restrictions='${JSON.stringify(groups[i].restrictions)}'` : ''
        div.insertAdjacentHTML("beforeend", `<a-group id="group-${i}" index="${i}" name="${groups[i].name}" ${restrictions}/>`)
    }
}

document.addEventListener('delete-group', (e) => confirmDelete(e.target.index))

async function confirmDelete(index) {
    let { groups = [] } = await chrome.storage.local.get('groups')
    
    if (confirm('Are you sure you want to delete this group?')) {
        let group = groups.splice(index, 1)[0];

        let {sites = [] } = await chrome.storage.local.get('sites')
        for (let s of sites) {
            if (s.group && s.group === group.name) delete s.group
        }
        await chrome.storage.local.set({sites : sites})

        await chrome.storage.local.set({ groups: groups });

        buildGroupComponents(groups);
    }
}    

function createGroupMenu(groups) {
    const template = document.querySelector('#group-anchor')
    let nav = document.getElementById('group-nav')
  
    for (let g of groups) {
      
      let clone = document.importNode(template.content, true);
      let a = clone.querySelector('.group-menu-item')
      a.href = `#${g.name}`
      a.textContent = g.name
      if (nav.getElementsByTagName('a').length === 0) {
        a.classList.add('selected')
      }
      nav.appendChild(clone)
    }
  }
  
  window.onhashchange = () => {
    let all = document.querySelectorAll('.group-menu-item')
    let prev = document.querySelector('.group-menu-item.selected')
    let sth = window.location.hash
    let curr = document.querySelector(`[href='${sth}']`)
    prev.classList.remove('selected')
    if (all.find(x => x.hash === sth)) {
      curr.classList.add('selected')
    }
  }
  