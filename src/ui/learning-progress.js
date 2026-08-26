function workshopCompleted(progress, workshopId) {
  const completed = progress?.completed;
  return Boolean(completed && Object.hasOwn(completed, workshopId) && completed[workshopId]);
}

export function sectionStarted(section, progress) {
  return Array.isArray(section?.workshops)
    && section.workshops.some((workshopId) => workshopCompleted(progress, workshopId));
}

export function sectionCompleted(section, progress) {
  return Array.isArray(section?.workshops)
    && section.workshops.length > 0
    && section.workshops.every((workshopId) => workshopCompleted(progress, workshopId));
}

export function completedSectionCount(sections, progress) {
  return sections.filter((section) => sectionCompleted(section, progress)).length;
}

export function nextWorkshopInSection(section, progress) {
  if (!Array.isArray(section?.workshops)) return null;
  return section.workshops.find((workshopId) => !workshopCompleted(progress, workshopId)) ?? null;
}

export function nextWorkshopId(sections, progress) {
  for (const section of sections) {
    const workshopId = nextWorkshopInSection(section, progress);
    if (workshopId) return workshopId;
  }
  return null;
}
