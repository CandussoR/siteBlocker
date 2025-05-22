chargeDynamicHTML()

async function chargeDynamicHTML() {
    updateHost()
    
    document.getElementById('redirect-to-sites')
    .addEventListener('click', () => {
        let url = chrome.runtime.getURL('ui/sites/sites.html')
        chrome.tabs.create({url : url})
    })

    
    document.getElementById('redirect-to-groups')
    .addEventListener('click', () => {
        let url = chrome.runtime.getURL('ui/groups/groups.html')
        chrome.tabs.create({url : url})
    })

    let { sites = [] } = await chrome.storage.local.get('sites')
    let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })
    let activeTabHost = new URL(activeTab[0].url).host;    
    let filtered = sites.find(el => el.name === activeTabHost)
    let restrictedTextContent = filtered && filtered.group 
        ? `This site is already restricted and belongs to the ${filtered.group} group.` 
        : "This site is already restricted."

    if (!filtered) {
        document.getElementById('add-to-sites').addEventListener('click', async () => await addSite())
        return;
    } 
    
    let addToSites = document.getElementById('add-to-sites')
    let deleteFromSites = document.createElement('button')
    deleteFromSites.id = 'delete-site'
    deleteFromSites.innerText = 'Delete from sites'
    deleteFromSites.classList.add('btn', 'btn-outline', 'btn-error')
    addToSites.replaceWith(deleteFromSites)
    deleteFromSites.addEventListener('click', async () => await deleteSite())

    if (!filtered.group) {
        document.getElementById('add').insertAdjacentHTML('afterbegin', '<button id="add-to-group" class="btn btn-outline">Add to a group</button>')
        document.getElementById('add-to-group').addEventListener('click', chooseGroup)
    } else {
        document.getElementById('add').insertAdjacentHTML('afterbegin', '<button id="delete-group">Delete from group</button>')
        document.getElementById('delete-group').addEventListener('click', async () => {
            delete filtered.group
            await chrome.storage.local.set({sites : sites})
            restrictedTextContent = "This site is already restricted."
            document.getElementById('restricted').innerHTML = restrictedTextContent
            document.getElementById('add').insertAdjacentHTML('beforeend', '<button id="add-to-group" class="btn btn-outline">Add to a group</button>')
            document.getElementById('add-to-group').addEventListener('click', chooseGroup)
            location.reload()
            return;
        })
    }
        
    let alreadyRestricted = document.createElement('p')
    alreadyRestricted.id = 'restricted'
    alreadyRestricted.textContent = restrictedTextContent
    document.getElementById('host').replaceWith(alreadyRestricted)
}


async function updateHost() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let activeTabUrl = new URL(tabs[0].url);
        document.getElementById('host').innerHTML = activeTabUrl.host;
      });
  }


async function chooseGroup() {
    let { groups = []} = await chrome.storage.local.get('groups')

    let s = document.getElementById('add-to-group')

    if (groups.length !== 0) {
        replaceButtonByGroupSelectHTML(s, groups)
    } else {
        let h1 = document.getElementById('popup-title');
        let info = document.createElement('p');
        info.id = "no-group-info";
        info.innerHTML = "There is no group yet !";
        h1.insertAdjacentElement("afterend", info);

        replaceByCreateGroupButton(s)
    }
}

function replaceButtonByGroupSelectHTML(s, groups) {
    // DOM creation
    let div = document.createElement('div')
    div.id = "add-to-group-div"

    let form = document.createElement('form')
    form.setAttribute("formenctype", "text/plain")
    form.id = 'form'
    div.appendChild(form)

    let label = document.createElement('label')
    label.setAttribute("for", "select-group")
    label.innerHTML = "Add to a group :"
    label.id = "add-to-group-label"
    form.appendChild(label)

    let select = document.createElement('select')
    select.id = 'select-group'
    select.classList.add('select')
    select.add(new Option('--Choose a group--', ''));

    for (let i=0 ; i < groups.length ; i++) {
        select.add(new Option(groups[i]["name"], i))
    }
    form.appendChild(select)

    form.insertAdjacentHTML('beforeend', '<div id="button-row"><input id="submit" class="btn btn-outline btn-accent" type="submit" value="Add"/><button id="cancel" class="btn btn-outline">Cancel</button></div>')
    
    s.replaceWith(div)

    div.insertAdjacentHTML('beforeend', '<button id="create-new-group" class="btn btn-outline btn-wide"><span class="material-symbols-outlined">add</span>New group</button>')

    document.getElementById('submit').addEventListener('click', async (event) => {
        event.preventDefault()
        let select = document.getElementById('select-group')
        if (select.options[select.selectedIndex].value !== '') {
            let group = groups[select.options[select.selectedIndex].value].name
            let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })
            let activeTabHost = new URL(activeTab[0].url).host;
            await addSiteToGroup(activeTabHost, group)
        }
    })

    document.getElementById('create-new-group').addEventListener('click', () => replaceByCreateGroupButton(div))
}

function replaceByCreateGroupButton(el) {
    let div = document.createElement('div')

    let form = document.createElement('form')
    form.setAttribute("formenctype", "text/plain")
    
    el.replaceWith(div)
    div.appendChild(form)
    div.insertAdjacentHTML('afterbegin', 
        `<form formenctype="text/plain">
        <label for="new-group">Create a group : </label>
        <input class="input-neutral" type="text" id="new-group" required="">
        <div id="button-row">
            <input id="create-group-button" class="btn btn-outline btn-accent" type="submit" value="Create" accesskey="enter">
            <button id="cancel" class="btn btn-outline">Cancel</button>
        </div>
        </form>`)

    document.getElementById('create-group-button').addEventListener('click', async (event) => {
        event.preventDefault();
        let inputValue = document.getElementById("new-group").value
        let site = document.getElementById('host').innerHTML

        await initializeGroupWithSite(inputValue, site)
    
        let successP = document.createElement('p')
        successP.innerHTML = "Successfully added"
        div.appendChild(successP)
    })

    document.getElementById('cancel').addEventListener('click', () => location.reload())
}

async function initializeGroupWithSite(group, site) {
    let { groups = [] } = await chrome.storage.local.get('groups')
    groups.push({"name" : group, "restrictions" : []})
    await chrome.storage.local.set({ groups : groups })

    await addSiteToGroup(site, group)
    location.reload()
}

async function addSiteToGroup(host, groupName) {

    let { sites = [] } = await chrome.storage.local.get('sites')

    let siteIndex = sites.findIndex(s => s.name === host)
    if (siteIndex !== -1) {
        sites[siteIndex]["group"] = groupName
    } else {
        sites.push({"name" : host, 
                    "restrictions" : null,
                    "group": groupName})
    }

    await chrome.storage.local.set({sites : sites})
    location.reload()
}


async function addSite() {
    let { sites = [] } = await chrome.storage.local.get('sites')
    let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })
    let activeTabHost = new URL(activeTab[0].url).host;
    sites.push({"name" : activeTabHost, "restrictions" : null })
    await chrome.storage.local.set({sites : sites})
    location.reload()
}


async function deleteSite() {
    let {sites = []} = await chrome.storage.local.get('sites')
    let activeTab = await chrome.tabs.query({ active: true, currentWindow: true })
    let activeTabHost = new URL(activeTab[0].url).host;
    sites = sites.filter(x => x.name !== activeTabHost);
    await chrome.storage.local.set({sites : sites})
    location.reload()
}