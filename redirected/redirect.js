chrome.runtime.sendMessage({ready : true}, (response) => {
    document.querySelector('#redirected').innerHTML = `You've been redirected from a page on <a href='${response.url}'>${response.host}</a>.`
    return true;
})
