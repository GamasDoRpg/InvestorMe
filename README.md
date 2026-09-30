# InvestorMe

> A customizable investment research platform focused on portfolio tracking, quantitative analysis, strategy automation, and machine-learning-assisted market signals.

InvestorMe is an experimental software project designed to help investors analyze assets, monitor portfolios, test strategies, and build probabilistic models for financial markets.

The project is built around one principle:

> **The software should not pretend to know the future. It should measure probabilities, risk, uncertainty, and historical evidence as clearly as possible.**

InvestorMe is currently in an early stage of development. The architecture and features described below represent the intended direction of the project and should not be interpreted as already implemented unless explicitly marked otherwise.

---

## Vision

Most investment tools specialize in only one part of the workflow: charting, portfolio tracking, screening, backtesting, or quantitative research.

InvestorMe aims to bring these workflows together into one programmable platform:

- Portfolio and cash tracking
- Market monitoring
- Custom screeners
- Technical and fundamental analysis
- Strategy creation
- Backtesting
- Alerts
- Risk analysis
- Machine learning
- Probabilistic predictions
- Paper trading
- Scriptable extensions
- Model and strategy versioning

The long-term goal is to create an **investment operating system** that can be used at different levels of complexity, from visual configuration to custom quantitative scripts.

---

## Core concepts

### 1. Probabilities instead of promises

InvestorMe should avoid deterministic claims such as:

```text
PETR4 will reach R$ 42.00 next week.
```

Models should instead produce measurable probabilistic outputs such as:

```text
Asset: PETR4
Horizon: 7 days

P(return > +5%)       61.4%
P(return < -5%)       18.7%
P(neutral range)      19.9%

Model confidence      Moderate
```

Predictions are estimates produced from historical data and model assumptions. They are never guarantees.

---

### 2. Highly customizable strategies

Users should be able to combine market data, indicators, fundamentals, risk rules, and machine-learning predictions into custom strategies.

Example:

```text
Strategy: Brazilian Value Momentum

Universe:
B3 equities

Entry conditions:
P/E < 8
ROE > 15%
Debt / EBITDA < 2
RSI < 40
Price < estimated fair value

Risk:
Maximum 5% of portfolio per company

Evaluation interval:
1 hour
```

The same concepts should eventually be available through both a graphical strategy builder and scripts.

---

### 3. Scriptable investment engine

Advanced users should be able to extend InvestorMe through a controlled scripting API.

A future script system may expose hooks such as:

```text
on_market_data()
on_feature_calculation()
on_before_training()
on_after_training()
on_prediction()
on_signal()
on_risk_calculation()
on_portfolio_update()
```

Example concept:

```python
@investorme.on_prediction
def adjust_prediction(prediction, asset):
    if asset.market_volatility > 0.35:
        prediction.confidence *= 0.70

    if asset.earnings_in_days < 3:
        prediction.risk *= 1.40

    return prediction
```

Scripts that interact with external systems or live brokerage accounts should use an explicit permission model.

---

## Planned architecture

```text
                      InvestorMe
                          |
        +-----------------+-----------------+
        |                 |                 |
   Market Data        Portfolio         Research
        |                 |                 |
        v                 v                 v
   Data Engine       Portfolio Engine   Feature Engine
        |                                   |
        +----------------+------------------+
                         |
                         v
                     ML Engine
                         |
                         v
                 Probability Engine
                         |
                         v
                     Risk Engine
                         |
                         v
                  Strategy Engine
                         |
            +------------+------------+
            |            |            |
          Alerts      Backtests    Paper Trading
```

The components should remain modular so that individual data providers, models, strategies, and execution systems can be replaced without redesigning the entire application.

---

## Machine learning

Machine learning is intended to be a major part of InvestorMe, but not a black-box replacement for investment research.

Possible supported model families include:

- Logistic regression
- Random forests
- Gradient boosting
- XGBoost / LightGBM
- Neural networks
- Time-series models
- Ensembles
- User-defined models

Instead of having one universal model for every asset, InvestorMe may support specialized models by sector, asset class, market regime, or investment horizon.

For example:

```text
PETR4  -> Commodity / Energy model
ITUB4  -> Financial model
WEGE3  -> Industrial Growth model
NVDA   -> Technology Growth model
```

A meta-model or ensemble can then combine multiple specialized signals.

---

## Prediction targets

Price prediction does not need to be the only objective.

InvestorMe should support targets such as:

- Probability of a return above a threshold
- Probability of a drawdown
- Probability of outperforming a benchmark
- Expected volatility
- Trend or regime classification
- Earnings surprise probability
- Breakout probability
- Risk-adjusted expected return

Examples:

```text
P(return > 3% in 7 days)
P(return > 10% in 90 days)
P(drawdown > 10%)
P(outperforming IBOV in 30 days)
P(volatility increasing)
```

This allows models to answer narrow, testable questions instead of attempting to predict a single exact future price.

---

## Feature engine

Models may combine different categories of information.

### Market data

- Open, high, low, close
- Volume
- Returns
- Volatility
- Liquidity
- Order-flow data where available

### Technical indicators

- RSI
- Moving averages
- MACD
- ATR
- Momentum
- Bollinger Bands
- User-defined indicators

### Fundamentals

- Revenue
- Earnings
- Free cash flow
- ROE
- Margins
- P/E
- P/B
- EV/EBITDA
- Debt ratios

### Macroeconomic data

- Interest rates
- Inflation
- Currency rates
- Commodity prices
- Yield curves
- Relevant economic indicators

### Alternative data

Future versions may support additional datasets such as news sentiment or other legally obtainable alternative data.

---

## Portfolio tracking

InvestorMe is intended to provide portfolio-level context instead of analyzing each asset in isolation.

Planned portfolio information includes:

- Current positions
- Average purchase price
- Realized profit/loss
- Unrealized profit/loss
- Cash balance
- Dividends
- Allocation by asset
- Allocation by sector
- Exposure by currency
- Historical portfolio value
- Risk contribution
- Benchmark comparison

Example:

```text
Portfolio

Invested                 R$ 48,920
Available cash            R$ 8,400
Total                    R$ 57,320

Accumulated profit        R$ 6,140
12-month dividends        R$ 2,310
```

---

## Strategy engine

Strategies should be able to combine deterministic rules with probabilistic model outputs.

Example:

```text
BUY when:

Fundamental score > 70
AND momentum score > 65
AND model P(return > 5%) > 60%
AND expected drawdown < 12%
AND portfolio exposure remains within risk limits
```

The engine should also support exit rules, rebalancing rules, position sizing, and portfolio-level constraints.

---

## Risk engine

Risk management should be treated as a first-class component.

Possible metrics and controls include:

- Maximum drawdown
- Volatility
- Value at Risk
- Conditional Value at Risk
- Sharpe ratio
- Sortino ratio
- Beta
- Correlation
- Exposure limits
- Position-size limits
- Sector concentration
- Portfolio concentration
- Stop conditions

A strategy with strong historical returns but unacceptable risk should not be presented as superior simply because of its raw return.

---

## Validation

InvestorMe is designed to treat market predictions as probabilistic signals rather than guaranteed outcomes. Every model or strategy should be validated before it is used for investment decisions.

The validation pipeline should include:

- **Train / validation / test separation** using chronological market data
- **Out-of-sample testing** so models are evaluated on periods they have never seen during training
- **Walk-forward validation** to simulate how a model behaves as new market data becomes available
- **Data leakage checks** to ensure future information is never used to predict the past
- **Benchmark comparison** against simple baselines and relevant market indexes
- **Risk metrics** such as maximum drawdown, volatility, Sharpe ratio, win rate, and profit factor
- **Paper trading** before any strategy is considered for live execution

Example:

```text
TRAIN
2012 ---------------- 2020

VALIDATION
2021 ------ 2023

OUT-OF-SAMPLE TEST
2024 ------ 2026
```

Walk-forward testing:

```text
Train 2014-2018 -> Test 2019
Train 2015-2019 -> Test 2020
Train 2016-2020 -> Test 2021
...
```

Backtest performance alone is not considered sufficient evidence that a strategy will remain profitable in future market conditions.

---

## Preventing overfitting

Financial datasets contain large amounts of noise. A sufficiently flexible strategy can easily appear profitable historically while having no useful predictive power.

InvestorMe should therefore track:

- Number of strategy iterations
- In-sample vs out-of-sample performance
- Parameter sensitivity
- Feature importance stability
- Model calibration
- Performance across different market regimes
- Transaction costs
- Slippage
- Survivorship bias
- Look-ahead bias

Datasets, models, strategy configurations, and validation results should be reproducible whenever possible.

---

## Model Lab

A future **Model Lab** should make it possible to train and compare different models under the same dataset and validation conditions.

Example:

```text
Model Lab
Strategy: Brazilian Value Momentum v12

XGBoost                 61.8%
Random Forest           58.4%
Neural Network          60.1%
Logistic Regression     55.3%
Ensemble                64.7%

Sharpe                    1.42
Max Drawdown            -13.8%
Win Rate                 57.2%
Profit Factor             1.61
```

Metrics must always be interpreted in the context of the dataset, test period, transaction costs, and validation methodology.

---

## Versioning

Strategies and models should be versioned so experiments remain reproducible.

Example:

```text
Strategy v18

Changes:
+ Added earnings momentum
+ Added volatility regime filter
- Removed MACD
~ RSI period changed from 14 to 21

Out-of-sample Sharpe:
v17: 1.31
v18: 1.44
```

A future versioning system may track:

- Source code
- Parameters
- Feature definitions
- Dataset versions
- Training period
- Model artifacts
- Validation results
- Backtest results

---

## Automation and monitoring

InvestorMe should eventually be able to evaluate strategies automatically on configurable intervals.

Examples:

```text
Every hour
Every trading session
At candle close
After financial results
After portfolio changes
```

When conditions are satisfied, the platform may generate alerts rather than automatically execute trades by default.

Possible notification channels may include:

- In-app notifications
- Email
- Webhooks
- External integrations

---

## Research, paper trading, and live execution

The project should separate environments with different levels of risk.

```text
Research
   |
   v
Backtesting
   |
   v
Paper Trading
   |
   v
Live Trading
```

Live execution, if implemented, should require explicit configuration and permissions.

A script that can read market data should not automatically receive permission to:

- Access arbitrary files
- Access the internet
- Read credentials
- Connect to a broker
- Submit orders

---

## Script permissions

A future permissions system may look like:

```text
Script permissions

[x] Market data
[x] Technical indicators
[x] Fundamentals
[x] ML models

[ ] Internet access
[ ] File-system access
[ ] Broker API
[ ] Execute trades
```

This design reduces the risk of third-party extensions accessing sensitive resources without the user's knowledge.

---

## Possible project structure

The repository is currently at an early stage. A possible future structure is:

```text
InvestorMe/
|
+-- apps/
|   +-- desktop/
|   +-- web/
|
+-- core/
|   +-- market/
|   +-- portfolio/
|   +-- strategy/
|   +-- risk/
|   +-- backtest/
|
+-- ml/
|   +-- features/
|   +-- models/
|   +-- training/
|   +-- validation/
|
+-- scripting/
|   +-- api/
|   +-- sandbox/
|   +-- permissions/
|
+-- integrations/
|   +-- data-providers/
|   +-- brokers/
|   +-- notifications/
|
+-- tests/
+-- docs/
+-- README.md
```

This layout is only a proposal and may change as the implementation evolves.

---

## Development principles

InvestorMe should prioritize:

1. **Reproducibility** — experiments must be repeatable.
2. **Transparency** — predictions should expose assumptions and relevant metrics.
3. **Modularity** — data sources, models, and strategies should be replaceable.
4. **Safety** — research and execution environments must remain separated.
5. **Validation** — models must be evaluated on unseen data.
6. **Extensibility** — advanced users should be able to build custom tools.
7. **Risk awareness** — expected return should never be shown without risk context.

---

## Roadmap

The roadmap will evolve with the project, but a possible development order is:

### Phase 1 - Foundation

- [ ] Project architecture
- [ ] Market-data abstraction
- [ ] Local data storage
- [ ] Basic asset model
- [ ] Portfolio model
- [ ] Technical indicators

### Phase 2 - Research

- [ ] Screener
- [ ] Strategy engine
- [ ] Backtesting engine
- [ ] Benchmark comparison
- [ ] Risk metrics
- [ ] Results dashboard

### Phase 3 - Machine learning

- [ ] Feature engine
- [ ] Dataset builder
- [ ] Training pipeline
- [ ] Model registry
- [ ] Walk-forward validation
- [ ] Probability calibration
- [ ] Model comparison

### Phase 4 - Automation

- [ ] Scheduled strategy evaluation
- [ ] Alerts
- [ ] Paper trading
- [ ] Portfolio monitoring

### Phase 5 - Extensibility

- [ ] Script API
- [ ] Sandboxed execution
- [ ] Script permissions
- [ ] Strategy/model versioning
- [ ] Plugin architecture

### Phase 6 - Integrations

- [ ] External market-data providers
- [ ] Notification providers
- [ ] Broker integrations
- [ ] Optional live execution safeguards

---

## Example future workflow

```text
1. User selects a market universe
               |
               v
2. InvestorMe collects historical data
               |
               v
3. Feature engine builds datasets
               |
               v
4. Models are trained
               |
               v
5. Walk-forward validation is executed
               |
               v
6. Strategy is backtested with costs
               |
               v
7. Strategy moves to paper trading
               |
               v
8. Signals are monitored in real time
```

A model should not skip directly from training to live capital.

---

## Disclaimer

InvestorMe is an experimental software project for research, education, portfolio analysis, and quantitative experimentation.

Nothing produced by InvestorMe should be interpreted as guaranteed investment performance or certainty about future market behavior.

Financial markets involve substantial risk. Historical performance, backtests, statistical relationships, machine-learning outputs, and simulated results do not guarantee future returns.

Anyone using the software is responsible for independently evaluating investment decisions and applicable legal, regulatory, tax, and brokerage requirements.

---

## Status

**Early development / research stage.**

The repository currently contains the initial project documentation. Implementation details, technology choices, APIs, and architecture may change substantially as development progresses.

---

## Contributing

Contribution guidelines will be added as the project becomes ready for external contributions.

For now, ideas, experiments, architecture discussions, quantitative methods, validation techniques, and risk-management approaches are welcome as the project evolves.

---

## License

No license has been defined yet.

Until a license is explicitly added to the repository, standard copyright rules apply.
