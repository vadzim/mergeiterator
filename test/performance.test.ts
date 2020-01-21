import merge from "../src/index"

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

test("performance", async () => {
	const concatWrap = await measure(concat, wrap)
	const concatId = await measure(concat, id)
	const mergeWrap = await measure(merge, wrap)
	const mergeId = await measure(merge, id)

	expect(mergeWrap.sum).toBe(concatWrap.sum)
	expect(mergeId.sum).toBe(concatId.sum)

	const objectPerformance = mergeWrap.time / concatWrap.time
	const numberPerformance = mergeId.time / concatId.time

	// eslint-disable-next-line no-console
	console.log({ objectPerformance, numberPerformance })

	expect(objectPerformance).not.toBe(numberPerformance)
	expect(objectPerformance).toBeGreaterThan(0.9)
	expect(objectPerformance).toBeLessThan(2.8)
	expect(numberPerformance).toBeGreaterThan(0.9)
	expect(numberPerformance).toBeLessThan(4.0)
})
