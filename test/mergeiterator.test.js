// @flow

import merge from "../src/index.js"

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
	test("example does not fail", () => import("../example/example.js"))

	test("test time intervals", async () => {
		const done = new Deferred()
		const it = merge([
			Promise.resolve([1, Promise.resolve(2), 2]),
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
		await expect(it.next()).resolves.toEqual({ value: 1, done: false }) // 0ms
		await expect(it.next()).resolves.toEqual({ value: 2, done: false }) // 0
		await expect(it.next()).resolves.toEqual({ value: 3, done: false }) // 0 #3.1
		await expect(it.next()).resolves.toEqual({ value: 2, done: false }) // 0
		await expect(it.next()).resolves.toEqual({ value: 5, done: false }) // 0 #5.1
		await expect(it.next()).resolves.toEqual({ value: 3, done: false }) // 333 #3.2
		await expect(it.next()).resolves.toEqual({ value: 5, done: false }) // 555 #5.2
		await expect(it.next()).resolves.toEqual({ value: 3, done: false }) // 666 #3.3
		await expect(it.next()).resolves.toEqual({ value: 7, done: false }) // 777
		await expect(it.next()).resolves.toEqual({ value: 3, done: false }) // 999 #3.4
		await expect(it.next()).resolves.toEqual({ value: 5, done: false }) // 1110 #5.3
		await expect(it.next()).resolves.toEqual({ value: 3, done: false }) // 1332 #3.5
		await expect(it.next()).resolves.toEqual({ value: 5, done: false }) // 1665 #5.4
		await expect(it.next()).rejects.toBe(10) // 177
		await expect(it.next()).resolves.toEqual({ value: undefined, done: true })
		await expect(it.next()).resolves.toEqual({ value: undefined, done: true })
		await done.promise

		// test types
		for await (const x: number of it) {
			// should not run
			expect(x).toBe(undefined)
		}
	})

	test("reading ahead", async () => {
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
		const v = []
		for (let i = 0; i < 16; ++i) {
			v[i] = it.next()
		}
		await expect(v.shift()).resolves.toEqual({ value: 1, done: false }) // 0ms
		await expect(v.shift()).resolves.toEqual({ value: 2, done: false }) // 0
		await expect(v.shift()).resolves.toEqual({ value: 3, done: false }) // 0 #3.1
		await expect(v.shift()).resolves.toEqual({ value: 2, done: false }) // 0
		await expect(v.shift()).resolves.toEqual({ value: 5, done: false }) // 0 #5.1
		await expect(v.shift()).resolves.toEqual({ value: 3, done: false }) // 333 #3.2
		await expect(v.shift()).resolves.toEqual({ value: 5, done: false }) // 555 #5.2
		await expect(v.shift()).resolves.toEqual({ value: 3, done: false }) // 666 #3.3
		await expect(v.shift()).resolves.toEqual({ value: 7, done: false }) // 777
		await expect(v.shift()).resolves.toEqual({ value: 3, done: false }) // 999 #3.4
		await expect(v.shift()).resolves.toEqual({ value: 5, done: false }) // 1110 #5.3
		await expect(v.shift()).resolves.toEqual({ value: 3, done: false }) // 1332 #3.5
		await expect(v.shift()).resolves.toEqual({ value: 5, done: false }) // 1665 #5.4
		await expect(v.shift()).rejects.toBe(10) // 177
		await expect(v.shift()).resolves.toEqual({ value: undefined, done: true })
		await expect(v.shift()).resolves.toEqual({ value: undefined, done: true })
		await done.promise
	})

	describe("test functionality", () => {
		test("return result", async () => {
			const it = merge(
				(function*() {
					yield (function*() {
						return 17
					})()
					yield []
					yield [13]
					yield []
					yield []
					return 42
				})(),
			)
			await expect(it.next()).resolves.toEqual({ done: false, value: 13 })
			await expect(it.next()).resolves.toEqual({ done: true, value: 42 })
		})

		test("merges empty list", async () => {
			await expect(merge([]).next()).resolves.toEqual({ done: true, value: undefined })
		})

		test("merges list of empties", async () => {
			await expect(
				merge(
					(function*() {
						yield []
						yield []
						// eslint-disable-next-line no-empty-function
						yield (function*() {})()
						yield (async function*() {
							await Promise.resolve()
							return "rejected"
						})()
						yield []
						yield []
						return "ok"
					})(),
				).next(),
			).resolves.toEqual({
				done: true,
				value: "ok",
			})
		})

		test("rethrow sync", async () => {
			const it = merge(
				(function*() {
					yield (function*() {
						// eslint-disable-next-line no-throw-literal
						throw 10
					})()
				})(),
			)
			await expect(it.next()).rejects.toBe(10)
		})

		test("rethrow sync on top level", async () => {
			const it = merge(
				(function*() {
					// eslint-disable-next-line no-throw-literal
					throw 10
				})(),
			)
			await expect(it.next()).rejects.toBe(10)
		})

		test("throw on non-iterable child", async () => {
			await expect(merge(([0]: any)).next()).rejects.toBeInstanceOf(TypeError)
		})

		test("throw on non-iterable root", async () => {
			await expect(merge((0: any)).next()).rejects.toBeInstanceOf(TypeError)
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
			expect(extraYield).toBe(false)
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
			expect(extraYield).toBe(false)
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
			expect(extraYield).toBe(false)
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
			expect(extraYield).toBe(false)
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
			expect(extraYield).toBe(false)
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
			const n = 1001 // should be odd
			let x = 0
			let i = 0
			let c = 0
			let maxc = 0

			const countIterators = msg => {
				switch (msg) {
					case "child-start":
					case "root-start":
						c++
						break
					case "child-return":
					case "root-return":
						c--
						break
					default:
				}
				if (maxc < c) maxc = c
			}

			for await (const j of merge(infiniteIterables(countIterators))) {
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
			if (maxc !== (n + 3) / 2) {
				throw new Error(`wrong number of iterators created: ${maxc}`)
			}
		})

		function take10OfInfiniteMerge(cb) {
			return take(10, merge(infiniteIterables(cb))).then(x => x.join(",") === "0,1,3,2,5,6,4,7,10,12")
		}

		test("throwing on child return", async () => {
			await expect(
				take10OfInfiniteMerge(msg => {
					if (msg === "child-return") {
						throw new Error("child-return")
					}
				}),
			).rejects.toThrow("child-return")
		})

		test("throwing on root return", async () => {
			await expect(
				take10OfInfiniteMerge(msg => {
					if (msg === "root-return") {
						throw new Error("root-return")
					}
				}),
			).rejects.toThrow("root-return")
		})

		test("throwing in child", async () => {
			await expect(
				take10OfInfiniteMerge((msg, n) => {
					if (msg === "child-yielding" && n === 7) {
						throw new Error("child-yielding")
					}
				}),
			).rejects.toThrow("child-yielding")
		})

		test("throwing in child and yield in root return", async () => {
			let returnCalled = false
			let thrown = false
			await expect(
				take10OfInfiniteMerge((msg, n) => {
					if (msg === "child-yielding" && n === 7) {
						thrown = true
						throw new Error("child-yielding")
					}
					if (msg === "root-return") {
						returnCalled = true
						return [[42]]
					}
					return []
				}),
			).rejects.toThrow("child-yielding")
			expect(returnCalled).toBe(true)
			expect(thrown).toBe(true)
		})

		test("yield in root return", async () => {
			let returnCalled = false
			await expect(
				take10OfInfiniteMerge(msg => {
					if (msg === "root-return") {
						returnCalled = true
						return [[42]]
					}
					return []
				}),
			).resolves.toBe(true)
			expect(returnCalled).toBe(true)
		})

		test("yield in child return", async () => {
			let returnCalled = false
			await expect(
				take10OfInfiniteMerge(msg => {
					if (msg === "child-return") {
						returnCalled = true
						return [42]
					}
					return []
				}),
			).resolves.toBe(true)
			expect(returnCalled).toBe(true)
		})
	})
})

function useVariable(x) {
	return x
}

function* infiniteIterable(n, cb) {
	try {
		yield* cb("child-start", n) || []
		for (let i = 0; ; ++i) {
			const x = (2 * i + 1) * 2 ** n
			yield* cb("child-yielding", x, n) || []
			yield x
			yield* cb("child-yielded", x, n) || []
		}
	} finally {
		yield* cb("child-return", n) || []
	}
}

async function* infiniteIterables(cb: Function = () => {}) {
	try {
		yield* cb("root-start") || []
		yield* cb("root-yielding", 0) || []
		yield [0]
		yield* cb("root-yielded", 0) || []
		for (let n = 0; ; ++n) {
			yield* cb("root-yielding", n + 1) || []
			yield infiniteIterable(n, cb)
			yield* cb("root-yielded", n + 1) || []
		}
	} finally {
		yield* cb("root-return") || []
	}
}

async function take(n, iterable) {
	const result = []
	if (n <= 0) {
		await iterable.return()
	} else {
		for await (const x of iterable) {
			result.push(x)
			if (result.length >= n) break
		}
	}
	return result
}
