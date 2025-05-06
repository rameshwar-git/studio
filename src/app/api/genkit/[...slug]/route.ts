import {genkit} from 'genkit';
import {NextRequest} from 'next/server';
import {googleAI} from '@genkit-ai/googleai';
import '@/ai/flows/authorize-booking'; // Ensure flow is registered

genkit({
  plugins: [googleAI()],
  // Other genkit configurations if needed
});

export async function GET(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return genkit.handleApiRequest(req, {params});
}

export async function POST(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return genkit.handleApiRequest(req, {params});
}

export async function OPTIONS(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return genkit.handleApiRequest(req, {params});
}

export async function HEAD(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return genkit.handleApiRequest(req, {params});
}
