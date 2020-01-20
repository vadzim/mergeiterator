// @flow

import { type AnyIterable } from "type-any-iterable"

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T>(sequences: AnyIterable<AnyIterable<T>>): AsyncGenerator<T, *, *> {
	//
	let onDataNeeded = () => {}
	let dataNeeded = new Promise(setOnDataNeeded)
	let onStateChanged = () => {} // should be called whenever values used in the main `while` loop have been changed. These are: iteratorsCount > 0 and values

	const values = []
	let iteratorsCount = 0
	let mergeDone = false
	let normalReturn = true

	readRoot()

	try {
		while (iteratorsCount > 0 || values.length > 0) {
			if (values.length > 0) {
				if (typeof values[0] === "object" && values[0] && typeof values[0].then === "function") {
					yield await (values.shift(): any)
				} else {
					yield values.shift()
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
			for await (const sequence of await (sequences: any)) {
				if (mergeDone) {
					break
				}
				readChild(sequence)
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

	async function readChild(sequence) {
		try {
			iteratorsCount++
			for await (const value of sequence) {
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

	function setOnStateChanged(resolve) {
		onStateChanged = resolve
	}

	function setOnDataNeeded(resolve) {
		onDataNeeded = resolve
	}
}

function getError(error): any {
	return { then: (resolve, reject) => reject(error) }
}
