module.exports = {
	presets: [["@babel/preset-env", { targets: { node: 6 } }], "@babel/preset-flow"],
	plugins: [
		"@babel/plugin-proposal-class-properties",
		"@babel/plugin-proposal-decorators",
		"@babel/plugin-proposal-export-default-from",
		"@babel/plugin-proposal-export-namespace-from",
		"@babel/plugin-proposal-nullish-coalescing-operator",
		"@babel/plugin-proposal-numeric-separator",
		"@babel/plugin-proposal-optional-chaining",
		"@babel/plugin-proposal-pipeline-operator",
		"@babel/plugin-proposal-throw-expressions",
		"@babel/plugin-proposal-object-rest-spread",
		"@babel/plugin-transform-runtime",
		"add-module-exports",
		"transform-strict-mode",
	],
	env: {
		development: {
			ignore: ["**/*test.js"],
		},
	},
}
