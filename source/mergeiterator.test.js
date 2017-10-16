import merge from "./mergeiterator"

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Deferred {
	promise = new Promise(resolve => (this.resolve = resolve))
}

async function* repeat(value, count, interval, onDone) {
	try {
		for (let i = 0; i < count; ++i) {
			yield value
			await sleep(interval)
		}
	} finally {
		onDone && onDone()
	}
}

test("mergeiterator", async () => {
	let done = new Deferred()
	const it = merge([
		[1, 2, 2],
		repeat(3, 5, 33),
		repeat(5, Infinity, 55, done.resolve),
		[
			sleep(77).then(() => 7),
			sleep(177).then(() => {
				throw 10
			}),
		],
	])
	expect(await it.next()).toEqual({ value: 1, done: false }) // 0ms
	expect(await it.next()).toEqual({ value: 3, done: false }) // 0 #3.1
	expect(await it.next()).toEqual({ value: 2, done: false }) // 0
	expect(await it.next()).toEqual({ value: 5, done: false }) // 0 #5.1
	expect(await it.next()).toEqual({ value: 2, done: false }) // 0
	expect(await it.next()).toEqual({ value: 3, done: false }) // 33 #3.2
	expect(await it.next()).toEqual({ value: 5, done: false }) // 55 #5.2
	expect(await it.next()).toEqual({ value: 3, done: false }) // 66 #3.3
	expect(await it.next()).toEqual({ value: 7, done: false }) // 77
	expect(await it.next()).toEqual({ value: 3, done: false }) // 99 #3.4
	expect(await it.next()).toEqual({ value: 5, done: false }) // 110 #5.3
	expect(await it.next()).toEqual({ value: 3, done: false }) // 132 #3.5
	expect(await it.next()).toEqual({ value: 5, done: false }) // 165 #5.4
	expect(await it.next().then(result => ({ result }), error => error)).toEqual(10) // 177
	expect(await it.next()).toEqual({ value: undefined, done: true })
	expect(await it.next()).toEqual({ value: undefined, done: true })
	await done.promise
})

test("reading ahead", async () => {
	let done = new Deferred()
	const it = merge([
		[1, 2, 2],
		repeat(3, 5, 33),
		repeat(5, Infinity, 55, done.resolve),
		[
			sleep(77).then(() => 7),
			sleep(177).then(() => {
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
		}
	} catch (e) {
		thrown = e
	}
	expect(thrown).toBe(error)
})

test("generator return", async () => {
	const iterator = merge(
		(async function*() {
			yield (async function*() {
				return 1
			})()
			yield []
			yield (async function*() {
				yield 2
				return 3
			})()
			return 4
		})(),
	)
	expect(await iterator.next()).toEqual({ done: false, value: 2 })
	expect(await iterator.next()).toEqual({ done: true, value: Object.assign([1, undefined, 3], { value: 4 }) })
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
		throw new Error("return() failed: " + c)
	}
})
