export let fakeRecord = {
  "2024-05-21": {
    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
  },
};

let fakeSites = {
  sites: [
    {
      group: "Divertissement",
      name: "test.com",
      restrictions: {
        timeSlot: [
          {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
            time: [
              ["00:00", "12:00"],
              ["13:30", "18:00"],
              ["21:30", "00:00"],
            ],
          },
          {
            days: ["Friday"],
            time: [
              ["00:00", "12:00"],
              ["13:30", "18:00"],
            ],
          },
        ],
      },
    },
    {
      group: "Divertissement",
      name: "gogoanime.run",
      restrictions: {
        timeSlot: [
          {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            time: [
              ["00:00", "12:00"],
              ["13:45", "19:00"],
            ],
          },
        ],
      },
    },
    {
      group: "Musique",
      name: "open.spotify.com",
      restrictions: null,
    },
  ],
};
