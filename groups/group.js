import './components/groupComponent.js'

await buildGroupComponents()

document.querySelector('#create-group-button').addEventListener('click', async (event) => {
    event.preventDefault();
    let { groups = [] } = await chrome.storage.local.get("groups")
    console.log(groups)

    // let error = document.querySelector('#error')
    // if (error) error.remove()

    // console.log("getting value")
    let inputValue = document.getElementById("new-group").value

    if (checkDuplicateValue(groups, inputValue)) {
        document.querySelector('form').insertAdjacentHTML("beforeend", "<p id='error'>There is already a group with this name.</p>")
        return ;
    }

    // Push the new group to the local variable
    groups.push({"name": inputValue, "restrictions": {}})
    
    // Update the groups in Chrome local storage
    await chrome.storage.local.set({ 'groups': groups })

    console.log("groups set")

    console.log(await chrome.storage.local.get('groups'))


})

function checkDuplicateValue(groups, v) {
    console.log(groups)
    
    if (groups.length === 0) {
        return false;
    } else if (groups.findIndex(el => el.name === v) !== -1) {
        return true ;
    }
}

async function buildGroupComponents() {
    let { groups = [] } = await chrome.storage.local.get('groups')
    console.log("building groups with", groups)
    let div = document.getElementById('groups')
    div.textContent = ''
    for (let i = 0 ; i < groups.length ; i++) {
        let restrictions = groups[i].restrictions ? `restrictions="${JSON.stringify(groups[i].restrictions)}"` : ''
        div.insertAdjacentHTML("beforeend", `<a-group id="group-${i}" index="${i}" name="${groups[i].name}" ${restrictions}/>`)
    }
}

document.addEventListener('delete-group', (e) => confirmDelete(e.target.index))

async function confirmDelete(index) {
    if (confirm('Are you sure you want to delete this group?')) {
        let { groups = [] } = await chrome.storage.local.get('groups')
        groups.splice(index, 1); // Remove the group from the array

        // Update the storage with the modified groups array
        await chrome.storage.local.set({ 'groups': groups });

        // Rebuild the group components with the updated groups array
        buildGroupComponents();
    }
}    