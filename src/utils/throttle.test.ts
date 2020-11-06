import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should invoke a function on the first call", () => {
    const fn = jest.fn((a: unknown) => a);
    const throttled = throttle(fn, 10);

    throttled("a");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("a");

    jest.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should invoke a single function oly once", () => {
    const fn = jest.fn((a: unknown) => a);
    const throttled = throttle(fn, 10);

    throttled("a");
    jest.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should prevent consequent calls", () => {
    const fn = jest.fn((a: unknown) => a);
    const throttled = throttle(fn, 10);

    throttled("a");
    throttled("b");
    throttled("c");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("a");
  });

  it("should invoke consequent call with arguments of the last call", () => {
    const fn = jest.fn((a: unknown) => a);
    const throttled = throttle(fn, 10);

    throttled("a");
    throttled("b");
    throttled("c");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("a");

    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");
  });

  it("should cancel calls", () => {
    const fn = jest.fn((a: unknown) => a);
    const debounced = throttle(fn, 10);

    debounced("a");
    debounced("b");
    debounced("c");

    expect(fn).toHaveBeenCalledTimes(1);

    debounced.cancel();
    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});