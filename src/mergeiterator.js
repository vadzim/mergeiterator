// @flow

import { type AnyIterable } from "type-any-iterable"

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T, ReturnT>(sequences: AnyIterable<AnyIterable<T>, ReturnT>): AsyncGenerator<T, ReturnT, void> {
	const rootIterator = getIterator(await sequences)
	const ticks = [readRootIterator]
	const getters = []
	let iteratorsCount = 1 // There is only rootIterator opened so far.
	let mergeDone = false
	let onStateChanged // should be called whenever values used in the main `while` loop have been changed. These are: iteratorsCount, ticks and getters
	let normalReturn = true
	let rootReturnResult

	try {
		while (iteratorsCount > 0) {
			const stateChanged = new Promise(setOnStateChanged)
			while (ticks.length) ticks.shift()()
			await stateChanged
			while (getters.length > 0) yield getters.shift()()
		}
	} catch (e) {
		normalReturn = false
		throw e
	} finally {
		mergeDone = true
		while (iteratorsCount > 0) {
			const stateChanged = new Promise(setOnStateChanged)
			while (ticks.length) ticks.shift()()
			await stateChanged
		}
		// Do not hide an exception if it's been already raised.
		if (normalReturn) {
			// Raise possible exceptions on iterators interruption.
			while (getters.length > 0) getters.shift()()
			// There is no chance to return a value out of finally block if .return() is called.
			// eslint-disable-next-line no-unsafe-finally
			return (rootReturnResult: any)
		}
	}

	// istanbul ignore next
	throw new Error("impossible")

	function setOnStateChanged(resolve) {
		onStateChanged = resolve
	}

	function stopRootIterator() {
		stopIterator(rootIterator).then(
			({ done, value }) => {
				if (done) rootReturnResult = value
				iteratorsCount--
				onStateChanged()
			},
			error => {
				getters.push(() => {
					throw error
				})
				mergeDone = true
				iteratorsCount--
				onStateChanged()
			},
		)
	}

	function stopChildIterator(iterator) {
		stopIterator(iterator).then(
			() => {
				iteratorsCount--
				onStateChanged()
			},
			error => {
				getters.push(() => {
					throw error
				})
				mergeDone = true
				iteratorsCount--
				onStateChanged()
			},
		)
	}

	function readRootIterator() {
		if (mergeDone) {
			stopRootIterator()
			return
		}
		readIterator(rootIterator).then(
			({ done, value }) => {
				if (done) {
					rootReturnResult = value
					iteratorsCount--
					onStateChanged()
					return
				}
				if (mergeDone) {
					stopRootIterator()
					return
				}
				let childIterator
				try {
					childIterator = getIterator(value)
				} catch (error) {
					stopRootIterator()
					getters.push(() => {
						throw error
					})
					mergeDone = true
					onStateChanged()
					return
				}
				iteratorsCount++
				ticks.push(readRootIterator)
				ticks.push(getChildReader(childIterator))
				onStateChanged()
			},
			error => {
				getters.push(() => {
					throw error
				})
				mergeDone = true
				iteratorsCount--
				onStateChanged()
			},
		)
	}

	function getChildReader(iterator) {
		return function readChildIterator() {
			if (mergeDone) {
				stopChildIterator(iterator)
				return
			}
			readIterator(iterator).then(
				({ done, value }) => {
					if (done) {
						iteratorsCount--
						onStateChanged()
						return
					}
					if (mergeDone) {
						stopChildIterator(iterator)
						return
					}
					ticks.push(readChildIterator)
					getters.push(() => (value: any))
					onStateChanged()
				},
				error => {
					getters.push(() => {
						throw error
					})
					mergeDone = true
					iteratorsCount--
					onStateChanged()
				},
			)
		}
	}
}

const getIterator = (iterable: any): any => {
	const method = iterable[(Symbol: any).asyncIterator] || iterable[Symbol.iterator]
	if (method) return (method.call(iterable): any)
	// eslint-disable-next-line no-unused-vars
	for (/* should throw here */ const x of iterable) {
		// istanbul ignore next
		throw new Error("impossible")
	}
	// istanbul ignore next
	throw new Error("impossible")
}

const readIterator = iterator => PromiseTry(() => iterator.next()).then(({ done, value }) => Promise.resolve(value).then(v => ({ done, value: v })))

const stopIterator = iterator =>
	PromiseTry(() => {
		const ret = iterator.return
		return !ret
			? { done: true, value: undefined }
			: Promise.resolve(ret.call(iterator)).then(({ done, value }) => Promise.resolve(value).then(v => ({ done, value: v })))
	})

const PromiseTry = func => {
	try {
		return Promise.resolve(func())
	} catch (error) {
		return Promise.reject(error)
	}
}
