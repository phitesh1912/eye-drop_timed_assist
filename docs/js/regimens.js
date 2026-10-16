// The prescriptions, copied from the hospital sheets. Each app (Grandma's at
// /, the brother's at /brother/) picks one with <html data-regimen="...">.
//
// Numbers 1-5 match the circled numbers written on the sheet and on the boxes.
// Colours match the coloured bands on the sheet. No names here: the repository
// is public, so names are typed into the app and stay on the phone.

export const REGIMENS = {
  // Cataract surgery, right eye, 7 Oct 2026.
  grandma: {
    id: 'grandma',
    title: 'Drop Time',
    storageKey: 'droptime:v1',
    apk: 'DropTime.apk',
    defaultName: 'Grandma',
    nameIdeas: ['Grandma', 'Ammamma', 'Nanamma', 'Nani', 'Dadi', 'Amma'],
    adjustableTime: 't1',
    course: {
      surgeryDate: '2026-10-07', // Day 1 on the sheet
      startDate: '2026-10-08',   // first day the app tracks (Day 2)
      eye: 'RIGHT',
      hospitalPhone: '9581293344',
    },
    meds: [
      {
        id: 'd1', num: 1, kind: 'drop', order: 1,
        name: 'Pred Forte', generic: 'Prednisolone acetate',
        box: 'White box with red end (AbbVie)',
        color: '#E0603C', shake: true,
        phases: [
          { from: '2026-10-14', to: '2026-10-20', times: ['07:00', '11:00', '14:30', '17:00', '21:00'] },
          // The sheet prints "12:00 AM" here; it means 12 noon.
          { from: '2026-10-21', to: '2026-10-27', times: ['07:00', '12:00', '17:00', '21:00'] },
          { from: '2026-10-28', to: '2026-11-03', times: ['07:00', '16:00', '21:00'] },
          { from: '2026-11-04', to: '2026-11-10', times: ['07:00', '19:00'] },
          { from: '2026-11-11', to: '2026-11-17', times: ['07:00'] },
        ],
      },
      {
        id: 'd2', num: 2, kind: 'drop', order: 2,
        name: 'Moxicip D', generic: 'Moxifloxacin + Dexamethasone',
        box: 'White box with pink circles (Cipla)',
        color: '#8E3B2E', shake: false,
        phases: [
          // Handwritten on the sheet: "till 13th Oct".
          { from: '2026-10-08', to: '2026-10-13', times: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'] },
        ],
      },
      {
        id: 'd3', num: 3, kind: 'drop', order: 3,
        name: 'Micronac PF', generic: 'Nepafenac',
        box: 'Yellow and purple box',
        color: '#2F3B58', shake: true,
        phases: [
          // 45 days counted from surgery day (7 Oct) -> 20 Nov.
          { from: '2026-10-08', to: '2026-11-20', times: ['08:00', '14:00', '21:00'] },
        ],
      },
      {
        id: 'd4', num: 4, kind: 'drop', order: 4,
        name: 'Dortas', generic: 'Dorzolamide',
        box: 'White and green box (Intas)',
        color: '#6D5C99', shake: false,
        phases: [
          // 2 weeks counted from surgery day -> 20 Oct.
          { from: '2026-10-08', to: '2026-10-20', times: ['07:30', '14:30', '21:30'] },
        ],
      },
      {
        id: 'd5', num: 5, kind: 'drop', order: 5,
        name: 'Trehalube', generic: 'Sodium hyaluronate (lubricant)',
        box: 'Dark brown box with a water splash',
        color: '#4F9A2B', shake: false,
        phases: [
          // 1 month counted from surgery day -> 6 Nov.
          { from: '2026-10-08', to: '2026-11-06', times: ['08:00', '12:00', '16:00', '20:00'] },
        ],
      },
      {
        id: 't1', num: 0, kind: 'tablet', order: 10,
        name: 'Vitamin tablet', generic: 'I-FIT-M / Eye 360 / Nusight',
        box: '1 tablet after a meal',
        color: '#1F86C7', shake: false,
        phases: [
          { from: '2026-10-08', to: '2026-11-06', times: ['09:00'] },
        ],
      },
    ],
    // "Only if there is pain": logged by hand, never an alarm.
    painTablet: {
      id: 't2', name: 'Pain tablet', generic: 'Dolo 650 / Ultracet',
      maxPerDay: 2, color: '#D98E12',
    },
  },

  // Laser eye surgery (PRK), both eyes, 16 Oct 2026. "Month 1" = 16 Oct - 15 Nov.
  brother: {
    id: 'brother',
    title: 'Drop Time+',
    ui: 'modern',
    storageKey: 'droptime:brother:v1',
    apk: 'DropTimePlus.apk',
    defaultName: '',
    nameIdeas: [],
    adjustableTime: 't1',
    course: {
      surgeryDate: '2026-10-16',
      startDate: '2026-10-16', // drops start on surgery day
      eye: 'BOTH',
      hospitalPhone: '9059682569',
    },
    meds: [
      {
        id: 'd1', num: 1, kind: 'drop', order: 1,
        name: 'Lotefast', generic: 'Loteprednol etabonate 0.5%',
        box: 'White box, red writing (Intas)',
        color: '#E0473F', shake: true,
        phases: [
          { from: '2026-10-16', to: '2026-11-15', times: ['07:30', '11:30', '15:30', '19:30'] },
          { from: '2026-11-16', to: '2026-12-15', times: ['07:30', '19:30'] },
          { from: '2026-12-16', to: '2027-01-15', times: ['07:30'] },
        ],
      },
      {
        id: 'd2', num: 2, kind: 'drop', order: 2,
        name: 'Moxicip', generic: 'Moxifloxacin',
        box: 'White box with purple circles (Cipla)',
        color: '#A3483C', shake: false,
        phases: [
          // Written on the box: "6 times, 1 week, stop".
          { from: '2026-10-16', to: '2026-10-22', times: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'] },
        ],
      },
      {
        id: 'd3', num: 3, kind: 'drop', order: 3,
        name: 'Aquim PF', generic: 'Sodium hyaluronate 0.18% (lubricant)',
        box: 'Light blue box with a big eye (HIS Eyeness)',
        color: '#3FA35A', shake: false,
        phases: [
          // Month 1: every hour, 12 times a day.
          {
            from: '2026-10-16', to: '2026-11-15',
            times: ['07:15', '08:15', '09:15', '10:15', '11:15', '12:15', '13:15', '14:15', '15:15', '16:15', '17:15', '18:15'],
          },
          // Months 2 and 3: 6 times a day.
          { from: '2026-11-16', to: '2027-01-15', times: ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'] },
        ],
      },
      {
        id: 'd4', num: 4, kind: 'drop', order: 4,
        name: 'Micronac PF', generic: 'Nepafenac',
        box: 'Yellow and purple box',
        color: '#9A5BB5', shake: true,
        phases: [
          { from: '2026-10-16', to: '2026-10-18', times: ['08:00', '14:00', '20:00'] },
        ],
      },
      {
        id: 't1', num: 0, kind: 'tablet', order: 10,
        name: 'Eye 360', generic: 'Eye vitamins (given instead of Osmega)',
        box: 'White box, 30 tablets',
        note: 'after lunch',
        color: '#3BA7E0', shake: false,
        phases: [
          // 1 month: the box of 30 tablets, one a day.
          { from: '2026-10-16', to: '2026-11-14', times: ['13:30'] },
        ],
      },
      {
        id: 't3', num: 0, kind: 'tablet', order: 11,
        name: 'Chymoral Forte', short: 'Chymoral', generic: 'Pink tablets, morning and night',
        box: 'Pink tablets marked M and N',
        note: 'after food',
        color: '#D6559A', shake: false,
        phases: [
          { from: '2026-10-16', to: '2026-10-18', times: ['09:00', '21:00'] },
        ],
      },
    ],
    painTablet: {
      id: 't2', name: 'Pain tablet', generic: 'Dolo 650 / Combiflam (blue strip marked "Pain")',
      maxPerDay: 2, color: '#8A3D8A',
    },
  },
};
