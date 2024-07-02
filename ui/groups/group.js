import './components/groupComponent.js'

await buildGroupComponents()

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

    console.log("groups set")
})

async function checkDuplicateValue(v) {
    let {groups = []} = await chrome.storage.local.get('groups')
    if (groups.length === 0) {
        console.log("no groups")
        return false;
    } else if (groups.findIndex(el => el.name === v) !== -1) {
        return true ;
    }
}

async function buildGroupComponents() {
    let { groups = [] } = await chrome.storage.local.get('groups')
    console.log("building groups with", groups)
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

        buildGroupComponents();
    }
}    