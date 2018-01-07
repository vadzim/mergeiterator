test("compiling decorators", async () => {
	const f = () => () => {}
	@f(1)
	class D {
		@f(2)
		f() {}
	}
})
