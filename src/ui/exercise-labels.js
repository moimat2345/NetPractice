export function deviceLabel(i18n, device) {
  if (device?.labelKey) return i18n.t(device.labelKey);
  return device?.kind ? i18n.t(`device.${device.kind}`) : i18n.t('practice.label.device');
}

export function entryLabel(i18n, device, section, entry, index, devices = [], links = []) {
  const number = index + 1;
  if (section === 'routes') {
    const label = i18n.t('practice.label.route', { number });
    const visibleDefault = entry.destination === 0 && entry.prefix === 0
      && !entry.editable?.destination && !entry.editable?.prefix;
    return visibleDefault ? `${label} · ${i18n.t('practice.label.defaultRoute')}` : label;
  }

  const label = i18n.t('practice.label.interface', { number });
  const link = links.find((candidate) => candidate.a === entry.id || candidate.b === entry.id);
  const peerId = link?.a === entry.id ? link.b : link?.a;
  const peer = peerId ? devices.find((candidate) => candidate.id !== device.id
    && candidate.interfaces.some((candidateEntry) => candidateEntry.id === peerId)) : null;
  return peer ? i18n.t('practice.label.toward', { entry: label, peer: deviceLabel(i18n, peer) }) : label;
}

const roleLabels = {
  'valid-ipv4': 'field.address',
  'octet-boundary': 'field.address',
  network: 'field.network',
  'direct-network': 'field.network',
  broadcast: 'field.broadcast',
  'first-host': 'field.firstHost',
  'last-host': 'field.lastHost',
  mask: 'field.prefix',
  'route-prefix': 'field.prefix',
  'route-destination': 'field.destination',
  gateway: 'field.gateway',
};

export function describeField(i18n, exercise, field) {
  const meta = exercise.fieldMeta?.[field];
  const [deviceId, section, entryId, property] = field.split('.');
  const device = exercise.devices?.find((candidate) => candidate.id === deviceId);
  const entries = ['interfaces', 'routes'].includes(section) ? device?.[section] : null;
  const index = entries?.findIndex((entry) => entry.id === entryId) ?? -1;
  if (index >= 0) {
    const fieldKey = ['address', 'prefix', 'destination', 'gateway'].includes(property)
      ? `field.${property}` : 'practice.label.configuration';
    return i18n.t('practice.label.field', {
      device: deviceLabel(i18n, device),
      entry: entryLabel(i18n, device, section, entries[index], index, exercise.devices, exercise.links),
      field: i18n.t(fieldKey),
    });
  }
  return i18n.t(roleLabels[meta?.role]
    ?? (meta?.kind === 'prefix' ? 'field.prefix' : 'practice.label.configuration'));
}
