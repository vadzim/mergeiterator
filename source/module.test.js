test("compiling", async () => {
	const f = () => () => {}
	@f(1)
	class D {
		@f(2)
		f() {}
	}

	!(f ?? throw "f")?.x?.[2_345]?.()
})
