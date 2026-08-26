import { formatIPv4 } from '../core/ipv4.js';
import { element } from './dom.js';

function fieldId(deviceId, section, entryId, property) {
  return `${deviceId}.${section}.${entryId}.${property}`;
}

function displayedValue(property, value) {
  if (value === null || value === undefined) return '—';
  if (property === 'prefix') return `/${value}`;
  return formatIPv4(value);
}

function configField({ i18n, device, section, entry, property, submission, onChange, index }) {
  const editable = Boolean(entry.editable?.[property]);
  const id = fieldId(device.id, section, entry.id, property);
  const inputId = `device-field-${device.id}-${section}-${index}-${property}`;
  const labelKey = property === 'destination'
    ? 'field.destination'
    : property === 'gateway'
      ? 'field.gateway'
      : property === 'prefix'
        ? 'field.prefix'
        : 'field.address';
  const label = i18n.t(labelKey);
  const control = editable
    ? element('input', {
      id: inputId,
      name: id,
      type: 'text',
      value: submission[id] ?? '',
      autocomplete: 'off',
      spellcheck: 'false',
      'data-focus-key': `field:${id}`,
      'aria-describedby': `${inputId}-note`,
      onInput: (event) => onChange(id, event.currentTarget.value),
    })
    : element('span', { className: 'device-field-value' }, [displayedValue(property, entry[property])]);

  return element('div', { className: `device-field${editable ? ' is-editable' : ''}` }, [
    element('label', editable ? { for: inputId } : {}, [label]),
    control,
    editable && element('small', { id: `${inputId}-note` }, [i18n.t('workshop.editable')]),
  ]);
}

function connectedPeers(device, devices, links) {
  const interfaces = new Set(device.interfaces.map((entry) => entry.id));
  const peers = [];
  for (const link of links) {
    const peerInterface = interfaces.has(link.a) ? link.b : interfaces.has(link.b) ? link.a : null;
    if (!peerInterface) continue;
    const peer = devices.find((candidate) =>
      candidate.interfaces.some((entry) => entry.id === peerInterface));
    if (peer && !peers.some((candidate) => candidate.id === peer.id)) peers.push(peer);
  }
  return peers;
}

function renderSwitchConfig(i18n, device, devices, links) {
  const peers = connectedPeers(device, devices, links);
  return element('div', { className: 'switch-connectivity' }, [
    element('p', { className: 'note-label' }, [i18n.t('topology.connectedSegment')]),
    element('p', {}, [i18n.t('topology.switchExplanation')]),
    element('ul', {}, peers.map((peer) => element('li', {}, [
      i18n.t(peer.labelKey),
      element('small', {}, [i18n.t(`device.${peer.kind}`)]),
    ]))),
  ]);
}

export function renderDeviceConfig({ i18n, device, devices, links, submission, onChange = () => {} }) {
  if (!device) {
    return element('p', { className: 'device-config-empty' }, [i18n.t('workshop.noSelection')]);
  }
  const titleId = `device-config-title-${device.id}`;
  const panel = element('section', {
    className: 'device-config',
    'data-device-config': device.id,
    'aria-labelledby': titleId,
  }, [
    element('header', { className: 'device-config-heading' }, [
      element('div', {}, [
        element('p', { className: 'note-label' }, [i18n.t(`device.${device.kind}`)]),
        element('h3', { id: titleId }, [i18n.t('workshop.selectedDevice', {
          deviceId: i18n.t(device.labelKey),
        })]),
      ]),
      element('span', { className: 'device-id' }, [device.id]),
    ]),
  ]);

  if (device.kind === 'switch') {
    panel.append(renderSwitchConfig(i18n, device, devices, links));
    return panel;
  }

  const groups = element('div', { className: 'device-config-groups' });
  if (device.interfaces.length > 0) {
    groups.append(element('section', { className: 'device-config-group' }, [
      element('h4', {}, [i18n.t('topology.interfaces')]),
      ...device.interfaces.map((entry, index) => element('article', { className: 'config-entry' }, [
        element('p', { className: 'config-entry-id' }, [entry.id]),
        element('div', { className: 'config-entry-fields' }, [
          configField({ i18n, device, section: 'interfaces', entry, property: 'address', submission, onChange, index }),
          configField({ i18n, device, section: 'interfaces', entry, property: 'prefix', submission, onChange, index }),
        ]),
      ])),
    ]));
  }
  if (device.routes.length > 0) {
    groups.append(element('section', { className: 'device-config-group' }, [
      element('h4', {}, [i18n.t('topology.routes')]),
      ...device.routes.map((entry, index) => element('article', { className: 'config-entry' }, [
        element('p', { className: 'config-entry-id' }, [
          element('span', {}, [String(index + 1).padStart(2, '0')]),
          entry.id,
        ]),
        element('div', { className: 'config-entry-fields route-fields' }, [
          configField({ i18n, device, section: 'routes', entry, property: 'destination', submission, onChange, index }),
          configField({ i18n, device, section: 'routes', entry, property: 'prefix', submission, onChange, index }),
          configField({ i18n, device, section: 'routes', entry, property: 'gateway', submission, onChange, index }),
        ]),
      ])),
    ]));
  }
  panel.append(groups);
  return panel;
}
