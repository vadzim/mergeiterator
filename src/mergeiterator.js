// @flow

import "./symbolAsyncIterator.js"

type AnyIterable<T, ReturnT = *> = $AsyncIterable<Promise<T> | T, ReturnT, void> | $Iterable<Promise<T> | T, ReturnT, void>

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T, ReturnT>(sequences: AnyIterable<AnyIterable<T>, ReturnT>): AsyncGenerator<T, ReturnT, void> {
	const rootIterator = getIterator(sequences)
	const ticks = [readRootIterator]
	const valueGetters = []
	let iteratorsCount = 1 // There is only rootIterator opened so far.
	let mergeDone = false
	let onStateChanged
	let normalReturn = true
	let rootReturnResult

	try {
		while (iteratorsCount > 0) {
			const stateChanged = new Promise(setOnStateChanged)
			while (ticks.length) ticks.shift()()
			await stateChanged
			while (valueGetters.length > 0) yield valueGetters.shift()()
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
			while (valueGetters.length > 0) valueGetters.shift()()
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

	function throwError(error) {
		iteratorsCount--
		valueGetters.push(() => {
			throw error
		})
		mergeDone = true
		onStateChanged()
	}

	function iteratorStopped() {
		iteratorsCount--
		onStateChanged()
	}

	function stopRootIterator() {
		stopIterator(rootIterator).then(
			({ done, value }) => {
				if (done) rootReturnResult = value
				iteratorStopped()
			},
			error => throwError(error),
		)
	}

	function stopChildIterator(iterator) {
		stopIterator(iterator).then(() => iteratorStopped(), error => throwError(error))
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
					iteratorStopped()
					return
				}
				if (mergeDone) {
					stopRootIterator()
					return
				}
				let iterator
				try {
					iterator = getIterator(value)
				} catch (e) {
					throwError(e)
					stopRootIterator()
					return
				}
				iteratorsCount++
				ticks.push(getChildReader(iterator))
				ticks.push(readRootIterator)
				onStateChanged()
			},
			error => throwError(error),
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
						iteratorStopped()
						return
					}
					if (mergeDone) {
						stopChildIterator(iterator)
						return
					}
					ticks.push(readChildIterator)
					valueGetters.push(() => (value: any))
					onStateChanged()
				},
				error => throwError(error),
			)
		}
	}
}

const getIterator = (iterable: any): any => {
	const method = iterable[(Symbol: any).asyncIterator] || iterable[Symbol.iterator]
	if (method) return (method.call(iterable): any)
	if (typeof iterable.next === "function") return iterable
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
	PromiseTry(() => (iterator.return ? iterator.return() : { done: true, value: undefined })).then(({ done, value }) =>
		Promise.resolve(value).then(v => ({ done, value: v })),
	)

const PromiseTry = func => {
	try {
		return Promise.resolve(func())
	} catch (error) {
		return Promise.reject(error)
	}
}
