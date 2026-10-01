import * as finance from "./finance.mjs";
// One read-only bridge retains the legacy classic scripts' shared lexical scope.
// Core modules themselves never create globals or depend on the renderer.
Object.defineProperty(window, "InvestorMeFinance", { value: finance });
const script = document.createElement("script");
script.src = new URL("./app.js", import.meta.url).href;
script.onerror = () => {
  document.querySelector("#main").textContent =
    "Não foi possível carregar a interface.";
};
document.body.append(script);
