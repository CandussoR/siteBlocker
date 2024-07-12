export const template_sites = [
    {
        "name": "www.youtube.com",
        "restrictions": {
            "timeSlot": [
                {
                    "days": ["Monday", "Tuesday", "Thursday", "Friday"],
                    "time": [
                        ["00:00:00", "12:00:00"],
                        ["13:30:00", "18:00:00"],
                        ["20:30:00", "00:00:00"]
                    ]
                }
            ]
        },
    },
    { "name": "www.chess.com", "restrictions": null },
    { "name": "www.instagram.com", "restrictions": null },
    { "name": "www.facebook.com", "restrictions": null },
    { "name": "www.tiktok.com", "restrictions": null }
]

export const daysToRecord = 30
export const consecutiveTimeReset = 2
export const consecutiveTimeResetPercent = .25
