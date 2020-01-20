import merge from "../src/index.js"

declare function gc(): void

async function* concat<T>(sequences: AsyncIterable<AsyncIterable<T>>): AsyncIterable<T> {
	for await (const sequence of sequences) {
		for await (const item of sequence) {
			yield item
		}
	}
}

async function summarize<T>(sequence: AsyncIterable<T>): Promise<number> {
	let ret = 0
	for await (const item of sequence) {
		ret += +item
	}
	return ret
}

const generate: {
	(num: number): AsyncIterable<number>
	<T>(num: number, generator: (x: number) => T): AsyncIterable<T>
} = async function*<T>(
	num: number,
	generator: (x: number) => T = (((x: number): number => x) as unknown) as (x: number) => T,
): AsyncIterable<T> {
	for (let i = 0; i < num; i++) {
		yield generator(i)
	}
}

async function measure<T>(
	merger: (sequences: AsyncIterable<AsyncIterable<T>>) => AsyncIterable<T>,
	wrapper: (x: number) => T,
): Promise<{ time: number; sum: number }> {
	const start = Date.now()
	const sum = await summarize(merger(generate(2000, n => generate(n, wrapper))))
	const time = Date.now() - start
	return { time, sum }
}

function wrap(x: number): [number] {
	return [x]
}

function id(x: number): number {
	return x
}

const fixed2 = (n: number): number => +n.toFixed(2)

const heapUsed = (): number => fixed2(process.memoryUsage().heapUsed / 2 ** 20)

async function performance<T>(
	merger: (sequences: AsyncIterable<AsyncIterable<T>>) => AsyncIterable<T>,
	wrapper: (x: number) => T,
): Promise<{ time: number; sum: number; gc1: number; gc2: number; gc3: number }> {
	gc()
	const gc1 = heapUsed()
	const { time, sum } = await measure(merger, wrapper)
	const gc2 = heapUsed()
	gc()
	const gc3 = heapUsed()
	return { time, sum, gc1, gc2, gc3 }
}

test("performance", async () => {
	const concatWrap = await performance(concat, wrap)
	const concatId = await performance(concat, id)
	const mergeWrap = await performance(merge, wrap)
	const mergeId = await performance(merge, id)

	expect(mergeWrap.sum).toBe(concatWrap.sum)
	expect(mergeId.sum).toBe(concatId.sum)

	const objectPerformance = mergeWrap.time / concatWrap.time
	const numberPerformance = mergeId.time / concatId.time

	// eslint-disable-next-line no-console
	console.log({ objectPerformance, numberPerformance })

	expect(objectPerformance).not.toBe(numberPerformance)
	expect(objectPerformance).toBeGreaterThan(0.9)
	expect(objectPerformance).toBeLessThan(2.6)
	expect(numberPerformance).toBeGreaterThan(0.9)
	expect(numberPerformance).toBeLessThan(3.3)
})
