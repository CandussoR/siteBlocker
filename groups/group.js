import './components/groupComponent.js'

let { groups = [] } = await chrome.storage.local.get('groups')

let div = document.getElementById('groups')

for (let i = 0 ; i < groups.length ; i++) {
    let restrictions = groups[i].restrictions ? `restrictions="${JSON.stringify(groups[i].restrictions)}"` : ''
    div.insertAdjacentHTML("beforeend", `<a-group id="group-${i}" i="${i}" name="${groups[i].name}" ${restrictions}/>`)
}