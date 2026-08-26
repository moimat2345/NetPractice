/**
 * @typedef {{ id:string, address:number|null, prefix:number|null, editable:{address:boolean,prefix:boolean} }} NetworkInterface
 * @typedef {{ id:string, destination:number, prefix:number, gateway:number, editable:{destination:boolean,prefix:boolean,gateway:boolean} }} Route
 * @typedef {{ id:string, kind:'host'|'router'|'switch'|'internet', labelKey:string, interfaces:NetworkInterface[], routes:Route[], position:{x:number,y:number} }} Device
 * @typedef {{ id:string, seed:string, type:'focused'|'mission', concept:string, difficulty:number, devices:Device[], links:{a:string,b:string}[], goals:{sourceId:string,destinationId:string}[], editableFields:string[], initial:Record<string,string>, solution:Record<string,string> }} Exercise
 */

export function assertExercise(exercise) {
  if (!exercise || !exercise.id || !exercise.seed) {
    throw new TypeError('Exercise identity is required');
  }
  if (!['focused', 'mission'].includes(exercise.type)) {
    throw new TypeError('Exercise type is invalid');
  }
  if (!Array.isArray(exercise.devices) || exercise.devices.length < 2) {
    throw new TypeError('Exercise requires devices');
  }

  const deviceIds = new Set(exercise.devices.map((device) => device.id));
  if (deviceIds.size !== exercise.devices.length) {
    throw new TypeError('Device ids must be unique');
  }

  const interfaceIds = new Set(exercise.devices.flatMap((device) =>
    device.interfaces.map((entry) => entry.id)));
  for (const link of exercise.links) {
    if (!interfaceIds.has(link.a) || !interfaceIds.has(link.b)) {
      throw new TypeError('Link references an unknown interface');
    }
  }
  for (const goal of exercise.goals) {
    if (!deviceIds.has(goal.sourceId) || !deviceIds.has(goal.destinationId)) {
      throw new TypeError('Goal references an unknown device');
    }
  }
  for (const field of exercise.editableFields) {
    if (!(field in exercise.solution)) {
      throw new TypeError(`Editable field ${field} lacks a solution`);
    }
  }
}
