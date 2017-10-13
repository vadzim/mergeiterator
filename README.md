# mergeiterator
Merges async iterators.

### Using ###

This utility is for merging together async iterators.

```js
merge(collection_of_iterables): Iterable
```

Pass it a collection of iterables and it'll return an [async iterator](https://github.com/tc39/proposal-async-iteration), which will contain all values from those iterables. Those iterables and the collection of them can be arrays, calls to generators, or any other kind of iterable, synchronous or async, finite or infinite.

```js
import merge from "mergeiterator"

async function DoIt() {
	const array = [1,2,3]
	function *generator() {
		let i = 6
		while (true) yield (i++)
	})
	async function *asyncGenerator() {
		yield await Promise.resolve(4)
		yield Promise.resolve(5)
	})
	for await (const v of merge([array, generator(), asyncGenerator()])) {
		console.log(v)
	}
}
// 1 6 2 7 4 3 8 5 9 10 11 ...
```

`mergeIterator` function guarantees, that if some value is yielded by some of iterables that `mergeIterator` is passed, then that value will be eventually yielded by `mergeIterator`. It also guarantees that the order of values within the same iterable is preserved.

If some iterable yields a promise, its value will be yielded, not a promise itself.

If some iterable throws an error, that error will be redirected to a caller and other iterables will be closed.

### Contributing ###

__Please contribute!__
All contributions are greatly appreciated no matter how small or large the contribution is.
Whether it's a small grammar fix in the README, a huge bug fix, or just an issue report, you will be recognized as a 'Contributor' to this project.

Please, feel free to [open an issue](https://github.com/vadzim/streamiterator/issues) or email me to developer@vadzim.info if you have any question.
