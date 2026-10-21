export function hasSmartScheduleAssignmentConflict(
  proposedRoom,
  assignedRooms,
) {
  return assignedRooms.some((assigned) => {
    const overlaps =
      proposedRoom.start < assigned.end &&
      proposedRoom.end > assigned.start;

    if (overlaps) {
      return true;
    }

    if (proposedRoom.location === assigned.location) {
      return false;
    }

    const gap =
      proposedRoom.start >= assigned.end
        ? proposedRoom.start.getTime() -
          assigned.end.getTime()
        : assigned.start.getTime() -
          proposedRoom.end.getTime();

    return gap < 30 * 60 * 1000;
  });
}

export function getSmartScheduleBestRoom(group, assignedRooms) {
  const candidates = group.availableRooms
    .filter(
      (room) =>
        !hasSmartScheduleAssignmentConflict(
          room,
          assignedRooms,
        ),
    )
    .sort((a, b) => {
      const competitionDifference =
        a.competingGroupCount - b.competingGroupCount;

      if (competitionDifference !== 0) {
        return competitionDifference;
      }

      return a.start.getTime() - b.start.getTime();
    });

  return candidates[0] ?? null;
}

export function buildSmartScheduleRecommendations(groups) {

  const assignedRooms = [];

      const prioritizedGroups = groups
    .map((group, originalIndex) => ({
      ...group,
      originalIndex,
    }))
    .sort(
      (a, b) =>
        getSmartScheduleGroupPriority(a) -
        getSmartScheduleGroupPriority(b),
    );
      const assignments =
    findSmartScheduleAssignments(prioritizedGroups);

    const recommendations = prioritizedGroups.map((group, index) => {
  const proposedRehearsals = assignments
    ? assignments[index]
    : [];

        if (!assignments && !group.schedulingIssue) {
      for (let i = 0; i < group.remainingCount; i++) {
        const room = getSmartScheduleBestRoom(
          group,
          assignedRooms,
        );

        if (!room) {
          break;
        }

        proposedRehearsals.push(room);
        assignedRooms.push(room);
      }
    }

    assignedRooms.push(...proposedRehearsals);

    return {
      ...group,
      proposedRehearsals,
      stillNeeded:
        group.remainingCount - proposedRehearsals.length,
    };
  });

    return recommendations.sort(
    (a, b) => a.originalIndex - b.originalIndex,
  );
}

function getSmartScheduleGroupPriority(group) {
  if (group.schedulingIssue || group.remainingCount === 0) {
    return Infinity;
  }

  const uniqueTimes = new Set(
    group.availableRooms.map(
      (room) =>
        `${room.start.toISOString()}|${room.end.toISOString()}`,
    ),
  );

  return uniqueTimes.size / group.remainingCount;
}

function findSmartScheduleAssignments(
  groups,
  groupIndex = 0,
  assignedRooms = [],
  assignments = [],
) {
  if (groupIndex === groups.length) {
    return assignments;
  }

  const group = groups[groupIndex];

  if (group.schedulingIssue || group.remainingCount === 0) {
    return findSmartScheduleAssignments(
      groups,
      groupIndex + 1,
      assignedRooms,
      [...assignments, []],
    );
  }

  function tryRooms(selectedRooms) {
    if (selectedRooms.length === group.remainingCount) {
      return findSmartScheduleAssignments(
        groups,
        groupIndex + 1,
        [...assignedRooms, ...selectedRooms],
        [...assignments, selectedRooms],
      );
    }

        for (const room of group.availableRooms || []) {
      const alreadySelected = selectedRooms.some(
        (selected) =>
          new Date(selected.start).getTime() ===
            new Date(room.start).getTime() &&
          new Date(selected.end).getTime() ===
            new Date(room.end).getTime(),
      );

      if (
        alreadySelected ||
        hasSmartScheduleAssignmentConflict(
          room,
          [...assignedRooms, ...selectedRooms],
        )
      ) {
        continue;
      }

      const result = tryRooms([...selectedRooms, room]);

      if (result) {
        return result;
      }
    }

    return null;
  }

  return tryRooms([]);
}