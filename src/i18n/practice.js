export const practiceFr = {
  required: 'À compléter',
  targetField: 'Champ à vérifier : {field}.',
  focusField: 'Modifier {field}',
  missingValue: 'Renseigne le champ « {field} » avant de vérifier ta réponse.',
  label: {
    device: 'Appareil',
    interface: 'Interface {number}',
    route: 'Route {number}',
    defaultRoute: 'route par défaut',
    toward: '{entry} vers {peer}',
    field: '{device} · {entry} · {field}',
    configuration: 'Champ de configuration',
  },
  correction: {
    localSubnet: 'Pars de l’interface de {device} à l’adresse {localAddress}/{prefix} : son réseau local est {network}/{prefix}.',
    routeDestination: 'La destination de {route} sur {device} est le réseau distant {network}/{prefix}. Le préfixe décrit ce réseau de destination.',
    gatewayLocal: 'Depuis {device}, l’interface {localAddress}/{prefix} permet de joindre directement la passerelle {gateway} dans le réseau local {network}/{prefix}. Utilise le masque de cette interface pour vérifier la passerelle.',
    maskBits: 'Le masque {mask} contient {prefix} bits à 1 depuis la gauche : il s’écrit /{prefix}. Chaque octet complet ajoute huit bits.',
    expectedIntro: 'Compare enfin chaque champ avec les valeurs calculées :',
  },
};

export const practiceEn = {
  required: 'Required',
  targetField: 'Field to check: {field}.',
  focusField: 'Edit {field}',
  missingValue: 'Fill in “{field}” before checking your answer.',
  label: {
    device: 'Device',
    interface: 'Interface {number}',
    route: 'Route {number}',
    defaultRoute: 'default route',
    toward: '{entry} toward {peer}',
    field: '{device} · {entry} · {field}',
    configuration: 'Configuration field',
  },
  correction: {
    localSubnet: 'Start with the interface on {device} at {localAddress}/{prefix}: its local network is {network}/{prefix}.',
    routeDestination: 'The destination of {route} on {device} is remote network {network}/{prefix}. The prefix describes this destination network.',
    gatewayLocal: 'On {device}, interface {localAddress}/{prefix} can directly reach gateway {gateway} on local network {network}/{prefix}. Use this interface’s mask to check gateway reachability.',
    maskBits: 'Mask {mask} has {prefix} leading one bits, so its CIDR form is /{prefix}. Each complete octet adds eight bits.',
    expectedIntro: 'Finally compare each field with the calculated values:',
  },
};
