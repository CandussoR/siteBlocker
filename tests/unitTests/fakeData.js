export let fakeRecord = {
  "2024-05-21": {
    "test.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
    "test2.com": { audible: false, focused: false, initDate: null, tabId: null, totalTime: 0, },
  },
};

export let fakeGroup = {
  groups : [
    {
      name : 'Test',
      restrictions : {
        totalTime : [
          {
            days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            totalTime : 60
          }
        ]
      }
    }
  ]
}
 
export let fakeSites = {
  sites: [
    {
      group: "Test",
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
      group: "Test",
      name: "test2.com",
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
  ],
};
