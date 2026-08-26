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
function cloneValue(value, seen = new WeakMap()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (seen.has(value)) return null;
  seen.set(value, true);

  if (Array.isArray(value)) return value.map((item) => cloneValue(item, seen) ?? null);

  const entries = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedClone = cloneValue(nestedValue, seen);
    if (nestedClone !== undefined) entries.push([key, nestedClone]);
  }
  return Object.fromEntries(entries);
}

function validSeconds(value) {
  return Number.isInteger(value) && value >= 0;
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
    .filter((exam) => exam.passed === true && validSeconds(exam.seconds))
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

  const storedBest = validSeconds(value.bestExamSeconds) ? value.bestExamSeconds : null;
  const examBest = bestFromExams(normalized.exams);
  normalized.bestExamSeconds = storedBest === null
    ? examBest
    : examBest === null ? storedBest : Math.min(storedBest, examBest);
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
  next.exams = [...next.exams, exam];

  if (exam.passed === true && validSeconds(exam.seconds)) {
    next.bestExamSeconds = next.bestExamSeconds === null
      ? exam.seconds
      : Math.min(next.bestExamSeconds, exam.seconds);
  }
  return next;
}
