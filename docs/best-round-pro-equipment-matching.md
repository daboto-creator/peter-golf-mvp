# Best Round Pro equipment matching

## Definition and boundary

Equipment Match is a deterministic estimate of how technically compatible an
actual sellable golf-club configuration is with the facts currently known about
a golfer. It is guidance on a 0–100 scale, not launch-monitor fitting precision
and not a promise of performance.

The guidance bands are 90–100 excellent, 80–89 very good, 70–79 good or
acceptable, 60–69 a compromise, and below 60 a weak fit. A weak result remains
visible as `MATCH`; only an explicit conservative hard rule can return
`INCOMPATIBLE`.

The matching layer receives Mi Golf profile, active equipment and active
objectives plus one actual unit. Unit-level specifications are authoritative;
canonical model identity is descriptive context and never replaces hand, loft,
shaft or other physical configuration.

The engine never queries a database, inventory, network, search provider or
LLM. It performs no writes. This keeps identical inputs deterministic and lets
multiple supplied units be evaluated in memory without N+1 access.

## Independent concepts

- **Equipment Match** measures known technical compatibility and can be
  `MATCH` or conservatively `INCOMPATIBLE`.
- **Confidence** measures completeness and source quality. Missing information
  lowers Confidence and is returned explicitly; it does not create an invented
  Match penalty.
- **Personal Fit** is reserved for preferences such as brand, appearance or
  feel. It is not calculated here.
- **Commercial Fit** is reserved for price, budget, margin, promotion,
  availability, inventory age and conversion considerations. None is an input
  to Equipment Match.

New and used units with identical technical configurations therefore receive
the same Match. Purchase history can supply context only when it is explicitly
present in Mi Golf; a purchase is never treated automatically as the golfer's
current equipment.

## Versioned category profiles

Weights and versions live in one deterministic configuration module rather
than UI code. MVP profiles are `driver-v1`, `fairway-v1`, `hybrid-v1`,
`irons-v1`, `wedge-v1` and `putter-v1`. Each result preserves its rule version
for future auditing and immutable recommendation snapshots.

The category rules use only explicit structured facts:

- Driver: hand, player level, loft, shaft flex, declared shot tendency,
  explicit forgiveness/draw-bias/adjustability and current-driver context.
- Fairway wood: hand, level, shaft, explicit shot-bias attributes, loft and
  conservative structural bag gaps or redundancy.
- Hybrid: hand, level, shaft, loft/gap context and active long-iron replacement
  objectives.
- Iron: hand, level, explicit forgiveness/player profile, shaft and set makeup.
  Unknown lie or length fitting remains a confidence limitation.
- Wedge: hand, conservative loft progression/redundancy, bounce and grind only
  when turf interaction or conditions provide enough context. Otherwise
  professional validation is surfaced.
- Putter: hand, explicit stroke-fit properties and length context. The engine
  never infers stroke or fitting measurements.

Model names are not parsed for marketing claims. A name containing “draw”,
“tour” or similar language changes nothing unless the corresponding structured,
trusted unit attribute exists.

## Hard incompatibility and reasons

Known opposite handedness is a conservative hard incompatibility for the MVP
club categories. Unknown handedness remains `MATCH` with LOW Confidence and a
critical missing-data item; it is never fabricated as an incompatibility.

Results expose deterministic reason codes with `POSITIVE`, `NEUTRAL`,
`TRADEOFF`, `WARNING` or `INCOMPATIBILITY` severity and integer score impacts.
These codes are the source of truth. A future conversational layer may translate
them into Spanish but may not recalculate or override Match.

## Missing data and Next Best Question

Missing facts are classified as `CRITICAL`, `MATERIAL` or `HELPFUL`. The engine
calculates only supported compatibility, determines Confidence separately, and
uses the shared PR75 Next Best Question contract to identify the most material
golfer fact to request next. Examples include handedness, current bag gapping,
turf interaction and putter stroke/length context. Brand preference and budget
are deliberately absent because they cannot improve technical Match confidence.
