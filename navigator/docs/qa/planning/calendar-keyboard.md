# Calendar keyboard and table completion

T09 correction at baseline `968a7ee`: calendar results retain their original button collection and actions. One grid button is in the Tab sequence; arrows move focus by one or seven records, Home/End move to first/last, and boundaries clamp. Enter/Space retain native button activation and therefore select the focused candidate without opening a different mission automatically. Focus movement alone never changes scenario inputs or selected candidate.

A collapsed “Table of all mission-start results” exposes the exact same chronologically ordered record objects as the grid, including arrival, exclusive end, site, outcome, reserve margin, first known event bracket and inspect/open actions. Unknown margin remains unknown. The table adds no assessment calculation and does not change the grid button count. Scenario keys are retained on table rows for audit.

Fresh verification: three focused tests pass (direction/boundary/activation behavior, all 31 record identities and stable nonmutating ordering); full project typecheck and targeted ESLint pass. Real keyboard focus, native activation, table parity and 31-button count in the final combined browser artifact still require the integrator's coordinated preview; no browser pass is inferred from helper tests.

The retained-result ranking policy is displayed beside the counts; calendar/table chronological order is explicitly distinguished from top-result retention ranking.
