import { integer, minValue, number, object, optional, pipe } from 'valibot'

/** Absolute deadline is preserved across CLI, IPC and HTTP hops. */
export const readOperationFields = {
  operation: optional(object({ deadlineAt: pipe(number(), integer(), minValue(1)) })),
}
