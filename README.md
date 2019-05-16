# mergeiterator

Merges async iterators.

[![NPM version](https://img.shields.io/npm/v/mergeiterator.svg?style=flat-square)](https://npmjs.org/package/mergeiterator)
[![Build Status](https://img.shields.io/travis/vadzim/mergeiterator/master.svg?style=flat-square)](https://travis-ci.org/vadzim/mergeiterator)
[![Coverage Status](https://img.shields.io/codecov/c/github/vadzim/mergeiterator/master.svg?style=flat-square)](https://codecov.io/gh/vadzim/mergeiterator/branch/master)

Merges list of async or sync iterables into async one.

It accepts any iterable like arrays, generators, async generators or even promises which resolve to iterables.
Any iterator can be infinite, including the list of iterables itself.

```javascript
import merge from "mergeiterator"

async function DoIt() {
	const array = [1, 2, 3, 4, 5]
	const promisedArray = Promise.resolve([6, Promise.resolve(7)])
	function *generator() {
		let i = 10
		while (true) yield (i++)
	}
	async function *asyncGenerator() {
		yield 8
		yield Promise.resolve(9)
	}
	for await (const v of merge([array, promisedArray, generator(), asyncGenerator()])) {
		console.log(v)
	}
}

// 1 2 6 3 7 10 4 11 8 5 12 9 13 14 15 ...
```

This function guarantees, that if some value is yielded by some of iterables, then that value will be eventually yielded. This is basically about infinite iterables.
It also guarantees that the order of values within the same iterable is preserved.

If some iterable yields a promise, its value will be used, not a promise itself.

If some iterable throws an error, that error will be redirected to a caller and other iterables will be closed.

The return value of `merge` is the return value of the list of iterables. Return values of merged iterables are discarded.

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

-   [merge](#merge)
    -   [Parameters](#parameters)

### merge

Merges async or sync iterables into async one.

#### Parameters

-   `sequences` **AnyIterable&lt;AnyIterable&lt;([Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;T> | T)>, ReturnT>** 

Returns **AsyncGenerator&lt;T, ReturnT, void>** 
