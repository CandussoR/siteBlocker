export function updateMenuGroups(groups) {
  let ul = document.getElementById('menu-group-list')
  ul.textContent = ''
  const currentBaseUrl = location.pathname;
  for (let i=0; i < groups.length; i++) {
    ul.insertAdjacentHTML('beforeend', `<li id="mgl${i}"><a href="${currentBaseUrl}?t=g&i=${i}">${groups[i].name}</li></a>`)
  }
  let search = new URLSearchParams(location.search)
  let type = search.get('t')
  let ind = search.get('i')
  if (type == 's') {
    return;
  }
  if (ind >= groups.length) {  
    ind = "0"
    history.pushState({}, '', `${currentBaseUrl}?t=g&i=${ind}`)
  }
  document.getElementById(`mgl${ind}`).classList.add('bg-primary', 'rounded-lg')
}