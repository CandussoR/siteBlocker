let params = new URLSearchParams(window.location.search)
let url = params.get('url')
let host = params.get('host')
let end = params.get('end')
let eor = params.get('eor')
if (end) {
    document.querySelector('#redirected').innerHTML = `The restriction has ended. You can now go back to <a href='${url}'>${url}</a>.`
} else {
    document.querySelector('#redirected').innerHTML = `You've been redirected from a page on <a href='${url}'>${host}</a>. ${eor? 'This restriction will end at ' + eor : ''}`
}
document.querySelector('#redirected')?.classList.add('text-xs', 'sm:text-base', 'mb-7')
document.querySelector('a')?.classList.add('link', 'link-primary', 'font-semibold')
