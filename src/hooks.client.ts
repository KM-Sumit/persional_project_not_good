import { z } from 'zod';

// Zod 4 probes `new Function` for its JIT; under our CSP that is a violation report on every page that
// imports a schema. Jitless mode skips the probe at a negligible cost for form-sized inputs.
z.config({ jitless: true });
