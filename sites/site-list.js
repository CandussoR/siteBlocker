import "../components/restrictions/restriction.js"
import './components/siteComponent.js'
import './components/siteEditor.js'

listSites()

async function listSites() {
  let { sites = [] } = await chrome.storage.local.get("sites");
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

