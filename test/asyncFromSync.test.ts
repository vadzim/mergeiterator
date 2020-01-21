import {
	setDummyHandlers,
	setCompatHandlers,
	dummyForAwaitOfSyncWrapper,
	dummyAsyncFromSync,
	compatAsyncFromSync,
	compatForAwaitOfSyncWrapper,
} from "../src/polyfills/asyncFromSync"

async function toArray<T>(it: AsyncIterable<T>): Promise<T[]> {
	const ret: T[] = []
	for await (const x of it) {
		ret.push(x)
	}
	return ret
}

function next<T>(it: AsyncIterator<T>): AsyncIterator<T> {
	it.next()
	return it
}

describe("asyncFromSync", () => {
	test("setDummyHandlers does not throw", () => {
		setDummyHandlers()
	})

	test("setCompatHandlers does not throw", () => {
		setCompatHandlers()
	})

	test("compatForAwaitOfSyncWrapper does not throw on array", async () => {
		await expect(toArray(compatForAwaitOfSyncWrapper([2, 4, 6]))).resolves.toEqual([2, 4, 6])
	})

	test("compatForAwaitOfSyncWrapper does not throw on async iterable", async () => {
		await expect(
			toArray(
				compatForAwaitOfSyncWrapper(
					(async function*() {
						yield* [2, 4, 6]
					})(),
				),
			),
		).resolves.toEqual([2, 4, 6])
	})

	test("dummyForAwaitOfSyncWrapper does not throw", () => {
		expect(dummyForAwaitOfSyncWrapper([2, 4, 6])).toEqual([2, 4, 6])
	})

	test("dummyAsyncFromSync does not throw", async () => {
		await expect(toArray(dummyAsyncFromSync([2, 4, 6]))).resolves.toEqual([2, 4, 6])
	})

	test("compatAsyncFromSync works", async () => {
		await expect(toArray(compatAsyncFromSync([2, 4, 6]))).resolves.toEqual([2, 4, 6])
		await expect(toArray(compatAsyncFromSync([2, Promise.resolve(4), 6]))).resolves.toEqual([2, 4, 6])
		await expect(
			toArray(
				compatAsyncFromSync(
					(function*() {
						yield* [2, 4, 6]
					})(),
				),
			),
		).resolves.toEqual([2, 4, 6])
		await expect(
			toArray(
				compatAsyncFromSync(
					(function*() {
						yield* [2, Promise.resolve(4), 6]
					})(),
				),
			),
		).resolves.toEqual([2, 4, 6])
	})

	test("compatAsyncFromSync throws on rejected promise", async () => {
		await expect(toArray(compatAsyncFromSync([2, Promise.reject(new Error("4")), 6]))).rejects.toThrow("4")
		await expect(
			toArray(
				compatAsyncFromSync(
					(function*() {
						yield* [2, Promise.reject(new Error("4")), 6]
					})(),
				),
			),
		).rejects.toThrow("4")
	})

	test("compatAsyncFromSync throws on throw", async () => {
		await expect(
			toArray(
				compatAsyncFromSync(
					(function*() {
						yield* [2, 4, 6]
						throw new Error("throw")
					})(),
				),
			),
		).rejects.toThrow("throw")
	})

	test("compatAsyncFromSync does not throw on force returning", async () => {
		await expect(next(compatAsyncFromSync([2, 4, 6])[Symbol.asyncIterator]()).return?.(8)).resolves.toEqual({
			done: true,
			value: 8,
		})

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						yield* [2, 4, 6]
					})(),
				)[Symbol.asyncIterator](),
			).return?.(8),
		).resolves.toEqual({ done: true, value: 8 })

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						try {
							yield* [2, 4, 6]
						} finally {
							yield 10
						}
					})(),
				)[Symbol.asyncIterator](),
			).return?.(8),
		).resolves.toEqual({ done: false, value: 10 })
	})

	test("compatAsyncFromSync throws on force returning rejected promise", async () => {
		await expect(
			next(compatAsyncFromSync([2, 4, 6])[Symbol.asyncIterator]()).return?.(Promise.reject(new Error("return"))),
		).rejects.toThrow("return")

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						yield* [2, 4, 6]
					})(),
				)[Symbol.asyncIterator](),
			).return?.(Promise.reject(new Error("return"))),
		).rejects.toThrow("return")

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						try {
							yield* [2, 4, 6]
						} finally {
							// eslint-disable-next-line no-unsafe-finally
							throw new Error("finally")
						}
					})(),
				)[Symbol.asyncIterator](),
			).return?.(Promise.reject(new Error("return"))),
		).rejects.toThrow("finally")
	})

	test("compatAsyncFromSync throws on force throwing", async () => {
		await expect(
			next(compatAsyncFromSync([2, 4, 6])[Symbol.asyncIterator]()).throw?.(new Error("throw")),
		).rejects.toThrow("throw")

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						yield* [2, 4, 6]
					})(),
				)[Symbol.asyncIterator](),
			).throw?.(new Error("throw")),
		).rejects.toThrow("throw")

		await expect(
			next(
				compatAsyncFromSync(
					(function*() {
						try {
							yield* [2, 4, 6]
						} finally {
							// eslint-disable-next-line no-unsafe-finally
							throw new Error("finally")
						}
					})(),
				)[Symbol.asyncIterator](),
			).throw?.(new Error("throw")),
		).rejects.toThrow("finally")
	})
})
