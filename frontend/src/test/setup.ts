import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom lacks these, and the router needs them.
Object.assign(globalThis, { TextEncoder, TextDecoder });
