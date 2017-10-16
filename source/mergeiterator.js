import defineConstants from "define-constants"

const getIterator = iterable =>
	typeof iterable[Symbol.asyncIterator] === "function"
		? iterable[Symbol.asyncIterator]()
		: typeof iterable[Symbol.iterator] === "function"
			? iterable[Symbol.iterator]()
			: typeof iterable.next === "function" ? iterable : iterable[Symbol.asyncIterator]()

const { CONTINUATION, RETURN, VALUE, ERROR } = defineConstants()

export default async function* merge(sequences) {
	const sequenceIterator = getIterator(sequences)
	let iteratorsCount = 1
	let onOpPushed = () => {}
	const ops = []
	let inputClosed = false

	function pushOp(what, data) {
		ops.push({ what, data })
		onOpPushed()
	}

	function onIteratorClosed() {
		--iteratorsCount
		if (iteratorsCount === 0) {
			pushOp(RETURN, undefined)
		}
	}

	function closeIterator(iterator) {
		Promise.resolve(iterator.return && iterator.return())
			.catch(error => {
				pushOp(ERROR, error)
			})
			.then(onIteratorClosed)
	}

	function readSequenceIterator() {
		if (inputClosed) {
			return closeIterator(sequenceIterator)
		}
		Promise.resolve(sequenceIterator.next()).then(
			({ value, done }) => {
				if (done) {
					return onIteratorClosed()
				}
				if (inputClosed) {
					return closeIterator(sequenceIterator)
				}
				Promise.resolve(value).then(
					value => {
						if (inputClosed) {
							return closeIterator(sequenceIterator)
						}
						const dataIterator = getIterator(value)
						++iteratorsCount
						pushOp(CONTINUATION, readDataIterator) // do not call readDataIterator directly to hold possible exceptions in the right place
						pushOp(CONTINUATION, readSequenceIterator)

						function readDataIterator() {
							if (inputClosed) {
								return closeIterator(dataIterator)
							}
							Promise.resolve(dataIterator.next()).then(
								({ value, done }) => {
									if (done) {
										return onIteratorClosed()
									}
									if (inputClosed) {
										return closeIterator(dataIterator)
									}
									Promise.resolve(value).then(
										value => {
											if (inputClosed) {
												return closeIterator(dataIterator)
											}
											pushOp(VALUE, value)
											pushOp(CONTINUATION, readDataIterator)
										},
										error => {
											pushOp(ERROR, error)
											closeIterator(dataIterator)
										},
									)
								},
								error => {
									pushOp(ERROR, error)
									onIteratorClosed()
								},
							)
						}
					},
					error => {
						pushOp(ERROR, error)
						closeIterator(sequenceIterator)
					},
				)
			},
			error => {
				pushOp(ERROR, error)
				onIteratorClosed()
			},
		)
	}

	pushOp(CONTINUATION, readSequenceIterator)

	try {
		for (;;) {
			if (ops.length === 0) {
				await new Promise(resolve => (onOpPushed = resolve))
			}
			const { what, data } = ops.shift()

			switch (what) {
				case CONTINUATION:
					data()
					break
				case RETURN:
					return
				case VALUE:
					yield data
					break
				case ERROR:
					throw data
			}
		}
	} finally {
		inputClosed = true
		while (iteratorsCount > 0) {
			if (ops.length === 0) {
				await new Promise(resolve => (onOpPushed = resolve))
			}
			const { what, data } = ops.shift()
			if (what === CONTINUATION) {
				data()
			}
		}
	}
}
