chargeDynamicHTML()

async function chargeDynamicHTML() {
    updateHost()
    
    document.getElementById('redirect-to-sites')
    .addEventListener('click', () => {
        let url = chrome.runtime.getURL('sites/sites.html')
        chrome.tabs.create({url : url})
    })

    let { sites = [] } = await chrome.storage.local.get('sites')
    let currentSite = document.getElementById('host')
    let filtered = sites.filter(el => el.site === currentSite.innerHTML)
    if (filtered.length > 0 && filtered[0].group !== undefined) {
        restrictedSiteInfo(currentSite)
        document.getElementById('add-to-group').remove()
        let newButton = document.createElement('button')
        newButton.id = "restrictions-info"
        newButton.innerHTML = "See infos"
        document.getElementById('host').insertAdjacentElement("afterend", newButton)
    }
    else {
        document.getElementById('add-to-group').addEventListener('click', chooseGroup)
    }

}


async function updateHost() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let activeTabUrl = new URL(tabs[0].url);
        document.getElementById('host').innerHTML = activeTabUrl.host;
      });
  }


async function restrictedSiteInfo(currentSite) {
        let newP = document.createElement('p')
        newP.innerText = "This website is already under a restriction"
        currentSite.insertAdjacentElement("afterend", newP)

}


async function listSites() {
    let { sites = []} = await chrome.storage.local.get('sites')

    let s = document.getElementById('sites')
    let site_origin = document.createElement('p')
    site_origin.id = 'precision'
    if (sites.length === 0) {
        site_origin.innerText = 'Loading sites from the templates exported'
    } else {
        site_origin.innerText = 'Found your sites :'
    }
    s.appendChild(site_origin)

    for (let i = 0; i < sites.length; i++) {
        let site_name = document.createElement('p')
        site_name.id = sites[i].site
        site_name.innerText = sites[i].site
        s.appendChild(site_name)
    }
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
    div.appendChild(form)

    let label = document.createElement('label')
    label.setAttribute("for", "select-group")
    label.innerHTML = "Add to a group :"
    label.id = "add-to-group-label"
    form.appendChild(label)

    let select = document.createElement('select')
    select.id = 'select-group'
    select.add(new Option('--Choose a group--', ''));

    for (let i=0 ; i < groups.length ; i++) {
        select.add(new Option(groups[i]["name"], i))
    }
    form.appendChild(select)

    let submit = document.createElement('input')
    submit.type = "submit"
    submit.value = 'Add'
    form.appendChild(submit)
    
    s.replaceWith(div)

    let createButton = document.createElement('button')
    createButton.id = "create-new-group"
    createButton.innerHTML = "Create a new group"
    div.appendChild(createButton)

    // Event
    submit.addEventListener('click', async (event) => {
        event.preventDefault()
        let select = document.getElementById('select-group')
        if (select.options[select.selectedIndex].value !== '') {
            let group = groups[select.options[select.selectedIndex].value].name
            let host = document.getElementById('host').innerHTML
            await addSiteToGroup(host, group)
        }
    })

    createButton.addEventListener('click', () => replaceByCreateGroupButton(div))
}

function replaceByCreateGroupButton(el) {
    let div = document.createElement('div')

    let form = document.createElement('form')
    form.setAttribute("formenctype", "text/plain")

    let label = document.createElement('label')
    label.setAttribute("for", "new-group")
    label.innerHTML = "Create a group : "
    
    let input = document.createElement('input')
    input.type = "text"
    input.id = "new-group"
    input.required = true
    
    let submit = document.createElement('input')
    submit.id = "create-group-button"
    submit.type = "submit"
    submit.value = "Create"
    submit.accessKey = "enter"
    
    el.replaceWith(div)
    div.appendChild(form)
    div.appendChild(label)
    div.appendChild(input)
    div.appendChild(submit)

    submit.addEventListener('click', async (event) => {
        event.preventDefault();
        let inputValue = document.getElementById("new-group").value
        let site = document.getElementById('host').innerHTML

        await initializeGroupWithSite(inputValue, site)
    
        let successP = document.createElement('p')
        successP.innerHTML = "Successfully added"
        div.appendChild(successP)
    })
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
    sites.push({"site" : host, 
                "restrictions" : null,
                "group": groupName})
    await chrome.storage.local.set({sites : sites})
    location.reload()
}