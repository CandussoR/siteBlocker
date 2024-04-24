import SlotTimeRestriction from "../components/restriction.js"

if ('customElements' in window) {
    customElements.define('restriction-item', SlotTimeRestriction)
}

listSites()

async function listSites() {
    let { sites = []} = await chrome.storage.local.get('sites')

    let ul = document.getElementById('site-list')
    if (sites.length === 0) {
        ul.insertAdjacentHTML("beforebegin", "<p id='precisions'>No sites yet.</p>")
    }

    for (let i = 0; i < sites.length; i++) {
        let siteName = sites[i].site
        let siteGroup = sites[i].group
        let siteRestriction = sites[i].restrictions
        if (siteRestriction) {
            siteRestriction = `<restriction-item rules=${JSON.stringify(siteRestriction['slots'])}></restriction-item>`
        }

        let li = `<li id='${sites[i].site}'>
                    <div id='site'>
                        <div id='buttons'>
                            <span id="edit-button" class='material-symbols-outlined'>edit</span>
                            <span id="remove-button" class='material-symbols-outlined'>remove</span>
                        </div>
                        <p id="site-name"> ${siteName} </p>
                        <p id="group-name">
                            <span class="group-label">Group : </span>
                            ${siteGroup !== null && siteGroup !== undefined ? siteGroup : '--'}
                        </p>
                        ${siteRestriction ?? ''}
                    </div>
                </li>`

        ul.insertAdjacentHTML("beforeend", li)

    }

    ul.addEventListener('click', async function(event) {
        // Returns the HTMLElement clicked (the span)
        const target = event.target;
        // Getting the <li> in which it is enclosed
        const listItem = target.closest('li')

        if (!listItem) return;

        if (target.id === 'remove-button') {
            let modifiedSites = []

            if (listItem.id === 'undefined') {
                // Happens only when there's been a bug, but oh well
                modifiedSites = sites.filter(el => el.site !== undefined)
            } else {
                modifiedSites = sites.filter(el => el.site !== listItem.id)
            }

            // Removing from storage
            await chrome.storage.local.set({sites : modifiedSites})
            listItem.remove();
        }
    
        if (target.id === 'edit-button') {
            // Handle edit button click
                // Perform edit operation for the corresponding list item
                // For example, open a modal for editing
                console.log('Edit button clicked for item:', target.text);
        }
    });
}

