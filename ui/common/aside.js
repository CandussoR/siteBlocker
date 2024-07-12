updateOpen()

window.addEventListener("resize", updateOpen);

function updateOpen() {
    let menu = document.querySelector('details.menu')
    let w = window.innerWidth
    if (w <= 768) {
        menu.open = false
        return;
    }
    menu.open = true
    document.querySelector('summary#menu').classList.add('unclickable')
}
