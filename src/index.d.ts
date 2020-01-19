import { AnyIterable } from "type-any-iterable"

// eslint-disable-next-line import/no-default-export
export default function merge<T>(sequences: AnyIterable<AnyIterable<T>>): AsyncGenerator<T>
