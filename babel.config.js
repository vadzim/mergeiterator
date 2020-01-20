module.exports = {
	presets: [
		[
			"@babel/preset-env",
			{
				targets: {
					// TODO:
					// compiling to node@8 causes tests to fail possible because of bugs either in babel or in regenerator
					node: process.env.NODE_ENV === "test" ? 12 : 8,
				},
			},
		],
		"@babel/preset-flow",
		"@babel/preset-typescript",
	],
	plugins: [
		"@babel/plugin-proposal-class-properties",
		["add-module-exports", { addDefaultProperty: true }],
		//
	],
}
