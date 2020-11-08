import { ImplementationBaseOptions } from "./ImplementationBase";
import { defaultOptions } from "../../defaultOption";
import Input from "../Input";
import Api from "../Api";
import { Suggestions } from "../../types";
import sinon, { SinonFakeServer } from "sinon";
import { noop } from "../../utils/noop";
import ImplementationSuggestionsBase from "./ImplementationSuggestionsBase";
import { respondWithSuggestions } from "../../../testUtils/withFakeServer";
import { createSuggestions } from "../../../testUtils/createSuggestions";
import { ERROR_FETCH_ABORTED } from "../../errors";

describe("class ImplementationSuggestionsBase", () => {
  // Define class over abstract, make protected methods public
  class ImplementationTest extends ImplementationSuggestionsBase<unknown> {
    public fetchSuggestions(
      query: string,
      params?: Record<string, unknown>
    ): Promise<Suggestions<unknown>> {
      return super.fetchSuggestions(query, params);
    }
  }

  let el: HTMLInputElement;

  beforeEach(() => {
    el = document.body.appendChild(document.createElement("input"));
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  const withInstance = async (
    customOptions: Partial<ImplementationBaseOptions<unknown>> | null,
    fn: (instance: ImplementationTest) => void
  ): Promise<void> => {
    const options = {
      ...defaultOptions,
      type: "some-type",
      helperElements: [],
      ...customOptions,
    };
    const api = new Api(options);
    const input = new Input(el, options);
    const instance = new ImplementationTest(el, {
      ...options,
      api,
      input,
    });

    await fn(instance);

    instance.dispose();
  };

  beforeEach(() => {
    Api.resetPendingQueries();
  });
  describe("fetchSuggestions()", () => {
    let server: SinonFakeServer;

    beforeEach(() => {
      server = sinon.useFakeServer();
    });

    afterEach(() => {
      server.restore();
    });

    it("should send request every time if noCache is true", async () => {
      await withInstance({ noCache: true }, async (instance) => {
        for (let i = 0; i < 3; i++) {
          instance.fetchSuggestions("query");
          await respondWithSuggestions(server, []);
        }

        expect(server.requests).toHaveLength(3);
      });
    });

    it("should not send requests for the same query", async () => {
      await withInstance(null, async (instance) => {
        const firstCall = instance.fetchSuggestions("query");
        await respondWithSuggestions(server, []);

        await firstCall;

        // Data took from cache
        await expect(instance.fetchSuggestions("query")).resolves.toEqual([]);
        expect(server.requests).toHaveLength(1);
      });
    });

    it("should reject a request if the next request came", async () => {
      await withInstance(null, async (instance) => {
        const calls = Array.from(new Array(3)).map(async (_, i) =>
          instance.fetchSuggestions(`query ${i}`)
        );
        calls.forEach((call) => call.catch(noop));

        expect(server.requests).toHaveLength(3);

        const suggestions = [
          {
            value: "value",
            unrestricted_value: "unrestricted_value",
            data: null,
          },
        ];
        await respondWithSuggestions(server, suggestions);

        await expect(calls[0]).rejects.toThrow(ERROR_FETCH_ABORTED);
        await expect(calls[1]).rejects.toThrow(ERROR_FETCH_ABORTED);
        await expect(calls[2]).resolves.toEqual(suggestions);
      });
    });

    it("should resolve with suggestions", async () => {
      await withInstance(null, async (instance) => {
        const call = instance.fetchSuggestions("query");
        const suggestions: Suggestions<null> = Array.from(new Array(5)).map(
          (_, i) => ({
            value: `suggestion value ${i}`,
            unrestricted_value: `suggestion unrestricted_value ${i}`,
            data: null,
          })
        );

        await respondWithSuggestions(server, suggestions);
        await expect(call).resolves.toEqual(suggestions);
      });
    });

    it("should reject if request failed", async () => {
      await withInstance(null, async (instance) => {
        const call = instance.fetchSuggestions("query");
        call.catch(noop);

        server.respond();

        await expect(call).rejects.toThrow("Not Found");
      });
    });

    describe("preventBadQueries is true", () => {
      it("should not send request if any of shorter query did not get suggestions", async () => {
        await withInstance({ preventBadQueries: true }, async (instance) => {
          const firstCall = instance.fetchSuggestions("query");

          await respondWithSuggestions(server, []);
          await firstCall;
          await expect(
            instance.fetchSuggestions("query that narrows previous")
          ).resolves.toEqual([]);

          expect(server.requests).toHaveLength(1);
        });
      });

      it("should send request if no shorter queries finished without suggestions found", async () => {
        await withInstance({ preventBadQueries: true }, async (instance) => {
          const firstCall = instance.fetchSuggestions("query");
          await respondWithSuggestions(server, createSuggestions(1));

          await firstCall;

          instance.fetchSuggestions("query that narrows previous").catch(noop);

          expect(server.requests).toHaveLength(2);
        });
      });
    });

    describe("preventBadQueries is false", () => {
      it("should send request for potentially empty queries", async () => {
        await withInstance({ preventBadQueries: false }, async (instance) => {
          const firstCall = instance.fetchSuggestions("query");

          await respondWithSuggestions(server, []);
          await firstCall;

          instance.fetchSuggestions("query that narrows previous").catch(noop);

          expect(server.requests).toHaveLength(2);
        });
      });
    });
  });
});
