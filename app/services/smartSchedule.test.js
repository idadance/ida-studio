import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSmartScheduleAssignmentConflict,
  buildSmartScheduleRecommendations,
} from "./smartScheduleLogic.js";

test("Smart Schedule prevents overlapping rehearsals", () => {
  const assignedRooms = [
    {
      start: new Date("2026-11-03T16:00:00-05:00"),
      end: new Date("2026-11-03T17:00:00-05:00"),
      location: "FW",
    },
  ];

  const proposedRoom = {
    start: new Date("2026-11-03T16:30:00-05:00"),
    end: new Date("2026-11-03T17:30:00-05:00"),
    location: "FW",
  };

  assert.equal(
    hasSmartScheduleAssignmentConflict(
      proposedRoom,
      assignedRooms,
    ),
    true,
  );
});

test("Smart Schedule requires 30 minutes between locations", () => {
  const assignedRooms = [
    {
      start: new Date("2026-11-03T16:00:00-05:00"),
      end: new Date("2026-11-03T17:00:00-05:00"),
      location: "FW",
    },
  ];

  const proposedRoom = {
    start: new Date("2026-11-03T17:15:00-05:00"),
    end: new Date("2026-11-03T18:15:00-05:00"),
    location: "PM",
  };

  assert.equal(
    hasSmartScheduleAssignmentConflict(
      proposedRoom,
      assignedRooms,
    ),
    true,
  );
});

test("Smart Schedule allows back-to-back rehearsals at the same location", () => {
  const assignedRooms = [
    {
      start: new Date("2026-11-03T16:00:00-05:00"),
      end: new Date("2026-11-03T17:00:00-05:00"),
      location: "FW",
    },
  ];

  const proposedRoom = {
    start: new Date("2026-11-03T17:00:00-05:00"),
    end: new Date("2026-11-03T18:00:00-05:00"),
    location: "FW",
  };

  assert.equal(
    hasSmartScheduleAssignmentConflict(
      proposedRoom,
      assignedRooms,
    ),
    false,
  );
});

test("Smart Schedule recommends three distinct rehearsals", () => {
  const times = [
    ["2026-11-03T16:00:00-05:00", "2026-11-03T17:00:00-05:00"],
    ["2026-11-04T16:00:00-05:00", "2026-11-04T17:00:00-05:00"],
    ["2026-11-05T16:00:00-05:00", "2026-11-05T17:00:00-05:00"],
  ];

  const availableRooms = times.map(([start, end]) => ({
    start: new Date(start),
    end: new Date(end),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 1,
  }));

  const groups = [
    {
      remainingCount: 3,
      schedulingIssue: null,
      availableRooms,
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  const proposed = recommendations[0].proposedRehearsals;

  assert.equal(proposed.length, 3);
  assert.equal(recommendations[0].stillNeeded, 0);

  assert.equal(
    new Set(proposed.map((room) => room.start.toISOString())).size,
    3,
  );
});

test("Smart Schedule does not double-book a teacher across dancers", () => {
  const sharedRoom = {
    start: new Date("2026-11-03T16:00:00-05:00"),
    end: new Date("2026-11-03T17:00:00-05:00"),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 2,
  };

  const alternativeRoom = {
    start: new Date("2026-11-04T16:00:00-05:00"),
    end: new Date("2026-11-04T17:00:00-05:00"),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 1,
  };

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [sharedRoom],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [sharedRoom, alternativeRoom],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.equal(
    recommendations[0].proposedRehearsals.length,
    1,
  );

  assert.equal(
    recommendations[1].proposedRehearsals.length,
    1,
  );

  assert.notEqual(
    recommendations[0].proposedRehearsals[0].start.getTime(),
    recommendations[1].proposedRehearsals[0].start.getTime(),
  );
});

test("Smart Schedule finds room for a restricted dancer", () => {
  const tuesday = {
    start: new Date("2026-11-03T16:00:00-05:00"),
    end: new Date("2026-11-03T17:00:00-05:00"),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 2,
  };

  const wednesday = {
    start: new Date("2026-11-04T16:00:00-05:00"),
    end: new Date("2026-11-04T17:00:00-05:00"),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 1,
  };

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, wednesday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.equal(recommendations[0].stillNeeded, 0);
  assert.equal(recommendations[1].stillNeeded, 0);

  assert.equal(
    recommendations[0].proposedRehearsals[0].start.getTime(),
    wednesday.start.getTime(),
  );

  assert.equal(
    recommendations[1].proposedRehearsals[0].start.getTime(),
    tuesday.start.getTime(),
  );
});

test("Smart Schedule rearranges proposals to fit everyone", () => {
  function room(day, hour) {
    return {
      start: new Date(`2026-11-${day}T${hour}:00:00-05:00`),
      end: new Date(`2026-11-${day}T${hour + 1}:00:00-05:00`),
      location: "FW",
      studioCalendar: "FW Studio A",
      competingGroupCount: 2,
    };
  }

  const tuesday = room("03", 16);
  const wednesday = room("04", 16);
  const thursday = room("05", 16);

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [wednesday, tuesday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, thursday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [wednesday],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.deepEqual(
    recommendations.map((group) => group.stillNeeded),
    [0, 0, 0],
  );

  assert.equal(
    recommendations[0].proposedRehearsals[0].start.getTime(),
    tuesday.start.getTime(),
  );

  assert.equal(
    recommendations[1].proposedRehearsals[0].start.getTime(),
    thursday.start.getTime(),
  );

  assert.equal(
    recommendations[2].proposedRehearsals[0].start.getTime(),
    wednesday.start.getTime(),
  );
});

test("Smart Schedule reassigns an earlier dancer to fit everyone", () => {
  function room(day) {
    return {
      start: new Date(`2026-11-${day}T16:00:00-05:00`),
      end: new Date(`2026-11-${day}T17:00:00-05:00`),
      location: "FW",
      studioCalendar: "FW Studio A",
      competingGroupCount: 2,
    };
  }

  const tuesday = room("03");
  const wednesday = room("04");
  const thursday = room("05");

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, wednesday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, thursday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.deepEqual(
    recommendations.map((group) => group.stillNeeded),
    [0, 0, 0],
  );
});

test("Smart Schedule backtracks when its first choice blocks another dancer", () => {
  function room(day) {
    return {
      start: new Date(`2026-11-${day}T16:00:00-05:00`),
      end: new Date(`2026-11-${day}T17:00:00-05:00`),
      location: "FW",
      studioCalendar: "FW Studio A",
      competingGroupCount: 2,
    };
  }

  const tuesday = room("03");
  const wednesday = room("04");
  const thursday = room("05");

  // Make Tuesday appear least competitive,
  // encouraging the first dancer to choose it.
  tuesday.competingGroupCount = 1;
  wednesday.competingGroupCount = 2;
  thursday.competingGroupCount = 3;

    // Force the greedy scheduler into a dead end.
  // Dancer A: Tuesday or Wednesday
  // Dancer B: Tuesday or Thursday
  // Dancer C: Tuesday or Thursday
  tuesday.competingGroupCount = 1;
  wednesday.competingGroupCount = 2;
  thursday.competingGroupCount = 3;

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, wednesday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, thursday],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [tuesday, thursday],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.deepEqual(
    recommendations.map((group) => group.stillNeeded),
    [0, 0, 0],
  );
});

test("Smart Schedule handles impossible schedules without double-booking", () => {
  const room = {
    start: new Date("2026-11-03T16:00:00-05:00"),
    end: new Date("2026-11-03T17:00:00-05:00"),
    location: "FW",
    studioCalendar: "FW Studio A",
    competingGroupCount: 2,
  };

  const groups = [
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [room],
    },
    {
      remainingCount: 1,
      schedulingIssue: null,
      availableRooms: [room],
    },
  ];

  const recommendations =
    buildSmartScheduleRecommendations(groups);

  assert.equal(
    recommendations.reduce(
      (total, group) => total + group.proposedRehearsals.length,
      0,
    ),
    1,
  );

  assert.equal(
    recommendations.reduce(
      (total, group) => total + group.stillNeeded,
      0,
    ),
    1,
  );
});