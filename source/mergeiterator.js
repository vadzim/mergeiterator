const getIterator = iterable =>
	typeof iterable[Symbol.asyncIterator] === "function"
		? iterable[Symbol.asyncIterator]()
		: typeof iterable[Symbol.iterator] === "function"
			? iterable[Symbol.iterator]()
			: typeof iterable.next === "function" ? iterable : iterable[Symbol.asyncIterator]()

const resolveDone = value => ({ value, done: true })
const resolveNotDone = value => ({ value, done: false })
const resolveRecord = ({ value, done }) => Promise.resolve(value).then(done ? resolveDone : resolveNotDone)
const resolveThenable = promise => Promise.resolve(promise).then(resolveRecord)

export default function merge(sequences) {
	const sequenceIterator = getIterator(sequences)
	const ticks = []
	const results = []
	const resolvers = []
	const returnedValues = []
	let mergeResult = { value: returnedValues, done: true }
	let mergeResover,
		mergePromise = new Promise(resolve => (mergeResover = resolve))
	let inputClosed = false
	let outputClosed = false
	let count = 0
	let remainingIterators = 1

	function copyResults() {
		while (!outputClosed && resolvers.length > 0 && results.length > 0) {
			resolvers.shift()(results.shift())
		}
		if (inputClosed || outputClosed) {
			while (resolvers.length > 0) {
				resolvers.shift()({ value: undefined, done: true })
			}
		}
		if (resolvers.length > 0 || inputClosed || outputClosed) {
			while (ticks.length) {
				ticks.shift()()
			}
		}
	}

	function pushResult(promise) {
		if (!inputClosed) {
			results.push(promise)
		}
	}

	function iteratorFinished() {
		--remainingIterators
		if (remainingIterators === 0) {
			pushResult(mergeResult)
			close()
			mergeResover(mergeResult)
		}
	}

	function closeIterator(iterator, returnIndex) {
		if (typeof iterator.return === "function") {
			resolveThenable(iterator.return())
				.then(
					({ value, done }) => {
						if (done) {
							returnedValues[returnIndex] = value
						}
					},
					error => {
						mergeResult = Promise.reject(error)
					},
				)
				.then(iteratorFinished)
		} else {
			iteratorFinished()
		}
	}

	function closeSeq() {
		closeIterator(sequenceIterator, "value")
	}

	function nextSeq() {
		if (inputClosed) {
			return closeIterator(sequenceIterator, "value")
		}
		const sequencePromise = resolveThenable(sequenceIterator.next())
		sequencePromise.then(
			function onSequenceResolve({ value, done }) {
				if (done) {
					returnedValues.value = value
					iteratorFinished()
				} else {
					++remainingIterators
					const index = count++
					const valueIterator = getIterator(value)

					function nextValue() {
						if (inputClosed) {
							return closeIterator(valueIterator, index)
						}
						const valuePromise = resolveThenable(valueIterator.next())
						valuePromise.then(
							function onValueResolve({ value, done }) {
								if (done) {
									returnedValues[index] = value
									iteratorFinished()
								} else {
									pushResult(valuePromise)
									ticks.push(nextValue)
									copyResults()
								}
							},
							function onValueReject() {
								pushResult(valuePromise)
								close()
							},
						)
					}

					nextValue()
					ticks.push(nextSeq)
					copyResults()
				}
			},
			function onSequenceReject() {
				pushResult(sequencePromise)
				close()
			},
		)
	}

	function close() {
		inputClosed = true
		copyResults()
	}

	ticks.push(nextSeq)

	const iterator = {
		[Symbol.asyncIterator]: () => iterator,
		next: () =>
			new Promise(resolve => {
				resolvers.push(resolve)
				copyResults()
			}),
		return: value =>
			new Promise(resolve => {
				if (resolvers.length === 0) {
					finish()
				} else {
					const last = resolvers.pop()
					resolvers.push(value => {
						last(value)
						finish()
					})
				}
				function finish() {
					outputClosed = true
					mergeResult = { value, done: true }
					resolve(mergePromise)
					close()
				}
			}),
	}

	return iterator
}
