// @flow

import merge from "../src/index"

async function DoIt() {
	for await (const v of merge([
		[1, 2, Promise.resolve(3)],
		Promise.resolve([4, 5]),
		(function*() {
			let i = 9
			while (true) {
				yield i++
				yield Promise.resolve(i++)
			}
		})(),
		(async function*() {
			yield 6
			yield await Promise.resolve(7)
			yield Promise.resolve(8)
		})(),
	])) {
		process.stdout.write(`${v} `)
		if (v >= 20) break
	}
}

DoIt()
