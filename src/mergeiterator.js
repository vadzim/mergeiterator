// @flow

import "./symbolAsyncIterator.js"

type AnyIterable<T> = AsyncIterable<T> | Iterable<T>

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T>(sequences: AnyIterable<AnyIterable<Promise<T> | T>>): AsyncIterator<T> {
	const rootIterator = getIterator(sequences)
	const readers = [readRootIterator]
	const valueGetters = []
	let iteratorsCount = 1
	let mergeDone = false
	let onData
	let normalReturn = true
	let rootReturnResult

	try {
		while (iteratorsCount > 0) {
			const dataPresent = new Promise(setOnData)
			while (readers.length) readers.shift()()
			await dataPresent
			while (valueGetters.length > 0) yield valueGetters.shift()()
		}
	} catch (e) {
		normalReturn = false
		throw e
	} finally {
		mergeDone = true
		while (iteratorsCount > 0) {
			const dataPresent = new Promise(setOnData)
			while (readers.length) readers.shift()()
			await dataPresent
		}
		// Do not hide an exception if it's been already raised.
		if (normalReturn) {
			// Raise possible exceptions on iterators interruption.
			while (valueGetters.length > 0) valueGetters.shift()()
			// There is no chance to return a value out of finally block if .return() is called.
			// eslint-disable-next-line no-unsafe-finally
			return rootReturnResult
		}
	}

	// istanbul ignore next
	throw new Error("impossible")

	function setOnData(resolve) {
		onData = resolve
	}

	function throwError(error) {
		iteratorsCount--
		valueGetters.push(() => {
			throw error
		})
		mergeDone = true
		onData()
	}

	function iteratorStopped() {
		iteratorsCount--
		onData()
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
				readers.push(getChildReader(iterator))
				readers.push(readRootIterator)
				onData()
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
					readers.push(readChildIterator)
					valueGetters.push(() => (value: any))
					onData()
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
	for (const x of iterable) {
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
