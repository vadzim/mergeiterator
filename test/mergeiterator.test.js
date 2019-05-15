// @flow

import merge from "../src/index.js"

declare var describe
declare var test
declare var expect

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Deferred<T> {
	resolve: T => void

	promise = new Promise<T>(resolve => {
		this.resolve = resolve
	})
}

async function* repeat(value, count = Infinity, interval = 0, onDone = undefined) {
	try {
		for (let i = 0; i < count; ++i) {
			yield value
			await sleep(interval)
		}
	} finally {
		if (onDone) onDone()
	}
}

describe("mergeiterator", () => {
	describe("test time intervals", () => {
		test("test", async () => {
			const done = new Deferred()
			const it = merge([
				[1, 2, 2],
				repeat(3, 5, 333),
				repeat(5, Infinity, 555, done.resolve),
				[
					sleep(777).then(() => 7),
					sleep(1777).then(() => {
						// eslint-disable-next-line no-throw-literal
						throw 10
					}),
				],
			])
			expect(await it.next()).toEqual({ value: 1, done: false }) // 0ms
			expect(await it.next()).toEqual({ value: 2, done: false }) // 0
			expect(await it.next()).toEqual({ value: 3, done: false }) // 0 #3.1
			expect(await it.next()).toEqual({ value: 2, done: false }) // 0
			expect(await it.next()).toEqual({ value: 5, done: false }) // 0 #5.1
			expect(await it.next()).toEqual({ value: 3, done: false }) // 333 #3.2
			expect(await it.next()).toEqual({ value: 5, done: false }) // 555 #5.2
			expect(await it.next()).toEqual({ value: 3, done: false }) // 666 #3.3
			expect(await it.next()).toEqual({ value: 7, done: false }) // 777
			expect(await it.next()).toEqual({ value: 3, done: false }) // 999 #3.4
			expect(await it.next()).toEqual({ value: 5, done: false }) // 1110 #5.3
			expect(await it.next()).toEqual({ value: 3, done: false }) // 1332 #3.5
			expect(await it.next()).toEqual({ value: 5, done: false }) // 1665 #5.4
			expect(await it.next().then(result => ({ result }), error => error)).toEqual(10) // 177
			expect(await it.next()).toEqual({ value: undefined, done: true })
			expect(await it.next()).toEqual({ value: undefined, done: true })
			await done.promise
		})
	})

	describe("test functionality", () => {
		test("rethrow sync", async () => {
			const it = merge(
				(function*() {
					yield (function*() {
						// eslint-disable-next-line no-throw-literal
						throw 10
					})()
				})(),
			)
			expect(await it.next().catch(error => ({ error }))).toEqual({ error: 10 })
		})

		test("rethrow sync on top level", async () => {
			const it = merge(
				(function*() {
					// eslint-disable-next-line no-throw-literal
					throw 10
				})(),
			)
			expect(await it.next().catch(error => ({ error }))).toEqual({ error: 10 })
		})

		test("throw on non-iterable", async () => {
			const it = merge(([0]: any))
			expect(await it.next().then(() => Promise.reject(), error => error)).toBeInstanceOf(TypeError)
		})

		test("throw on non-iterable on top level", async () => {
			const it = merge((0: any))
			expect(await it.next().then(() => Promise.reject(), error => error)).toBeInstanceOf(TypeError)
		})

		test("reading ahead", async () => {
			const done = new Deferred()
			const it = merge([
				[1, 2, 2],
				repeat(3, 5, 33),
				repeat(5, Infinity, 55, done.resolve),
				[
					sleep(77).then(() => 7),
					sleep(177).then(() => {
						// eslint-disable-next-line no-throw-literal
						throw 10
					}),
				],
			])
			const v = []
			for (let i = 0; i < 16; ++i) {
				v[i] = it.next()
			}
			expect(await v.shift()).toEqual({ value: 1, done: false }) // 0ms
			expect(await v.shift()).toEqual({ value: 2, done: false }) // 0
			expect(await v.shift()).toEqual({ value: 3, done: false }) // 0 #3.1
			expect(await v.shift()).toEqual({ value: 2, done: false }) // 0
			expect(await v.shift()).toEqual({ value: 5, done: false }) // 0 #5.1
			expect(await v.shift()).toEqual({ value: 3, done: false }) // 33 #3.2
			expect(await v.shift()).toEqual({ value: 5, done: false }) // 55 #5.2
			expect(await v.shift()).toEqual({ value: 3, done: false }) // 66 #3.3
			expect(await v.shift()).toEqual({ value: 7, done: false }) // 77
			expect(await v.shift()).toEqual({ value: 3, done: false }) // 99 #3.4
			expect(await v.shift()).toEqual({ value: 5, done: false }) // 110 #5.3
			expect(await v.shift()).toEqual({ value: 3, done: false }) // 132 #3.5
			expect(await v.shift()).toEqual({ value: 5, done: false }) // 165 #5.4
			expect(await v.shift().then(result => ({ result }), error => error)).toEqual(10) // 177
			expect(await v.shift()).toEqual({ value: undefined, done: true })
			expect(await v.shift()).toEqual({ value: undefined, done: true })
			await done.promise
		})

		test("no extra yield after break: sync generator", async () => {
			let extraYield = false
			for await (const x of merge([
				(function*() {
					yield 1
					extraYield = true
					yield 2
				})(),
			])) {
				useVariable(x)
				break
			}
			expect(extraYield).toEqual(false)
		})

		test("no extra yield after break: async generator", async () => {
			let extraYield = false
			for await (const x of merge([
				(async function*() {
					yield 1
					extraYield = true
					yield 2
				})(),
			])) {
				useVariable(x)
				break
			}
			expect(extraYield).toEqual(false)
		})

		test("no extra yield after break: async generator, async body", async () => {
			let extraYield = false
			for await (const x of merge([
				(async function*() {
					yield 1
					extraYield = true
					yield 2
				})(),
			])) {
				useVariable(x)
				await new Promise(resolve => setTimeout(resolve, 20))
				break
			}
			expect(extraYield).toEqual(false)
		})

		test("no extra yield after break: async generator+promise", async () => {
			let extraYield = false
			for await (const x of merge([
				(async function*() {
					yield new Promise(resolve => setTimeout(resolve, 20))
					extraYield = true
					yield 2
				})(),
			])) {
				useVariable(x)
				break
			}
			expect(extraYield).toEqual(false)
		})

		test("no extra yield after break: async generator+promise, async body", async () => {
			let extraYield = false
			for await (const x of merge([
				(async function*() {
					yield new Promise(resolve => setTimeout(resolve, 20))
					extraYield = true
					yield 2
				})(),
			])) {
				useVariable(x)
				await new Promise(resolve => setTimeout(resolve, 20))
				break
			}
			expect(extraYield).toEqual(false)
		})

		test("throwing error after yield", async () => {
			const error = new Error()
			let thrown
			try {
				for await (const x of merge([
					(async function*() {
						yield 1
						yield 2
						throw error
					})(),
				])) {
					useVariable(x)
				}
			} catch (e) {
				thrown = e
			}
			expect(thrown).toBe(error)
		})

		test("early throwing error", async () => {
			const error = new Error()
			let thrown
			try {
				for await (const x of merge([
					(async function*() {
						throw error
					})(),
				])) {
					useVariable(x)
				}
			} catch (e) {
				thrown = e
			}
			expect(thrown).toBe(error)
		})

		test("infinite number of infinite iterators", async () => {
			let c = 0
			async function* iterable(n) {
				++c
				try {
					for (let i = 0; ; ++i) {
						yield (2 * i + 1) * 2 ** n
						await undefined
					}
				} finally {
					--c
				}
			}
			async function* iterables() {
				++c
				try {
					yield [0]
					await undefined
					for (let n = 0; ; ++n) {
						yield iterable(n)
						await undefined
					}
				} finally {
					--c
				}
			}
			const n = 1001 // should be odd
			let x = 0
			let i = 0
			for await (const j of merge(iterables())) {
				++i
				if (j === n || i > n * n) {
					break
				}
				if (j < n) {
					x += j
				}
			}
			if ((n * n - n) / 2 !== x) {
				throw new Error("not all numbers are yielded")
			}
			if (c !== 0) {
				throw new Error(`return() failed: ${c}`)
			}
		})
	})
})

function useVariable(x) {
	return x
}
