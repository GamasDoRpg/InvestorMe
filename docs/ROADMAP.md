# Technical roadmap

[Documentation index](../README.md) · [Architecture](ARCHITECTURE.md) · [Long-term vision](VISION.md)

Reviewed against the code on 2026-10-02. A checked item means its stated implementation exists; it does not certify live provider access, production readiness or completion of a broader engine. These stages are technical work areas, not release dates.

## Foundation and financial core — implemented scope

- [x] Electron desktop, isolated preload, local UI and Windows packaging configuration.
- [x] Four main navigation areas with internal portfolio/laboratory sections.
- [x] Dark/light/system themes, density and persistent panel customization.
- [x] Independent Asset, Quote, Candle, Position and Portfolio models.
- [x] Mandatory-field/number/OHLC validation and shared basic decimal arithmetic.
- [x] Invested capital, market value, unrealized P/L and allocation with explicit missing values.
- [x] Local portfolio CRUD and cash entry; BRL-only UI portfolio.
- [x] localStorage workspace, JSON export and compatible removal of old example records.
- [x] Core unit tests, Playwright/Electron interactions and syntax checks.
- [ ] Transaction ledger, realized P/L, corporate actions and dividend accounting.
- [ ] Multi-currency portfolio conversion and FX sources.
- [ ] Persistent database, import UI and general backup/restore workflow.

## Market-data infrastructure — implemented with bounded coverage

- [x] Provider contract, normalization, validation, deadlines, cache and rate-limit handling.
- [x] Twelve Data adapter for supported B3/NASDAQ/NYSE mappings, subject to entitlement.
- [x] brapi adapter for supported B3 quotes/search/daily history.
- [x] Combined B3/US routing with independent quote-service cooldowns.
- [x] Account UI for saving/testing/removing keys and disconnecting.
- [x] OS-protected key storage or explicit session-only behavior.
- [x] Quote timestamps, unavailable states and removal of fake application data.
- [x] Daily asset history access and controlled HTTP/IPC tests.
- [ ] Broad authenticated live-account validation across endpoints/plans.
- [ ] Durable historical datasets, exchange calendars and adjustment policy.
- [ ] Streaming or scheduled refresh, comprehensive instrument coverage and quota tracking.

Real-provider adapters are implemented. Continuous live market data, universal coverage and production reliability are not declared complete. Test mocks are isolated fixtures, not a user-selectable provider.

## Research interface — configuration exists, engines pending

- [x] Strategy/model configuration and associations.
- [x] Inert local Python/JavaScript script editor.
- [x] Backtest parameter records and chronological date validation.
- [x] Editable risk limits and simple price-drop arithmetic.
- [x] Local alert-rule CRUD, enabled state and read state.
- [ ] Technical indicators and feature calculations.
- [ ] Executable strategy rules and screening engine.
- [ ] Real backtesting with transaction costs, slippage and bias controls.
- [ ] Benchmark comparison, portfolio performance history and statistical risk metrics.
- [ ] Results dashboards based on computed outputs.

## Machine learning — planned

- [ ] Reproducible dataset builder and feature engine.
- [ ] Chronological train/validation/test separation and leakage checks.
- [ ] Training pipeline and trained-model artifact registry.
- [ ] Walk-forward validation, calibration and model comparison.
- [ ] Probabilistic predictions with uncertainty and traceable assumptions.

Saved model configurations are not trained models. There is no machine-learning execution or prediction output today.

## Automation and integrations — planned

- [ ] Scheduled strategy evaluation and continuous portfolio/risk monitoring.
- [ ] Alert evaluation and real notification delivery (in-app/email/webhooks).
- [ ] Paper trading.
- [ ] Script API, sandboxed execution and granular permissions.
- [ ] Strategy/model/dataset versioning for reproducible experiments.
- [ ] Plugin architecture and notification providers.
- [ ] Broker integration and optional live execution with explicit safeguards.

Market-data integrations already exist as described above; broker and notification integrations do not. No script execution, orders or live trading are enabled.

## Recommended next work

First validate the existing integrations using real accounts and representative supported symbols, including denied entitlement, rate limits and restarts on Windows. Then establish a reproducible historical-data contract (provenance, adjustments, gaps and calendars) before implementing indicators and the first real backtest. This is a recommended sequence, not a claim that those tasks have begun.
