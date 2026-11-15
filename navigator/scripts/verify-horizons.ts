import { runAudit } from './audit-ephemeris';

// Fresh, bounded provider responses are archived with their exact request and hash.
// A red result retains measured discrepancies; it is not an operational gate.
runAudit(true).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
