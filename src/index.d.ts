import { AnyIterable } from "type-any-iterable"

export default function merge<T>(sequences: AnyIterable<AnyIterable<T>>): AsyncIterable<T>
