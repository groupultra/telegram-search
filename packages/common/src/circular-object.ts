export function circularStringify(object: Record<string, any>) {
  const simpleObject: Record<string, any> = {}
  for (const prop in object) {
    if (!Object.prototype.hasOwnProperty.call(object, prop)) {
      continue
    }
    if (typeof (object[prop]) === 'object') {
      continue
    }
    if (typeof (object[prop]) == 'function') {
      continue
    }
    simpleObject[prop] = object[prop]
  }
  return JSON.stringify(simpleObject)
}

export function circularObject(object: Record<string, any>) {
  return JSON.parse(circularStringify(object))
}
