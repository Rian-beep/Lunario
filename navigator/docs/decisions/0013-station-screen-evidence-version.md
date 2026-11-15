# Version supplementary station evidence independently

The station communications screen now rejects off-grid epochs, altered computed tables, future-issued inputs and missing Earth-orientation coverage. These alter which evidence is accepted and whether conditional capacity can be computed.

Its exported result carries `station-comms-2`. The canonical `evaluateScenario` mission model remains `planning-5`: its numerical calculations, constraints and saved scenario identity are unchanged. Station evidence retains its separate scenario binding and is recalculated by the current evaluator. Imported evidence is always reparsed, never trusted as a previously computed result. No station-screen result confers overall mission approval.

Validation requires parser/chronology regressions, archived independent CSPICE comparisons, publication input bindings and integrated UI tests. Live provider failures remain failures of retrieval, not passing comparisons. Original audit receipts remain archived; reviewed supplemental receipts identify current source.
