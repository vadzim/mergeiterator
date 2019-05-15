// @flow

import "./symbolAsyncIterator.js"

type AnyIterable<T> = AsyncIterable<T> | Iterable<T>

/**
 * Merges async or sync iterables into async one.
 */
export async function* merge<T>(sequences: AnyIterable<AnyIterable<Promise<T> | T>>): AsyncIterator<T> {
	const sequenceIterator = getIterator(sequences)
	const readers = [nextMainSeq]
	const valueGetters = []
	let iteratorsCount = 1
	let mergeDone = false
	let onData
	let normalReturn = true

	try {
		while (iteratorsCount > 0) {
			const dataPresent = new Promise(setOnData)
			while (readers.length) readers.pop()()
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
			while (readers.length) readers.pop()()
			await dataPresent
		}
		if (normalReturn) while (valueGetters.length > 0) valueGetters.shift()()
	}

	function setOnData(resolve) {
		onData = resolve
	}

	function sendValue(value: T) {
		valueGetters.push(() => value)
		onData()
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

	function nextMainSeq() {
		if (mergeDone) {
			stopIterator(sequenceIterator).then(() => iteratorStopped(), error => throwError(error))
			return
		}
		readIterator(sequenceIterator).then(
			({ done, value }) => {
				if (done) {
					iteratorStopped()
					return
				}
				if (mergeDone) {
					stopIterator(sequenceIterator).then(() => iteratorStopped(), error => throwError(error))
					return
				}
				let iterator
				try {
					iterator = getIterator(value)
				} catch (e) {
					throwError(e)
					stopIterator(sequenceIterator).then(() => iteratorStopped(), error => throwError(error))
					return
				}
				iteratorsCount++
				readers.push(next(iterator))
				readers.push(nextMainSeq)
				onData()
			},
			error => throwError(error),
		)
	}

	function next(iterator) {
		return function nextSeq() {
			if (mergeDone) {
				stopIterator(iterator).then(() => iteratorStopped(), error => throwError(error))
				return
			}
			readIterator(iterator).then(
				({ done, value }) => {
					if (done) {
						iteratorStopped()
						return
					}
					if (mergeDone) {
						stopIterator(iterator).then(() => iteratorStopped(), error => throwError(error))
					}
					sendValue((value: any))
					readers.push(nextSeq)
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
