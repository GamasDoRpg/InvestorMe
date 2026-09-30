# InvestorMe
A powerful software to analise and predict good investiments using Machine Learning.

## Validation

InvestorMe is designed to treat market predictions as probabilistic signals rather than guaranteed outcomes. Every model or strategy should be validated before it is used for investment decisions.

The validation pipeline should include:

- **Train / validation / test separation** using chronological market data.
- **Out-of-sample testing** so models are evaluated on periods they have never seen during training.
- **Walk-forward validation** to simulate how a model would behave as new market data becomes available.
- **Data leakage checks** to ensure future information is never used to predict the past.
- **Benchmark comparison** against simple baselines and relevant market indexes.
- **Risk metrics** such as maximum drawdown, volatility, Sharpe ratio, win rate and profit factor.
- **Paper trading** before any strategy is considered for live execution.

Backtest performance alone is not considered sufficient evidence that a strategy will remain profitable in future market conditions. Model versions, datasets and validation results should be reproducible and tracked whenever possible.
