// Thrown by an adapter method when a report has no real backing data model
// yet (as opposed to a genuine query failure) - caught by run-engine.ts and
// mapped to an honest 409 "not available yet" response, never fake data.
export class ReportNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportNotReadyError';
  }
}
