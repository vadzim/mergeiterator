module.exports = {
	presets: [
		[
			"@babel/preset-env",
			{
				targets: {
					// TODO:
					// compiling to node@8 causes tests to fail possible because of bugs either in babel or in regenerator
					node: process.env.NODE_ENV === "test" ? 10 : 8,
				},
			},
		],
		"@babel/preset-flow",
	],
	plugins: [
		"@babel/plugin-proposal-class-properties",
		"@babel/plugin-proposal-nullish-coalescing-operator",
		"@babel/plugin-proposal-numeric-separator",
		"@babel/plugin-proposal-optional-chaining",
		["@babel/plugin-proposal-pipeline-operator", { proposal: "minimal" }],
		["add-module-exports", { addDefaultProperty: true }],
	],
}
