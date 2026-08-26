const STORAGE_KEY = 'subnet-notes-progress';
const CURRENT_VERSION = 1;

function defaults() {
  return {
    version: CURRENT_VERSION,
    locale: 'fr',
    completed: {},
    current: null,
    exams: [],
    bestExamSeconds: null,
  };
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Clone the JSON-compatible values used by progress while dropping values
 * that cannot be persisted. A clone is important because callers often keep
 * the previous state around for rendering or undoing a submission.
 */
function cloneValue(value, active = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (active.has(value)) return null;
  active.add(value);

  try {
    if (Array.isArray(value)) return value.map((item) => cloneValue(item, active) ?? null);

    const entries = [];
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedClone = cloneValue(nestedValue, active);
      if (nestedClone !== undefined) entries.push([key, nestedClone]);
    }
    return Object.fromEntries(entries);
  } finally {
    active.delete(value);
  }
}

function validSeconds(value) {
  return Number.isInteger(value) && value >= 0 && value <= 900;
}

function isFullyPassedExam(exam) {
  return isRecord(exam)
    && typeof exam.id === 'string'
    && exam.id === `exam:${exam.seed}`
    && exam.status === 'complete'
    && exam.passed === true
    && exam.score === 3
    && validSeconds(exam.seconds)
    && Array.isArray(exam.missions)
    && exam.missions.length === 3
    && exam.missions.every((mission) => isRecord(mission)
      && mission.passed === true
      && typeof mission.missionSeed === 'string'
      && mission.missionSeed.length > 0
      && Array.isArray(mission.diagnosticCodes));
}

function cloneRecordMap(value) {
  if (!isRecord(value)) return {};
  const entries = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    if (!isRecord(nestedValue)) continue;
    entries.push([key, cloneValue(nestedValue)]);
  }
  return Object.fromEntries(entries);
}

function cloneCurrent(value) {
  if (value === null || typeof value === 'string') return value;
  return isRecord(value) ? cloneValue(value) : null;
}

function cloneExams(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((exam) => cloneValue(exam));
}

function bestFromExams(exams) {
  const passedTimes = exams
    .filter(isFullyPassedExam)
    .map((exam) => exam.seconds);
  return passedTimes.length > 0 ? Math.min(...passedTimes) : null;
}

function normalizeProgress(value) {
  if (!isRecord(value) || value.version !== CURRENT_VERSION || !isRecord(value.completed)) {
    return defaults();
  }

  const normalized = defaults();
  normalized.locale = value.locale === 'en' ? 'en' : 'fr';
  normalized.completed = cloneRecordMap(value.completed);
  normalized.current = cloneCurrent(value.current);
  normalized.exams = cloneExams(value.exams);

  normalized.bestExamSeconds = bestFromExams(normalized.exams);
  return normalized;
}

function browserStorage() {
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

export function loadProgress(storage = browserStorage()) {
  const target = storage ?? browserStorage();
  if (!target || typeof target.getItem !== 'function') return defaults();

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (typeof raw !== 'string' || raw.length === 0) return defaults();
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function saveProgress(storage, progress) {
  const target = storage ?? browserStorage();
  if (!target || typeof target.setItem !== 'function') return;

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(cloneValue(progress))));
  } catch {
    // Storage can be disabled or full. Progress is helpful, but must never
    // make the learning interface unusable in those environments.
  }
}

function snapshot(progress) {
  return normalizeProgress(cloneValue(progress));
}

export function completeWorkshop(progress, workshopId, result) {
  const next = snapshot(progress);
  if (typeof workshopId !== 'string' || workshopId.trim() === '') return next;

  const completion = isRecord(result) ? cloneValue(result) : {};
  next.completed = {
    ...next.completed,
    [workshopId]: { ...completion, completedAt: new Date().toISOString() },
  };
  return next;
}

export function recordExam(progress, result) {
  const next = snapshot(progress);
  const exam = isRecord(result) ? cloneValue(result) : {};
  if (typeof exam.id === 'string' && exam.id.length > 0
    && next.exams.some((existing) => existing.id === exam.id)) {
    return next;
  }
  next.exams = [...next.exams, exam];

  if (isFullyPassedExam(exam)) {
    next.bestExamSeconds = next.bestExamSeconds === null
      ? exam.seconds
      : Math.min(next.bestExamSeconds, exam.seconds);
  }
  return next;
}
