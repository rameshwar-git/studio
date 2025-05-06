
/**
 * @fileOverview Genkit AI initialization and configuration.
 * This file configures the Genkit instance with necessary plugins and default settings.
 * It exports a singleton `ai` object to be used throughout the application for AI-related tasks.
 */
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Configure the genkit singleton and export it as
// `ai` to use in your application.
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash', // Default model
});

