export class AsyncFromSyncIterator<T, TReturn, TNext> implements AsyncGenerator<T, TReturn | undefined, TNext> {
	constructor(
		private it: Iterator<T | PromiseLike<T>, TReturn | undefined | PromiseLike<TReturn | undefined>, TNext>,
	) {}

	next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn | undefined>> {
		try {
			return this.await(this.it.next(...args))
		} catch (error) {
			return Promise.reject(error)
		}
	}

	throw(e: unknown): Promise<IteratorResult<T, TReturn | undefined>> {
		try {
			return this.it.throw === undefined ? Promise.reject(e) : this.await(this.it.throw(e))
		} catch (error) {
			return Promise.reject(error)
		}
	}

	return(
		value: TReturn | undefined | PromiseLike<TReturn | undefined>,
	): Promise<IteratorResult<T, TReturn | undefined>> {
		return Promise.resolve(value).then(
			(resolved: TReturn | undefined) => {
				if (this.it.return === undefined) {
					return { done: true, value: resolved }
				}
				const rec = this.it.return(resolved)
				return rec.done
					? Promise.resolve(rec.value).then(ret => ({ done: true, value: ret }))
					: Promise.resolve(rec.value).then(ret => ({ done: false, value: ret }))
			},
			error => {
				if (this.it.return === undefined) {
					return Promise.reject(error)
				}
				const rec = this.it.return()
				return Promise.resolve(rec.value).then(() => Promise.reject(error))
			},
		)
	}

	[Symbol.asyncIterator](): AsyncGenerator<T, TReturn | undefined, TNext> {
		return this
	}

	private await(
		rec: IteratorResult<T | PromiseLike<T>, TReturn | undefined | PromiseLike<TReturn | undefined>>,
	): Promise<IteratorResult<T, TReturn | undefined>> {
		return rec.done
			? Promise.resolve(rec.value).then(ret => ({ done: true, value: ret }))
			: Promise.resolve(rec.value).then(
					ret => ({ done: false, value: ret }),
					error => this.return(undefined).then(() => Promise.reject(error)),
			  )
	}
}

export function compatAsyncFromSync<T>(iterable: Iterable<T | PromiseLike<T>>): AsyncIterable<T> {
	return {
		[Symbol.asyncIterator]() {
			return new AsyncFromSyncIterator(iterable[Symbol.iterator]())
		},
	}
}

export function compatForAwaitOfSyncWrapper<T>(
	iterable: Iterable<T | PromiseLike<T>> | AsyncIterable<T>,
): Iterable<T | PromiseLike<T>> | AsyncIterable<T> {
	if (Symbol.asyncIterator in iterable) {
		return iterable
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
				checks = Infinity
			} finally {
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
					checks = Infinity
				} finally {
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

async function checkEngine() {
	setCompatHandlers()
	if (await isEngineValid()) {
		setDummyHandlers()
	}
}

checkEngine()
