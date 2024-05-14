chrome.runtime.sendMessage({ready : true}, (response) => {
    document.querySelector('#redirected').innerHTML = `You've been redirected from a page on <a href='${response.url}'>${response.host}</a>.`
    return true;
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.restriction === "ended") {
    let url = document.querySelector('a').href
    document.querySelector('#redirected').innerHTML = `The restriction has ended. You can now go back to <a href='${url}'>${url}</a>.`
    }
})
