import { createId, getColorFromName } from './utils.js';

export function createRoommate(roommates, name) {
  const trimmedName = name.trim();
  if (!trimmedName || roommates.some((roommate) => roommate.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Roommate name must be unique and cannot be empty.');
  }
  const newRoommate = {
    id: createId(),
    name: trimmedName,
    color: getColorFromName(trimmedName),
    createdAt: new Date().toISOString(),
  };
  return [...roommates, newRoommate];
}

export function updateRoommate(roommates, roommateId, name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Roommate name cannot be empty.');
  }
  if (roommates.some((roommate) => roommate.id !== roommateId && roommate.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Roommate name must be unique.');
  }
  return roommates.map((roommate) =>
    roommate.id === roommateId
      ? { ...roommate, name: trimmedName, color: getColorFromName(trimmedName) }
      : roommate
  );
}

export function removeRoommate(roommates, roommateId) {
  return roommates.filter((roommate) => roommate.id !== roommateId);
}

export function findRoommate(roommates, roommateId) {
  return roommates.find((roommate) => roommate.id === roommateId) ?? null;
}

export function getRoommateDropdownOptions(roommates, selectedId = '') {
  return roommates
    .map((roommate) => `<option value="${roommate.id}" ${roommate.id === selectedId ? 'selected' : ''}>${roommate.name}</option>`)
    .join('');
}
