import { AnyIterable } from "type-any-iterable"
import { forAwaitOfSyncWrapper } from "./polyfills/asyncFromSync"

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T>(sequences: AnyIterable<AnyIterable<T>>): AsyncGenerator<T> {
	//
	let onDataNeeded = () => {}
	let dataNeeded = new Promise(setOnDataNeeded)
	let onStateChanged = () => {} // should be called whenever values used in the main `while` loop have been changed. These are: iteratorsCount > 0 and values

	const values: (T | PromiseLike<never>)[] = []
	let iteratorsCount = 0
	let mergeDone = false
	let normalReturn = true

	readRoot()

	try {
		while (iteratorsCount > 0 || values.length > 0) {
			if (values.length > 0) {
				const value = values.shift()
				if (typeof value === "object" && value && "then" in value && typeof value.then === "function") {
					yield await value
				} else {
					yield value as T
				}
			} else {
				const oldOnDataNeeded = onDataNeeded

				dataNeeded = new Promise(setOnDataNeeded)
				const stateChanged = new Promise(setOnStateChanged)

				oldOnDataNeeded()
				await stateChanged
			}
		}
	} catch (error) {
		normalReturn = false
		throw error
	} finally {
		mergeDone = true
		onDataNeeded()
		while (iteratorsCount > 0) {
			await new Promise(setOnStateChanged)
		}
		// Do not hide an exception if it's been already raised.
		if (normalReturn) {
			// Raise possible exceptions on iterators interruption.
			while (values.length > 0) await values.shift()
		}
	}

	async function readRoot() {
		try {
			iteratorsCount++
			for await (const sequence of forAwaitOfSyncWrapper(await sequences)) {
				if (mergeDone) {
					break
				}
				readChild(sequence as Iterable<T | PromiseLike<T>> | AsyncIterable<T>)
				if (values.length > 0) {
					await dataNeeded
				}
				if (mergeDone) {
					break
				}
			}
		} catch (error) {
			values.push(getError(error))
			onStateChanged()
		} finally {
			iteratorsCount--
			if (iteratorsCount === 0) {
				onStateChanged()
			}
		}
	}

	async function readChild(sequence: Iterable<T | PromiseLike<T>> | AsyncIterable<T>) {
		try {
			iteratorsCount++
			for await (const value of forAwaitOfSyncWrapper(sequence)) {
				values.push(value)
				onStateChanged()
				await dataNeeded
				if (mergeDone) {
					break
				}
			}
		} catch (error) {
			values.push(getError(error))
			onStateChanged()
		} finally {
			iteratorsCount--
			if (iteratorsCount === 0) {
				onStateChanged()
			}
		}
	}

	function setOnStateChanged(resolve: () => void) {
		onStateChanged = resolve
	}

	function setOnDataNeeded(resolve: () => void) {
		onDataNeeded = resolve
	}
}

function getError(error: unknown): PromiseLike<never> {
	return {
		then: (resolve: (value: never) => PromiseLike<never>, reject: (error: unknown) => PromiseLike<never>) =>
			reject(error),
	}
}
