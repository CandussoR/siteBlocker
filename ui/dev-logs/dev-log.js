const {logs = []} = await chrome.storage.local.get('logs')

const logList = document.getElementById('log-list')

if (!logs) {
    logList.insertAdjacentHTML(
        "afterbegin",
        `<p class="text-info">No logs.</p>`
    )
} else {
     for (let i = 0 ; i < logs.length ; i++) {
        logList.insertAdjacentHTML('afterbegin',
            getEl(logs[i])
            )
    }  
}

function getBackgroundColor(log) {
    if (typeof log === 'string') return ;

    switch (log.level) {
        case "DEBUG":
            return "border-l-4 border-default";
        case "INFO":
            return "border-l-4 border-info";
        case "WARNING":
            return "border-l-4 border-warning";
        case "ERROR":
            return "border-l-4 border-error";
    }
}

function getEl(log) {
    if (typeof log === "string") {
        return `<div class="w-1/2 align-center">
                <p class="m-3">${log}</p>
            </div>`
    } else {
        let call = log.call ? `<p class=p-1">${log.call}</p>\n` : ''
        return `<div class="flex flex-col w-3/5 ${getBackgroundColor(log)} items-center p-3 rounded-r-lg gap-3 shadow-[6px_1px_0px_0px_rgba(0,0,0,0.125)]">
                <div class="w-3/4 p-2 bg-base-100 ">
                    <p class="font-semibold font-mono p-1">${log.timestamp}</p>
                    ${call}<p class="bg-log text-neutral-content p-8 whitespace-pre">${log.data.join("\n")}</p>
                </div>
            </div>`
    }
}