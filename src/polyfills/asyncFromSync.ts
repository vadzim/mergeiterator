export async function* compatAsyncFromSync<T>(iterable: Iterable<T | PromiseLike<T>>): AsyncIterable<T> {
	const it = iterable[Symbol.iterator]()
	let needToClose
	try {
		for (;;) {
			needToClose = false
			const rec = it.next()
			needToClose = true
			if (rec.done) {
				needToClose = false
				return await rec.value
			}
			yield await rec.value
		}
	} finally {
		if (needToClose) {
			await it.return?.().value
		}
	}
}

export function compatForAwaitOfSyncWrapper<T>(
	iterable: Iterable<T | PromiseLike<T>> | AsyncIterable<T>,
): AsyncIterable<T> {
	if (Symbol.asyncIterator in iterable) {
		return iterable as AsyncIterable<T>
	}
	return compatAsyncFromSync((iterable as unknown) as Iterable<T | PromiseLike<T>>)
}

export async function* dummyAsyncFromSync<T>(iterable: Iterable<T | PromiseLike<T>>): AsyncIterable<T> {
	yield* iterable
}

export function dummyForAwaitOfSyncWrapper<T>(iterable: T): T {
	return iterable
}

// eslint-disable-next-line import/no-mutable-exports
export let asyncFromSync: { <T>(iterable: Iterable<T | PromiseLike<T>>): AsyncIterable<T> }

// eslint-disable-next-line import/no-mutable-exports
export let forAwaitOfSyncWrapper: {
	<T>(iterable: Iterable<T | PromiseLike<T>> | AsyncIterable<T>): Iterable<T | PromiseLike<T>> | AsyncIterable<T>
}

export function setDummyHandlers() {
	asyncFromSync = dummyAsyncFromSync
	forAwaitOfSyncWrapper = dummyForAwaitOfSyncWrapper
}

export function setCompatHandlers() {
	asyncFromSync = compatAsyncFromSync
	forAwaitOfSyncWrapper = compatForAwaitOfSyncWrapper
}

async function isEngineValid() {
	let checks = 2
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		for await (const x of (function*() {
			try {
				yield Promise.reject()
				// istanbul ignore next
				checks = Infinity
			} finally {
				// istanbul ignore next
				checks--
			}
			// eslint-disable-next-line no-empty
		})()) {
		}
		// eslint-disable-next-line no-empty
	} catch {}
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		for await (const x of (async function*() {
			yield* (function*() {
				try {
					yield Promise.reject()
					// istanbul ignore next
					checks = Infinity
				} finally {
					// istanbul ignore next
					checks--
				}
			})()
			// eslint-disable-next-line no-empty
		})()) {
		}
		// eslint-disable-next-line no-empty
	} catch {}
	return checks === 0
}

// istanbul ignore next
async function checkEngine() {
	setCompatHandlers()
	if (await isEngineValid()) {
		setDummyHandlers()
	}
}

checkEngine()
