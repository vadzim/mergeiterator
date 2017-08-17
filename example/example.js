import merge from "../source/mergeiterator"

async function DoIt() {
	for await (const v of merge([
		[1, 2, 3],
		(function*() {
			let i = 6
			while (true) yield i++
		})(),
		(async function*() {
			yield await Promise.resolve(4)
			yield Promise.resolve(5)
		})(),
	])) {
		process.stdout.write(`${v} `)
		if (v > 10) break
	}
}

DoIt()
