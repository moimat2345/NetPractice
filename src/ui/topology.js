import { element } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function deviceForInterface(devices, interfaceId) {
  return devices.find((device) => device.interfaces.some((entry) => entry.id === interfaceId));
}

function deviceNeighbors(devices, links) {
  const neighbors = new Map(devices.map((device) => [device.id, []]));
  links.forEach((link) => {
    const first = deviceForInterface(devices, link.a);
    const second = deviceForInterface(devices, link.b);
    if (!first || !second) return;
    neighbors.get(first.id).push(second);
    neighbors.get(second.id).push(first);
  });
  return neighbors;
}

function packetFlowOrder(devices, links) {
  const neighbors = deviceNeighbors(devices, links);
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

// Give each graph depth its own row. Real card heights determine row spacing,
// so translated labels and diagnostic badges cannot collide with the next row.
export function layoutTopology(devices, links, width, sizes = new Map()) {
  const neighbors = deviceNeighbors(devices, links);
  const rows = [];
  const visited = new Set();
  const ordered = packetFlowOrder(devices, links);
  for (const root of ordered) {
    if (visited.has(root.id)) continue;
    visited.add(root.id);
    const queue = [{ device: root, depth: 0 }];
    for (const { device, depth } of queue) {
      (rows[depth] ??= []).push(device);
      for (const neighbor of neighbors.get(device.id)) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        queue.push({ device: neighbor, depth: depth + 1 });
      }
    }
  }
  const order = new Map(ordered.map((device, index) => [device.id, index]));
  rows.forEach((row) => row.sort((a, b) => order.get(a.id) - order.get(b.id)));
  const padding = 16;
  const gap = 24;
  const rowGap = 24;
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const nodeWidth = Math.min(136, (width - 2 * padding - (columns - 1) * gap) / columns);
  const positions = new Map();
  if (width < 480 || nodeWidth < 100) return { mode: 'stacked', positions, height: 0 };
  let y = padding;
  rows.forEach((row) => {
    const rowHeight = Math.max(...row.map((device) => sizes.get(device.id)?.height ?? 64));
    const rowWidth = row.length * nodeWidth + (row.length - 1) * gap;
    row.forEach((device, index) => {
      const height = sizes.get(device.id)?.height ?? 64;
      positions.set(device.id, {
        x: (width - rowWidth) / 2 + index * (nodeWidth + gap),
        y: y + (rowHeight - height) / 2,
        width: nodeWidth,
        height,
      });
    });
    y += rowHeight + rowGap;
  });
  return { mode: 'diagram', positions, height: y - rowGap + padding };
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
  deviceStatuses = {},
  onSelect = () => {},
}) {
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
  const neighbors = deviceNeighbors(devices, links);

  packetFlowOrder(devices, links).forEach((device) => {
    const label = i18n.t(device.labelKey);
    const status = deviceStatuses[device.id] ?? null;
    const statusLabel = status
      ? i18n.t(status === 'missing' ? 'exam.missingInformation' : 'exam.checkDevice')
      : null;
    const node = element('button', {
      className: `topology-device topology-device-${device.kind}`,
      type: 'button',
      'data-device-id': device.id,
      'data-device-status': status,
      'data-focus-key': `device:${device.id}`,
      'aria-label': statusLabel
        ? i18n.t('action.selectDeviceStatus', { deviceId: label, status: statusLabel })
        : i18n.t('action.selectDevice', { deviceId: label }),
      'aria-pressed': String(device.id === selectedDeviceId),
      'aria-describedby': neighbors.get(device.id).length ? `topology-${device.id}-neighbors` : null,
      onClick: () => onSelect(device.id),
    }, [
      element('span', { className: 'topology-device-kind' }, [i18n.t(`device.${device.kind}`)]),
      element('strong', {}, [label]),
      element('small', {}, [device.kind === 'switch'
        ? i18n.t('topology.segment')
        : i18n.t('topology.interfaceCount', { count: device.interfaces.length })]),
      status && element('span', { className: 'topology-device-status', 'aria-hidden': 'true' }, [statusLabel]),
      neighbors.get(device.id).length > 0 && element('span', {
        className: 'topology-neighbors', id: `topology-${device.id}-neighbors`,
      }, [
        element('span', { className: 'topology-neighbors-label' }, [i18n.t('topology.connectedTo')]),
        element('span', { className: 'topology-neighbors-list' }, neighbors.get(device.id).map((neighbor) =>
          element('span', { className: 'topology-neighbor', 'data-neighbor-id': neighbor.id }, [i18n.t(neighbor.labelKey)]))),
      ]),
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
    if (destroyed || !canvas.isConnected) return;
    const width = canvas.clientWidth;
    let layout = layoutTopology(devices, links, width);
    canvas.dataset.topologyMode = layout.mode;
    if (layout.mode === 'stacked') {
      canvas.style.removeProperty('height');
      return;
    }
    for (const [id, position] of layout.positions) {
      nodes.get(id).style.setProperty('--device-width', `${position.width}px`);
    }
    const sizes = new Map([...nodes].map(([id, node]) => [id, { height: node.getBoundingClientRect().height }]));
    layout = layoutTopology(devices, links, width, sizes);
    canvas.style.height = `${layout.height + 2}px`;
    for (const [id, position] of layout.positions) {
      nodes.get(id).style.setProperty('--device-x', `${position.x}px`);
      nodes.get(id).style.setProperty('--device-y', `${position.y}px`);
    }
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

  const observer = new ResizeObserver(scheduleLinks);
  observer.observe(canvas);
  nodes.forEach((node) => observer.observe(node));
  globalThis.addEventListener('resize', scheduleLinks);
  document.fonts?.ready.then(scheduleLinks);
  scheduleLinks();

  return {
    element: canvas,
    updateLinks: scheduleLinks,
    destroy() {
      destroyed = true;
      observer.disconnect();
      globalThis.removeEventListener('resize', scheduleLinks);
      if (frame !== null) cancelAnimationFrame(frame);
    },
  };
}
