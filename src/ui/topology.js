import { element } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function deviceForInterface(devices, interfaceId) {
  return devices.find((device) => device.interfaces.some((entry) => entry.id === interfaceId));
}

function packetFlowOrder(devices, links) {
  const neighbors = new Map(devices.map((device) => [device.id, []]));
  links.forEach((link) => {
    const first = deviceForInterface(devices, link.a);
    const second = deviceForInterface(devices, link.b);
    if (!first || !second) return;
    neighbors.get(first.id).push(second);
    neighbors.get(second.id).push(first);
  });
  const ordered = [];
  const visited = new Set();
  const visit = (device) => {
    if (!device || visited.has(device.id)) return;
    visited.add(device.id);
    ordered.push(device);
    [...(neighbors.get(device.id) ?? [])]
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .forEach(visit);
  };
  visit(devices.find((device) => device.kind === 'internet') ?? devices[0]);
  devices.forEach(visit);
  return ordered;
}

export function nearestEdgePoints(a, b, canvas) {
  const aCenter = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 };
  const bCenter = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
  const horizontal = Math.abs(bCenter.x - aCenter.x) >= Math.abs(bCenter.y - aCenter.y);
  const startViewport = horizontal
    ? { x: bCenter.x >= aCenter.x ? a.right : a.left, y: aCenter.y }
    : { x: aCenter.x, y: bCenter.y >= aCenter.y ? a.bottom : a.top };
  const endViewport = horizontal
    ? { x: bCenter.x >= aCenter.x ? b.left : b.right, y: bCenter.y }
    : { x: bCenter.x, y: bCenter.y >= aCenter.y ? b.top : b.bottom };

  return {
    start: { x: startViewport.x - canvas.left, y: startViewport.y - canvas.top },
    end: { x: endViewport.x - canvas.left, y: endViewport.y - canvas.top },
  };
}

export function createTopology({
  i18n,
  devices,
  links,
  selectedDeviceId,
  onSelect = () => {},
}) {
  const mobileQuery = globalThis.matchMedia?.('(max-width: 599px)');
  const canvas = element('section', {
    className: 'topology-canvas',
    'data-topology': '',
    'aria-label': i18n.t('accessibility.topology'),
  });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'topology-links');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const deviceLayer = element('div', {
    className: 'topology-devices',
    role: 'group',
    'aria-label': i18n.t('accessibility.deviceList'),
  });
  const nodes = new Map();
  const paths = [];

  function isMobile() {
    return mobileQuery?.matches ?? globalThis.innerWidth < 600;
  }

  function applyMode() {
    canvas.dataset.topologyMode = isMobile() ? 'stacked' : 'diagram';
  }

  packetFlowOrder(devices, links).forEach((device) => {
    const label = i18n.t(device.labelKey);
    const node = element('button', {
      className: `topology-device topology-device-${device.kind}`,
      type: 'button',
      'data-device-id': device.id,
      'data-focus-key': `device:${device.id}`,
      'aria-label': i18n.t('action.selectDevice', { deviceId: label }),
      'aria-pressed': String(device.id === selectedDeviceId),
      style: `--device-x:${device.position.x}%;--device-y:${device.position.y}%;`,
      onClick: () => onSelect(device.id),
    }, [
      element('span', { className: 'topology-device-kind' }, [i18n.t(`device.${device.kind}`)]),
      element('strong', {}, [label]),
      element('small', {}, [device.kind === 'switch'
        ? i18n.t('topology.segment')
        : i18n.t('topology.interfaceCount', { count: device.interfaces.length })]),
    ]);
    nodes.set(device.id, node);
    deviceLayer.append(node);
  });

  links.forEach((link, index) => {
    const source = deviceForInterface(devices, link.a);
    const target = deviceForInterface(devices, link.b);
    if (!source || !target) return;
    const path = document.createElementNS(SVG_NS, 'path');
    path.dataset.link = String(index);
    path.dataset.source = source.id;
    path.dataset.target = target.id;
    svg.append(path);
    paths.push({ path, sourceId: source.id, targetId: target.id });
  });

  canvas.append(svg, deviceLayer);

  let frame = null;
  let destroyed = false;
  function updateLinks() {
    frame = null;
    if (destroyed || isMobile() || !canvas.isConnected) return;
    const svgRect = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${svgRect.width} ${svgRect.height}`);
    for (const { path, sourceId, targetId } of paths) {
      const sourceRect = nodes.get(sourceId).getBoundingClientRect();
      const targetRect = nodes.get(targetId).getBoundingClientRect();
      const endpoints = nearestEdgePoints(sourceRect, targetRect, svgRect);
      path.setAttribute('d', `M ${endpoints.start.x} ${endpoints.start.y} L ${endpoints.end.x} ${endpoints.end.y}`);
      path.dataset.endpoints = [
        endpoints.start.x + svgRect.left,
        endpoints.start.y + svgRect.top,
        endpoints.end.x + svgRect.left,
        endpoints.end.y + svgRect.top,
      ].join(',');
    }
  }

  function scheduleLinks() {
    if (destroyed) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateLinks);
  }

  function handleModeChange() {
    applyMode();
    scheduleLinks();
  }

  applyMode();
  const observer = new ResizeObserver(scheduleLinks);
  observer.observe(canvas);
  mobileQuery?.addEventListener?.('change', handleModeChange);
  globalThis.addEventListener('resize', scheduleLinks);
  document.fonts?.ready.then(scheduleLinks);
  scheduleLinks();

  return {
    element: canvas,
    updateLinks: scheduleLinks,
    destroy() {
      destroyed = true;
      observer.disconnect();
      mobileQuery?.removeEventListener?.('change', handleModeChange);
      globalThis.removeEventListener('resize', scheduleLinks);
      if (frame !== null) cancelAnimationFrame(frame);
    },
  };
}
