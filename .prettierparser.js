"use strict"

const babylon = require("babylon")

module.exports = function parse(text, parsers, opts) {
	const babylonOptions = {
		sourceType: "module",
		allowImportExportEverywhere: true,
		allowReturnOutsideFunction: true,
		plugins: [
			"jsx",
			"flow",
			"doExpressions",
			"objectRestSpread",
			"decorators",
			"classProperties",
			"exportDefaultFrom",
			"exportNamespaceFrom",
			"asyncGenerators",
			"functionBind",
			"functionSent",
			"dynamicImport",
			"numericSeparator",
			"importMeta",
			"optionalCatchBinding",
			"optionalChaining",
			"classPrivateProperties",
			"pipelineOperator",
			"nullishCoalescingOperator",
			"throwExpressions",
		],
	}

	let ast
	try {
		ast = babylon.parse(text, babylonOptions)
	} catch (originalError) {
		ast = babylon.parse(text, { ...babylonOptions, strictMode: false })
	}
	delete ast.tokens
	return ast
}
