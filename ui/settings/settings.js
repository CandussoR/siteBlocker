import { daysToRecord as dTR, consecutiveTimeReset as cTR } from "../../worker/dataInit.js"

let { daysToRecord } = await chrome.storage.local.get('daysToRecord');
let { consecutiveTimeReset } = await chrome.storage.local.get('consecutiveTimeReset');
document.querySelector('input#number-of-days').value = daysToRecord;
document.querySelector('input#consecutive-time-reset').value = consecutiveTimeReset / 60;

document.getElementById('submit').addEventListener('click', async (e) => {
    e.preventDefault();
    let [numberOfDays, consecutiveTimeReset, privateBrowsing, _] = document.forms[0];
    numberOfDays = numberOfDays.valueAsNumber;
    consecutiveTimeReset = consecutiveTimeReset.valueAsNumber;
    if (numberOfDays > 0 && numberOfDays < 365 && consecutiveTimeReset >= 0 && consecutiveTimeReset <= 120) {
        await chrome.storage.local.set({daysToRecord : numberOfDays});
        await chrome.storage.local.set({consecutiveTimeReset : consecutiveTimeReset * 60});
    } else {
        let error = document.getElementById('error');
        error.textContent = "One of your inputs is higher or lower than the authorized values.";
        error.classList.remove(['display']);
    }

    if (privateBrowsing) {
        await chrome.storage.local.set({restrictPrivate: true})
        let {groups = []} = await chrome.storage.local.get('groups')
        groups.push({name: 'Private', 
                    restrictions : {
                        'timeSlot' : [{days : ['Monday', 'Tuesday', 'Wednesday', 'Thurday', 'Friday', 'Saturday', 'Sunday'], 
                                       time : ['00:00', '00:00']
                                    }]
                                }
                    })
        await chrome.storage.local.set({groups : groups})
        let { records = [] } = await chrome.storage.local.get('records')
        let today = new Date().toISOString().split('T')[0] ;
        records[today].Private = {initDate : null, totalTime : 0, audible : false, tabId : null, focused : false } ;
        await chrome.storage.local.set({ records : records })
    }
})

document.getElementById('default').addEventListener('click', async () => {
    await chrome.storage.local.set({daysToRecord : dTR});
    await chrome.storage.local.set({consecutiveTimeReset : cTR});
    document.querySelector('input#number-of-days').value = dTR;
    document.querySelector('input#consecutive-time-reset').value = cTR;
})